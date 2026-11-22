// Builds content/docs (the site's pages) from:
//   - README.md                 -> /docs            (introduction, install)
//   - docs/ARCHITECTURE.md      -> /docs/architecture
//   - docs/ECONOMY.md           -> /docs/economy
//   - README.md of every opx_* repository of the organization -> /docs/resources/<name>
//
// Resource READMEs are fetched from GitHub (the org's public repos). To build
// against local checkouts instead, set OPX_RESOURCES_DIR to a folder holding
// one opx_* folder per resource. GITHUB_TOKEN, when set, is sent to the API to
// lift the rate limit.
//
// content/ is generated: it is git-ignored and rebuilt by every CI run.

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ORG = "opx77-framework";
const SELF = "opx_docs";
const ROOT = process.cwd();
const OUT = join(ROOT, "content", "docs");
const GH = `https://github.com/${ORG}`;

const headers = { "User-Agent": "opx-docs-build", Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function fetchText(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------- resources

/** [{ name, description }] for every opx_* repository, docs repo excluded. */
async function listResources() {
  const local = process.env.OPX_RESOURCES_DIR;
  if (local) {
    const names = (await readdir(local, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && /^opx_/.test(d.name) && d.name !== SELF)
      .map((d) => d.name);
    return names.map((name) => ({ name, description: "" }));
  }
  const out = [];
  for (let page = 1; ; page++) {
    const batch = JSON.parse(
      await fetchText(`https://api.github.com/orgs/${ORG}/repos?per_page=100&type=public&page=${page}`),
    );
    for (const repo of batch) {
      if (!/^opx_/.test(repo.name) || repo.name === SELF || repo.archived) continue;
      out.push({ name: repo.name, description: (repo.description ?? "").replace(/^OPX\/\/77\s*[—-]\s*/, "") });
    }
    if (batch.length < 100) return out;
  }
}

async function readResourceReadme(name) {
  const local = process.env.OPX_RESOURCES_DIR;
  if (local) {
    const file = join(local, name, "README.md");
    return existsSync(file) ? readFile(file, "utf8") : null;
  }
  try {
    return await fetchText(`https://raw.githubusercontent.com/${ORG}/${name}/main/README.md`);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- markdown

const DOC_ROUTES = {
  "architecture.md": "/docs/architecture",
  "economy.md": "/docs/economy",
};

/**
 * Rewrites a link target for the site.
 * `repo` is the resource the markdown comes from (null for opx_docs files),
 * so its relative links can point back at its own files on GitHub.
 */
function rewriteHref(href, repo, isImage) {
  const [path, frag] = splitFragment(href);
  const hash = frag ? `#${frag}` : "";
  if (path === "") return href; // in-page anchor

  // Another OPX resource, by GitHub URL or by a sibling folder path.
  const gh = path.match(new RegExp(`^https://github\\.com/${ORG}/(opx_[a-z0-9_]+)(?:/blob/[^/]+/README\\.md)?/?$`, "i"));
  if (gh && gh[1] !== SELF) return `/docs/resources/${gh[1]}${hash}`;
  const sibling = path.match(/^(?:\.\.\/)+(?:resources\/)?(opx_[a-z0-9_]+)(?:\/README\.md)?\/?$/);
  if (sibling) return `/docs/resources/${sibling[1]}${hash}`;
  const resFolder = path.match(/^resources\/(opx_[a-z0-9_]+)\/?$/);
  if (resFolder) return `/docs/resources/${resFolder[1]}${hash}`;

  if (/^[a-z]+:/i.test(path) || path.startsWith("/")) return href; // absolute URL

  // The docs of this repository.
  const base = path.split("/").pop().toLowerCase();
  if (!repo) {
    if (DOC_ROUTES[base]) return `${DOC_ROUTES[base]}${hash}`;
    if (base === "readme.md") return `/docs${hash}`;
    return `${GH}/${SELF}/blob/main/${path.replace(/^(\.\.\/)+/, "")}${hash}`;
  }

  // A file of the resource itself: point at it on GitHub.
  const clean = path.replace(/^\.\//, "");
  if (clean === "README.md") return hash || `/docs/resources/${repo}`;
  if (isImage) return `https://raw.githubusercontent.com/${ORG}/${repo}/main/${clean}`;
  return `${GH}/${repo}/blob/main/${clean}${hash}`;
}

function splitFragment(href) {
  const i = href.indexOf("#");
  return i < 0 ? [href, ""] : [href.slice(0, i), href.slice(i + 1)];
}

/** Rewrites markdown links outside code fences. */
function rewriteLinks(md, repo) {
  const parts = md.split(/(^```[\s\S]*?^```[^\n]*$)/m);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? part // fenced code
        : part.replace(/(!?)\[([^\]\n]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (_m, bang, text, href, title = "") =>
            `${bang}[${text}](${rewriteHref(href, repo, bang === "!")}${title})`,
          ),
    )
    .join("");
}

/** Splits the first `# Title` off the body. */
function takeTitle(md, fallback) {
  const m = md.match(/^\s*#\s+(.+?)\s*#*\s*$/m);
  if (!m || md.slice(0, m.index).trim() !== "") return { title: fallback, body: md };
  return { title: m[1].replace(/`/g, ""), body: md.slice(m.index + m[0].length).replace(/^\s+/, "") };
}

/** First plain paragraph, for the page description. */
function firstParagraph(body) {
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || /^(#|\||```|>|-|\*|\d+\.|<|!\[)/.test(t)) continue;
    return t
      .replace(/\s*\n\s*/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[`*_]/g, "")
      .slice(0, 300);
  }
  return "";
}

function page({ title, description, body }) {
  // JSON strings are valid YAML double-quoted scalars.
  const fm = [`title: ${JSON.stringify(title)}`];
  if (description) fm.push(`description: ${JSON.stringify(description)}`);
  return `---\n${fm.join("\n")}\n---\n\n${body.trim()}\n`;
}

// ---------------------------------------------------------------- build

async function main() {
  await rm(join(ROOT, "content"), { recursive: true, force: true });
  await mkdir(join(OUT, "resources"), { recursive: true });

  // Introduction (README.md)
  const readme = await readFile(join(ROOT, "README.md"), "utf8");
  {
    const { body } = takeTitle(readme, "OPX//77");
    await writeFile(
      join(OUT, "index.md"),
      page({ title: "Introduction", description: firstParagraph(body), body: rewriteLinks(body, null) }),
    );
  }

  // docs/*.md
  const docPages = [];
  for (const file of (await readdir(join(ROOT, "docs"))).filter((f) => f.endsWith(".md")).sort()) {
    const slug = file.replace(/\.md$/, "").toLowerCase();
    const md = await readFile(join(ROOT, "docs", file), "utf8");
    const { title, body } = takeTitle(md, slug);
    await writeFile(
      join(OUT, `${slug}.md`),
      page({ title, description: firstParagraph(body), body: rewriteLinks(body, null) }),
    );
    docPages.push(slug);
  }

  // Resources, in the order of the README table, then any newer repo.
  const order = [...readme.matchAll(/\[`(opx_[a-z0-9_]+)`\]/g)].map((m) => m[1]);
  const tableDesc = Object.fromEntries(
    [...readme.matchAll(/^\|\s*\[`(opx_[a-z0-9_]+)`\][^|]*\|\s*(.+?)\s*\|\s*$/gm)].map((m) => [m[1], m[2]]),
  );
  const resources = (await listResources()).sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || a.name.localeCompare(b.name);
  });

  const listed = [];
  const missing = [];
  for (const { name, description } of resources) {
    const md = await readResourceReadme(name);
    if (md == null) {
      missing.push(name);
      continue;
    }
    const { body } = takeTitle(md, name);
    const desc = (tableDesc[name] ?? description ?? "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    const plainDesc = desc.replace(/`/g, "") || firstParagraph(body);
    const source = `> Source: [${ORG}/${name}](${GH}/${name})\n\n`;
    await writeFile(
      join(OUT, "resources", `${name}.md`),
      page({ title: name, description: plainDesc, body: source + rewriteLinks(body, name) }),
    );
    listed.push({ name, desc: desc || plainDesc });
  }

  await writeFile(
    join(OUT, "resources", "index.md"),
    page({
      title: "Resources",
      description: "Every OPX resource is its own repository. Each one has a config.lua, locales, a types.lua and a README.",
      body: listed.map(({ name, desc }) => `- [\`${name}\`](/docs/resources/${name}): ${desc}`).join("\n"),
    }),
  );

  await writeFile(
    join(OUT, "meta.json"),
    JSON.stringify({ pages: ["index", ...docPages, "resources"] }, null, 2) + "\n",
  );
  await writeFile(
    join(OUT, "resources", "meta.json"),
    JSON.stringify({ title: "Resources", pages: ["index", ...listed.map((r) => r.name)] }, null, 2) + "\n",
  );

  console.log(`content: introduction, ${docPages.length} docs, ${listed.length} resources`);
  if (missing.length) console.warn(`no README for: ${missing.join(", ")}`);
  if (listed.length === 0) throw new Error("no resource page generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
