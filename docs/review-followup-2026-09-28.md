# Code review follow-up, 2026-09-28

Hand-off from the second review pass to the implementing agent. It covers the uncommitted working
tree that contains the refactor (shared game runtime, fingerprinted build, CI workflow, reading
dialogs, book carousel, art archive). Every item from the first review is resolved except where
noted below.

Verified on the reviewed working tree: `npm run lint`, `npm run format:check`, `npm test`
(19 tests), `npm run test:browser` (13 suites), `npm run test:browser:production` (12 suites), and
`npx wrangler deploy --dry-run` all pass. Browser suites were run with `CHROME_BIN` pointed at
system Chrome.

## Do first

- [ ] Commit the working tree. It holds 97 modified or deleted files and 33 new files with no
      commit; the workflow in `.github/workflows/check.yml` has never run because nothing is pushed.
      Commit in logical slices (art archive removal, build pipeline and headers, shared game
      runtime, homepage reading features, tests and CI, documentation) and push so CI runs once.

## Remaining issues, in priority order

### 1. `index.html` breaks under a generic static server

- Where: `index.html:7` and `index.html:8` are empty `data-inline` placeholders;
  `styles.css` no longer defines the color tokens; only `assets/homepage/theme-critical.css` does.
- Why it matters: serving the raw tree with any server other than `tools/serve.js` yields an
  unstyled palette and a permanently hidden theme toggle. The README documents the requirement,
  but the failure mode is silent.
- Suggested fix: make the placeholders real references, for example
  `<link rel="stylesheet" href="assets/homepage/theme-critical.css" data-inline>` and
  `<script src="assets/homepage/theme-bootstrap.js" data-inline>`, and have
  `tools/lib/inline-homepage.js` replace those elements with inline content. Raw serving then
  degrades to one extra request instead of breaking; the build output stays identical.
- Done when: the page renders correctly from a plain static server, `tests/build-site.test.js`
  still confirms no `data-inline=` survives in `dist/`, and `tests/homepage-theme-load.cjs` passes.

### 2. `cr-surf-rides.html` is dead source

- Where: repository root. It is not in `pages` in `tools/lib/site-build.js`, and `tools/serve.js`
  redirects the path before reading any file, so nothing serves it in development or production.
- Suggested fix: delete the file. The redirect rule, `tests/serve.test.js`, and the redirect check
  in `tests/surf-rides-smoke.cjs` already cover the URL.

### 3. The dev server hides configuration errors

- Where: `tools/serve.js:28` builds the header and redirect rules lazily; a rejected promise is
  caught at `tools/serve.js:112` and turned into a bare 404 for every request. Verified: a
  malformed `_headers` line makes the whole site return 404 with no message.
- Suggested fix: parse `_headers` and `_redirects` at startup and throw, or answer 500 with the
  parse error. Add a case to `tests/serve.test.js`.

### 4. The Sisyphus dialog credits no translator or source

- Where: `index.html:848` through `index.html:868`; `initSisyphus` in `script.js`.
- Why it matters: the Meditations and Art of War dialogs name their translation and link the
  passage. The Camus quote is from a translation that is still under copyright, so attribution
  matters more here, not less.
- Suggested fix: add the translator and edition in the same style as the other dialogs, and a
  source link if a citable page exists. `tests/responsive-home.cjs` asserts the author text, so
  update that assertion if the markup changes.

### 5. Every asset gets an alias redirect

- Where: `tools/lib/site-build.js:159` emits a 302 alias for every manifest entry, including
  fonts, licence files, and each JavaScript module (83 rules in the current build).
- Suggested fix: emit aliases only for files that outside pages may reference by their stable
  path: social cards, favicons and the Apple icon, `favicon.ico`, the downloadable Jeep model,
  and the Bitmotive logo if it is ever hot-linked. Keep the build test green.

### 6. Book cover images are copies from Amazon's image CDN

- Where: `assets/books/*.jpg`; provenance in `assets/books/README.md`.
- Why it matters: the note records that rights stay with publishers, and Amazon's terms do not
  grant redistribution. Risk is low, but it is a decision for Mark, not a code fix.
- Options: keep them with the decision recorded; replace with publisher-supplied images; or link
  to remote images, which would need an `img-src` change in the CSP.

### 7. Git history still carries the archived art

- Where: `.git` is about 39 MB; the archive is a single copy in `../markhammonds-art-archive/`.
- This is Mark's decision: rewrite history now, before more clones exist, and back the archive up
  off this machine; or accept the size permanently. Do not rewrite history without his approval.

### 8. `docs/maintenance-audit.md` will date quickly

- Where: `docs/maintenance-audit.md:76` embeds this run's file counts and suite totals, and the
  table at the top argues against a past review.
- Suggested fix: move the durable decisions into the README, keep the audit as a clearly dated
  record without run-specific counts, or remove it.

## Housekeeping

- [ ] Replace ternaries used as statements with `if`/`else` at `assets/bay-racer/game.js:239`,
      `assets/cici-treat-trail/game.js:193`, `assets/cici-treat-trail/game.js:201`, and
      `assets/surf-rides/game.js:423`.
- [ ] Remove the retired-content assertions at `tests/homepage-smoke.cjs:157` and
      `tests/homepage-smoke.cjs:182`.
- [ ] `desk.html` is development-only, but it still declares a canonical URL that now redirects
      (`desk.html:7`), keeps the old favicon token (`desk.html:42`), and loads its theme script as
      a render-blocking external request (`desk.html:48`). Optional.
- [ ] `assets/surf-rides/preview.svg` is the last unreferenced asset; delete it or add it to the
      archive manifest.
- [ ] The per-game stylesheets still repeat parallel responsive blocks (about 2,900 lines combined
      against 250 shared lines). Optional cleanup, not a defect.

## Keep as is

- Links open in new tabs by Mark's request.
- `style-src 'unsafe-inline'` stays because the scene hotspots use inline custom properties.
- The 200 ms observation window in `tests/game-lifecycle.cjs` is intentional.
- The 10 px minimum for HUD text is acceptable.

## Verify after changes

```sh
npm run check
npm run test:browser
npm run test:browser:production
npx wrangler deploy --dry-run
```

Set `CHROME_BIN` to a local Chrome if the Puppeteer-pinned build is not installed.
