# Reveal (Obsidian Plugin)

Reveal adds a toggle to show hidden directories (dot-folders) in Obsidian's File Explorer.

## Install (manual)

1. Build this plugin:

```bash
npm install
npm run build
```

2. Copy these files into your vault at:
`<your-vault>/.obsidian/plugins/reveal/`

- `main.js`
- `manifest.json`
- `styles.css`

3. In Obsidian, go to **Settings -> Community plugins** and enable `Reveal`.

## Features

- Toggle hidden directories on/off from command palette and ribbon icon.
- Persist toggle state across restarts.
- Exclusion patterns (glob-like) to avoid heavy folders such as `.git`.
- Desktop-only behavior with graceful fallback if internals change.

## Usage

- Use command palette command: `Toggle hidden directories`.
- Or click the ribbon icon:
- `eye-off` means hidden directories are currently hidden.
- `eye` means hidden directories are currently visible.
- Configure excluded paths in `Settings -> Reveal`.

## Default excluded patterns

- `.git/**`
- `.obsidian/**`
- `node_modules/**`
- `.venv/**`

## Development

```bash
npm install
npm run build
npm test
```

For watch mode:

```bash
npm run dev
```

## Community plugin release checklist

See `docs/release-checklist.md` and `docs/community-submission.md`.

## Notes

Reveal patches Obsidian's desktop filesystem adapter behavior for hidden-directory reconciliation. Because this uses internal APIs, major Obsidian updates may require plugin updates.
