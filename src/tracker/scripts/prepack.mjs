#!/usr/bin/env node

// prepack.mjs — Copies the repository README and LICENSE into the package
// directory so npm ships them in the tarball.
//
// The README lives at the repository root and is the single source of truth:
// it is what GitHub renders and what npmjs.com renders. Keeping a second copy
// in this directory is how the two previously drifted apart, so the copy is
// made at pack time and gitignored rather than committed.
//
// Usage: node scripts/prepack.mjs

import { copyFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = join(__dirname, "..");
const repoRoot = join(packageDir, "..", "..");

for (const file of ["README.md", "LICENSE"]) {
  copyFileSync(join(repoRoot, file), join(packageDir, file));
  console.log(`prepack: copied ${file}`);
}
