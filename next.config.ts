import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded with Node's own require instead of being bundled: PGlite ships a
  // WASM Postgres build and the file parsers read assets from their packages.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf", "mammoth"],
};

export default nextConfig;
