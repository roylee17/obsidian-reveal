# Reveal 1.0.0

Initial release of Reveal.

## Features

- Toggle hidden directories in File Explorer from command palette.
- Ribbon icon toggle with stateful `eye` / `eye-off` icon.
- Settings for excluding heavy/sensitive paths (default includes `.git`, `.obsidian`, `node_modules`, `.venv`).
- Desktop-only implementation with graceful fallback for unsupported adapter internals.

## Notes

- Uses Obsidian desktop adapter reconciliation internals to surface hidden directory trees.
- Tested with `npm run build` and `npm test`.
