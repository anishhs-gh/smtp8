import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/index.js",
  // esbuild preserves the shebang from the entry point automatically
});
