# Historical artwork archive

The current source tree no longer includes 43 unused artwork files totaling 32,989,271 bytes
(31.46 MiB). Their original paths, sizes, and SHA-256 hashes are recorded in
[art-archive-manifest.json](art-archive-manifest.json).

The files are preserved outside this repository in the sibling directory
`../markhammonds-art-archive/`. That directory keeps the original `assets/...` layout, a copy of
the manifest named `manifest.json`, and snapshots of the related generation/provenance notes.
It is a local archive, not a dependency or deployment input. A fresh clone does not include it.
On September 28, 2026, Mark confirmed that the archive also has an off-machine backup. Its location
and contents have not been independently verified by the maintenance tools.

## What moved

- Six standalone character PNG/WebP files from the first homepage design.
- Twenty scene PNG/WebP files from that design, including the downloaded reference props and
  separately generated Warsaw picture.
- Eleven full-size workstation PNG source renders, five superseded workstation WebP exports,
  and the unused Bitmotive monitor backdrop SVG.

The audit checked full paths and filenames against runtime HTML, JavaScript, CSS, SVG, tests,
configuration, and render/build tools. These files had no current references outside historical
Markdown notes. Current hero images, avatar and tattoo crops, screen artwork, safe overlays, game
previews/models, logos, icons, cover images, and photo exports remain in the repository.

In particular, `assets/workstation/office-day.webp` and `office-day-small.webp` remain: although
their visible scene was superseded, their alpha channels still mask the current artwork.

## Verification and recovery

Every archived file was copied and compared byte for byte, with its size and SHA-256 checked,
before any original was removed. Both manifest copies were written and read back before removal.
The recorded `repository_head` identifies the pre-archive committed baseline in the former Git
history; it is provenance, not a commit reachable from the current public repository.

To restore an individual file, first compare its archived SHA-256 with the manifest, then copy it
back under the same relative path. For example, from the repository root:

```sh
shasum -a 256 ../markhammonds-art-archive/assets/workstation/office-day-v2.png
cp ../markhammonds-art-archive/assets/workstation/office-day-v2.png assets/workstation/
```

The generation prompts remain in `assets/workstation/`, `assets/characters/`, and `assets/scene/`.
Archived originals can be restored when intentionally regenerating an illustration; ordinary
development, previews, tests, and deployment use only the retained runtime exports.

The original archive operation removed files from the working tree without rewriting history.
Mark subsequently restarted the Git history before publishing the public repository. Its initial
import (`71bd417`, September 28, 2026) excludes all 43 archived paths, so the old artwork blobs are
not part of this repository's history. Recovery of those originals relies on the external archive
and its backup, not the public Git history.
