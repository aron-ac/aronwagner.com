# Maintenance audit — September 28, 2026

This is a historical record of the initial maintenance review on September 28, 2026, before Mark
restarted the Git history and published the public repository. Findings and verification counts
below describe that reviewed snapshot, not the current checkout. The [README](../README.md)
contains the maintained architecture and development instructions.

The audit distinguished the reviewed behavior from older findings. It covered
the main homepage, the three games, packaging, asset provenance, and the retained desk prototype.
The bookshelf carousel, Meditations and Art of War dialogs, and Sisyphus quote remain part of the
homepage.

## Findings checked against the working tree

| Finding                                                        | Result                                                                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading interactions lack tests or documentation.              | Stale: the README describes these interactions, `tests/meditations-smoke.cjs` covers the reading dialogs, and `tests/books-smoke.cjs` covers the favorite-books carousel. Keep those checks when refactoring. |
| Asset URLs have no cache versioning.                           | Incomplete: manual query tokens already existed. Packaging now derives `/immutable/` asset URLs from content and rewrites dependencies together, removing the need to maintain manual tokens.                 |
| Deployment contains exactly 65 runtime files.                  | Stale: icons, social cards, books, and later features changed the packaged set. Build output reports the current count/size and `dist/asset-manifest.json` maps source paths to production asset URLs.        |
| The lower monitors still display Bitmotive graphics.           | Stale in artwork notes: all four current screens use the Tampa panorama. The official logo remains on the business card. Historical generation prompts are preserved verbatim and labeled as historical.      |
| Private source-photo paths assume a particular home directory. | Confirmed in provenance notes. Documentation now identifies the owner's private collection by its portable folder names and states that it is outside the repository.                                         |
| Unused source art increases the source checkout size.          | Confirmed: 43 unused files totaling 31.46 MiB were byte-verified into an external archive before removal from the working tree. All runtime and render-tool inputs remain. Git history was not rewritten.     |
| The alternate desk is a second finished homepage.              | Incorrect: `desk.html` is an earlier local SVG prototype with a separate theme and placeholder destinations. Production excludes it and redirects `/desk.html` to `/`; its source and local checks remain.    |

## Refactor decisions

This project uses vanilla JavaScript, Canvas, and Three.js; React-specific component or hook rules
are not applicable. The refactor keeps that stack and applies the equivalent separation of pure
simulation state, rendering, browser lifecycle, shared UI, and build/tooling responsibilities.

- **Packaging and policy:** content-addressed asset URLs replace manual cache query strings.
  Large images, fonts, and the vendor graph retain independent cache identities; the application
  dependency graph changes atomically. Build transformation changes also invalidate affected URLs.
  HTML uses Cloudflare's revalidation default; immutable assets receive a one-year cache policy.
  CSP permits scripts from the same origin, a hash for the generated theme bootstrap, and the
  existing Cloudflare analytics host. Referrer, frame, permissions, and MIME-sniffing headers are
  generated alongside server redirects for the retired game URL and prototype desk.
- **Games:** shared arcade CSS and a shared RAF/resize/page-lifecycle controller remove duplicated
  scaffolding. Surf guards collapsed viewports and unavailable minimap contexts, uses actual
  minimap dimensions, and avoids repeated camera allocations. CiCi's unused decoration renderer
  is removed. Viewports/control groups have semantic roles; buttons declare their type; small HUD
  labels are larger and compact layouts hide optional decoration to preserve usable controls.
- **Theme and dialogs:** the prepaint bootstrap comes from linted JavaScript; one critical CSS
  palette supplies both page colors and browser theme color. Native dialogs share one scroll-lock
  rule. The reading regions handle Home/End explicitly to avoid stale native scroll destinations
  when successive quotes change the content height.
- **Tests and tools:** browser suites use Node's test runner, discoverable suite names, isolated
  screenshots, and state-based waits. The one short lifecycle observation interval intentionally
  checks that suspended pages stop scheduling animation frames. Preview generators and the
  shared browser launcher live under tools. GitHub Actions installs locked dependencies and
  pinned Chrome, then runs source and packaged-site coverage. CI actions use verified commit SHAs.
- **Compatibility and housekeeping:** Wrangler compatibility dates match; generated output is
  ignored; debug URLs use the URL API; source notes use portable paths. The prototype bootstrap
  is externalized for linting even though the prototype is excluded from production.
- **Intentional behavior:** links continue opening in new tabs because Mark explicitly requested
  that behavior earlier. Inline style attributes remain allowed by CSP for the illustrated scene
  coordinates and dynamic HUD styling; script execution does not allow unsafe-inline or eval.

The build tests also guard a packaging defect found during this review: `.json` references must
not be partially matched as `.js`, which otherwise forces the book catalog through a mutable alias.

## Artwork verification

[The archive inventory](art-archive-manifest.json) records each removed file's path, size, and
SHA-256. [Recovery instructions](art-archive.md) describe the local archive and explain why this
does not shrink existing Git history. The twelve workstation runtime exports remain in the
repository, including the two original daytime files still used as alpha masks.

The active visual sources are the runtime assets and native drawing/model code. Generation notes
record how earlier artwork was produced; they are not a declaration that every historical PNG or
screen treatment is still shipped. Source photographs remain in the owner's private collection.

## Verification scope

Formatting, lint, simulation tests, source-site browser suites, and packaged-site checks provide
separate evidence. Browser coverage includes small phones, landscape screens, tablets, laptops,
theme first paint, modal focus and dismissal, touch controls, and page lifecycle restoration.
These are Chromium simulations; they do not establish physical-device or Safari coverage.

The completed review passed `npm run check` (19 unit/build/server checks), all 13 source browser
suites, and all 12 production browser suites. Separate local Wrangler checks verified real CSP,
cache headers, query-preserving redirects, homepage interactions, SVG clips, and game rendering
without browser errors or CSP violations. The current release build contains 86 files (8.66 MiB).
Those counts describe this review run; the build and test runners report current totals thereafter.

Deployment is a separate action. A local refactor or successful package build does not mean that
the public site has been updated.

## Subsequent follow-up on September 28, 2026

- Mark restarted the Git history before publishing the public repository. Its initial import
  (`71bd417`) excludes the archived artwork; the historical statements above about retained Git
  blobs no longer describe this repository. Mark confirmed an off-machine archive backup; its
  location and contents have not been independently verified.
- The unfinished desk prototype, its dedicated assets and test suite, the unused legacy redirect
  HTML, and the obsolete Surf Riders SVG preview were removed. Server redirects preserve the old
  desk and game URLs. Main-homepage responsive coverage remains.
- The favorite-book thumbnails remain self-hosted by Mark's explicit choice, with provenance and
  Amazon purchase links preserved. Game-specific responsive CSS remains separate where its
  behavior differs; no further extraction was justified solely by stylesheet size.
- The first GitHub Actions run after the public import passed installation and static/unit checks,
  but five WebGL browser suites timed out during navigation and production browser tests were
  skipped: [workflow run 36479729257](https://github.com/mhammonds/markhammonds.com/actions/runs/36479729257).
- The navigation failure was reproduced with the pinned Chrome 154 in Linux Docker: requests had
  completed and the game had rendered frames, but continuous software rendering prevented the
  `networkidle0` event. Game tests now wait for initialization and rendered frames, and CI opts
  into Chromium's supported SwiftShader backend with the browser sandbox retained. Bay's camera
  check also now brakes through real keyboard input before waiting for a stationary view. All
  five formerly failing suites passed in Linux Docker after these changes. This used amd64
  emulation on Apple Silicon; a new GitHub Actions run still requires pushing the changes.
- The raw homepage now uses ordinary stylesheet and script references that the development
  server and production build inline. Generic static-server tests cover cold/warm day, night,
  and saved-theme loads without an opposite-theme flash. Malformed server configuration fails
  at startup; missing request files and internal rendering errors have distinct responses.
- The Sisyphus dialog retains Mark's exact quotation and adds the Justin O’Brien translation,
  Penguin Modern Classics edition, and publisher link.

The follow-up passed 23 unit/build/server tests, all 13 source-browser cases and all 13 packaged-site
browser cases, plus a Wrangler deployment dry run. These are dated local validation results;
they do not claim a new GitHub Actions run or production deployment.
