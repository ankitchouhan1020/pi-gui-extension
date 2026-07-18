---
title: Release
description: Test, pack, version, and publish the Pi extension to npm.
---

## npm release (manual CLI)

```bash
npm login                 # once
npm test
npm run check
npm pack --dry-run
npm version patch         # or minor / major — commits + tags
npm publish
git push && git push --tags
```

`prepack` reruns the tests and rebuilds `dist/` before npm creates the tarball.
The package manifest already sets public access.

Install: `pi install npm:pi-gui-extension`

The Astro documentation site is intentionally outside the root package's
`files` allowlist. Build it independently with `npm run build:docs`.
