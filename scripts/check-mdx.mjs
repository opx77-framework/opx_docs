// Compiles every page under content/docs (or the folders given) and parses every meta.json,
// so a broken page fails here with its file and line instead of deep inside `next build`.
// Usage: node scripts/check-mdx.mjs [content/docs/opx_bank ...]
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

const KNOWN = new Set(["Callout", "Tabs", "Tab", "Steps", "Step", "Cards", "Card", "TypeTable", "Accordion", "Accordions", "ResourceLinks"]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const roots = process.argv.slice(2);
let failed = 0;
let pages = 0;
for (const root of roots.length ? roots : ["content/docs"]) {
  for await (const file of walk(root)) {
    const text = await readFile(file, "utf8");
    if (file.endsWith("meta.json")) {
      try { JSON.parse(text); } catch (err) { failed++; console.error(`${file}: ${err.message}`); }
      continue;
    }
    if (!/\.mdx?$/.test(file)) continue;
    pages++;
    if (!/^---\n[\s\S]*?\btitle:/.test(text)) { failed++; console.error(`${file}: front matter needs a title`); }
    try {
      await compile(text, { remarkPlugins: [remarkGfm], format: file.endsWith(".md") ? "md" : "mdx" });
    } catch (err) {
      failed++;
      console.error(`${file}:${err.line ?? "?"}: ${err.reason ?? err.message}`);
      continue;
    }
    for (const [, tag] of text.replace(/```[\s\S]*?```/g, "").matchAll(/<([A-Z][A-Za-z]*)/g)) {
      if (!KNOWN.has(tag)) { failed++; console.error(`${file}: unknown component <${tag}>`); }
    }
  }
}
console.log(`${pages} pages checked, ${failed} problem(s)`);
process.exit(failed ? 1 : 0);
