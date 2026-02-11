# Release Checklist

1. Update `manifest.json` version.
2. Update `versions.json` with `"<version>": "<minAppVersion>"`.
3. Run `npm ci && npm run check`.
4. Create git tag matching manifest version.
5. Create GitHub Release with assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`
6. Verify release notes include compatibility and known limitations.
