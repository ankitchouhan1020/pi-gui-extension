# npm release

Publish `pi-gui` to the public npm registry so users can:

```bash
pi install npm:pi-gui
```

## One-time setup

1. Create an npm **Automation** access token (npmjs.com → Access Tokens).
2. Add it as a GitHub repo secret named **`NPM_TOKEN`**:
   ```bash
   gh secret set NPM_TOKEN --repo ankitchouhan1020/pi-gui-extension
   ```
3. Confirm package name is free / you own `pi-gui` on npm.

## Ship a version

From a clean `main` with tests green:

```bash
npm run release:patch   # 0.1.0 → 0.1.1
# or: release:minor / release:major
```

That bumps `package.json`, commits, tags `v*`, and pushes.  
GitHub Actions (`.github/workflows/npm-publish.yml`) runs tests + `npm publish`.

`prepublishOnly` rebuilds `dist/` so the tarball always has a fresh UI.

## Manual publish (optional)

```bash
npm login
npm test
npm publish --access public
```

## After publish

```bash
pi install npm:pi-gui
# or upgrade: pi update npm:pi-gui
```
