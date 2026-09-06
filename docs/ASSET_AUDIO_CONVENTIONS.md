# Asset and audio manifest conventions

Runtime code refers to stable IDs, never raw filenames. Canonical filenames and paths live in the manifests:

- `data/assets/manifest.json`
- `data/audio/manifest.json`

Allowed status values:

| Status | Meaning |
|---|---|
| `PLACEHOLDER` | Geometric or temporary functional stand-in. |
| `DEV_GENERATED` | Generated asset accepted for development only. |
| `NEEDS_MANUAL_GENERATION` | Canonical prompt/filename are ready for later manual production. |
| `FINAL` | Approved production asset with provenance and licensing recorded. |

Required fields are `id`, `kind`, `status`, `path`, and `canonicalFilename`. Record `license`, provenance/source URL, attribution, prompt reference, aspect ratio, loop behavior, and notes when applicable.

Replacing an asset may change the file at the manifest path or the manifest path itself. It must not change its stable ID or require simulation/gameplay changes.

Sound effects with unclear redistribution rights must not enter the repository. Background music remains absent until manually generated and uploaded under its canonical filename.
