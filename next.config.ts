import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded with Node's own require instead of being bundled: PGlite ships a
  // WASM Postgres build and the file parsers read assets from their packages.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf", "mammoth"],
  // This folder is the project root. Without this, a stray package-lock.json
  // in a parent folder (for example on the Desktop) can be mistaken for it.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
