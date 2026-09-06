import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const banner =
  "/*! @releval/tracker | Apache-2.0 | https://github.com/releval/tracker */";

// Stamped into events as event_attributes.tracker.version. In CI the
// `package` job runs `npm version` before the build, so the release build
// carries the release version.
const { version } = JSON.parse(readFileSync("./package.json", "utf-8")) as {
  version: string;
};
const define = { __TRACKER_VERSION__: JSON.stringify(version) };

export default defineConfig([
  // Library build: ESM + CJS + declarations
  {
    entry: {
      "releval-tracker": "src/index.ts",
      // Optional React bindings, published as the `@releval/tracker/react`
      // subpath. React is externalized (an optional peer dependency), never
      // bundled - and it is deliberately kept out of the IIFE build below.
      react: "src/react/index.ts",
    },
    external: ["react"],
    format: ["esm", "cjs"],
    dts: true,
    hash: false,
    outDir: "dist",
    clean: true,
    sourcemap: true,
    target: "es2019",
    define,
    outputOptions(options) {
      // The react entry needs the 'use client' directive so it can be
      // imported from a Next.js App Router server component tree; the other
      // chunks must not carry it.
      options.banner = (chunk) =>
        chunk.name === "react" ? `'use client';\n${banner}` : banner;
      return options;
    },
  },
  // Script build: IIFE for direct browser use
  {
    entry: { "releval-tracker": "src/index.ts" },
    format: ["iife"],
    globalName: "Releval",
    outDir: "dist",
    clean: false,
    minify: true,
    target: "es2019",
    platform: "browser",
    noExternal: ["ulidx"],
    inlineOnly: false,
    define,
    outputOptions(options) {
      options.entryFileNames = "[name].global.js";
      options.banner = banner;
      return options;
    },
  },
]);
