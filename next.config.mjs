import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// Served by GitHub Pages at https://opx77-framework.github.io/opx_docs/,
// so every route and asset lives under /opx_docs. `trailingSlash` emits
// `page/index.html`, which is what Pages serves for `/page/`.
export const basePath = "/opx_docs";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  basePath,
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default withMDX(config);
