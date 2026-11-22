export const appName = "OPX//77";
export const docsRoute = "/docs";
export const docsContentRoute = "/llms.mdx/docs";

// Set by next.config.mjs. Raw <img>/<a> tags and fetches need it; next/link
// and the router add it on their own.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const siteUrl = "https://opx77-framework.github.io/opx_docs";

export const org = "opx77-framework";

export const gitConfig = {
  user: org,
  repo: "opx_docs",
  branch: "main",
};

/** Where the source of a generated page lives, for the "Edit on GitHub" link. */
export function sourceUrl(pagePath: string): string {
  const resource = pagePath.match(/^resources\/(opx_[a-z0-9_]+)\.md$/);
  if (resource) return `https://github.com/${org}/${resource[1]}/blob/main/README.md`;
  const files: Record<string, string> = {
    "index.md": "README.md",
    "architecture.md": "docs/ARCHITECTURE.md",
    "economy.md": "docs/ECONOMY.md",
  };
  const file = files[pagePath] ?? "";
  return `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${file}`;
}
