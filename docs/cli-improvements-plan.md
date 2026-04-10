# CLI Improvements Plan

## Overview

Three changes to make to the CLI package:

1. **Add `cli/README.md`** — CLI-specific docs for npm registry
2. **Exclude `.env.example` from npm publish** — update `.npmignore`
3. **Bundled + minified build** — replace `tsc` with `esbuild` to produce a single self-contained, minified binary with all dependencies inlined

---

## 1. CLI README (`cli/README.md`)

Create a standalone README for the `smtp8` npm package. It will be the page shown on `npmjs.com/package/smtp8`.

**Sections:**
- **What it is** — one-liner description
- **Requirements** — Node >=18
- **Installation** — `npm install -g smtp8`
- **Quick start** — minimal usage example
- **Usage / flags** — all CLI options (`--local`, `--api-url`, `--version`, `--help`)
- **Configuration** — `SMTP8_API_URL` environment variable
- **Examples** — real-world invocations
- **Links** — GitHub repo, web app

---

## 2. Exclude `.env.example` from npm publish

**Current state:** `cli/.npmignore` already excludes `src/`, `tests/`, `docs/` but does **not** exclude `.env.example`.

**Change:** Add `.env.example` to `cli/.npmignore`.

Why: `.env.example` is a developer convenience file for cloning the repo. It has no value in the published npm package and should not ship to end users.

---

## 3. Bundled + Minified Build (esbuild)

### Problem with current `tsc` approach

- `tsc` transpiles TypeScript but does **not** bundle dependencies — `node_modules` must be present at runtime
- Published npm package has `dependencies` (`@clack/prompts`, `chalk`) that npm installs on the user's machine
- No minification — compiled output is verbose/readable

### Solution: esbuild

Replace the `tsc` build step with `esbuild`, which:
- **Bundles** all `dependencies` into a single `dist/index.js` — no `node_modules` needed at runtime
- **Minifies** identifiers, whitespace, and syntax
- Preserves the `#!/usr/bin/env node` shebang at the top of the output
- Marks Node.js built-ins (`node:*`, `path`, `fs`, etc.) as external (they are always available in the runtime)
- Handles ES module output correctly

### Changes required

#### `cli/package.json`

- Move `@clack/prompts` and `chalk` from `dependencies` → `devDependencies`
  (they will be bundled in — end users do not need them in their `node_modules`)
- Add `esbuild` to `devDependencies`
- Update `build` script:
  ```
  Before: "build": "tsc && chmod +x dist/index.js"
  After:  "build": "node build.mjs && chmod +x dist/index.js"
  ```
- Remove `tsconfig.json` dependency on `tsc` for the final build
  (keep `tsc` only for type-checking, as a separate `typecheck` script)

#### New `cli/build.mjs`

A small esbuild script (checked into the repo, not published):

```js
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: { js: '#!/usr/bin/env node' },
  // Node built-ins are always available — no need to bundle them
  packages: 'bundle',          // bundle everything by default
  external: [],                // nothing to external; all deps inline
});
```

> Node built-ins (`path`, `fs`, `os`, etc.) are automatically treated as external by esbuild when `platform: 'node'`.

#### `cli/tsconfig.json`

Keep for IDE support and type-checking. The `tsc` compiler is now only used via `npm run typecheck`, not the main build.

#### `cli/.npmignore`

Add:
- `.env.example`
- `build.mjs`
- `tsconfig.json`
- `*.test.ts` / `tests/`

(Some may already be excluded — verify and ensure all are listed.)

---

## Execution Order

| Step | File(s) | Action |
|------|---------|--------|
| 1 | `cli/README.md` | Create |
| 2 | `cli/.npmignore` | Add `.env.example` and build artifacts |
| 3 | `cli/package.json` | Move deps, add esbuild, update build script |
| 4 | `cli/build.mjs` | Create esbuild build script |
| 5 | `cli/tsconfig.json` | Keep as-is (IDE/typecheck only) |
| 6 | Verify | Run `npm run build` in `cli/`, confirm `dist/index.js` is minified and executable |

---

## Out of Scope

- No changes to backend, frontend, or root package
- No changes to GitHub Actions workflows (they already run `npm run build`)
- No changes to `src/index.ts` logic
