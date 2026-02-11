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
  "repo": "roylee17/obsidian-reveal"
}
```

Then open PR:
- Title: `Add plugin: Reveal`
- Select template: `Community Plugin`
- Complete checklist in PR body.

### Fast path with prepared patch

After forking `obsidianmd/obsidian-releases` to `roylee17/obsidian-releases`:

```bash
git clone git@github.com:roylee17/obsidian-releases.git
cd obsidian-releases
git checkout -b add-plugin-reveal
git am /Users/roylee/github/roylee17/reveal/docs/obsidian-releases-add-plugin-reveal.patch
git push -u origin add-plugin-reveal
```

Then open PR from `roylee17:add-plugin-reveal` to `obsidianmd:master`.

## 4. After opening PR

- Wait for bot label:
- `Ready for review` = validation passed.
- `Validation failed` = fix issues and push.
- If reviewers request changes, update code + release assets and comment on the same PR.
