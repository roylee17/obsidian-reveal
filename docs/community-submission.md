# Obsidian Community Submission

## 1. Push plugin source to GitHub

Create a public repository (for example `<your-user>/reveal`) and push this project.

## 2. Prepare first public release

1. Ensure `manifest.json` and `versions.json` versions match.
2. Run verification:

```bash
npm ci
npm run check
```

3. Create tag and release (tag must match `manifest.json` version):

```bash
git tag 1.0.0
git push origin 1.0.0
```

4. In GitHub release assets, upload:
- `main.js`
- `manifest.json`
- `styles.css`

## 3. Submit to `obsidianmd/obsidian-releases`

Append this object to `community-plugins.json`:

```json
{
  "id": "reveal",
  "name": "Reveal",
  "author": "Roy Lee",
  "description": "Show and toggle hidden directories in File Explorer.",
  "repo": "<your-user-or-org>/reveal"
}
```

Then open PR:
- Title: `Add plugin: Reveal`
- Select template: `Community Plugin`
- Complete checklist in PR body.

## 4. After opening PR

- Wait for bot label:
- `Ready for review` = validation passed.
- `Validation failed` = fix issues and push.
- If reviewers request changes, update code + release assets and comment on the same PR.
