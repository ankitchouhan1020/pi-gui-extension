# npm release (manual CLI)

```bash
npm login                 # once
npm test
npm version patch         # or minor / major — commits + tags
npm publish --access public
git push && git push --tags
```

`prepublishOnly` rebuilds `dist/` before publish.

Install: `pi install npm:pi-gui`
