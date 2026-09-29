import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { SITE_ORIGIN, buildSite, pages, rewriteReferences } from '../tools/lib/site-build.js';
import { inlineHomepage } from '../tools/lib/inline-homepage.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('release build resolves immutable assets, secures scripts, and excludes prototypes', async (t) => {
  const output = await mkdtemp(join(tmpdir(), 'site-build-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const result = await buildSite({ root, output });
  const manifest = JSON.parse(await readFile(join(output, 'asset-manifest.json'), 'utf8'));
  assert.deepEqual(manifest, result.manifest);
  for (const [source, destination] of Object.entries(manifest)) {
    assert.match(destination, /^\/immutable\/[a-f0-9]{16}\//, source);
    await access(join(output, destination));
  }
  assert.ok(manifest['assets/shared/arcade.css']);
  assert.ok(manifest['assets/vendor/three/three.core.js']);
  assert.ok(manifest['assets/books/catalog.json']);
  const catalog = JSON.parse(
    await readFile(join(output, manifest['assets/books/catalog.json']), 'utf8'),
  );
  for (const book of catalog) assert.ok(Object.values(manifest).includes(book.cover));
  const script = await readFile(join(output, manifest['script.js']), 'utf8');
  assert.ok(
    script.includes(`fetch('${manifest['assets/books/catalog.json']}')`),
    'Catalog fetch goes directly to its immutable URL',
  );
  const headers = await readFile(join(output, '_headers'), 'utf8');
  for (const header of [
    'Content-Security-Policy',
    'Referrer-Policy',
    'X-Frame-Options',
    'Permissions-Policy',
    'X-Content-Type-Options',
  ]) {
    assert.ok(headers.includes(`${header}:`));
  }
  assert.match(headers, /\/immutable\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  assert.match(result.csp, /object-src 'none'/);
  assert.doesNotMatch(
    result.csp.split(';').find((directive) => directive.trim().startsWith('script-src')),
    /unsafe-inline|unsafe-eval/,
  );
  for (const page of pages) {
    const html = await readFile(join(output, page), 'utf8');
    assert.doesNotMatch(html, /\bdata-inline\b|\?v=/);
    for (const [, attributes, script] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/\bsrc=/.test(attributes) && script.trim()) {
        assert.ok(
          result.csp.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`),
        );
      }
    }
    for (const [, url] of html.matchAll(/(?:src|href|data-entry)="(\/immutable\/[^"#]+)"/g)) {
      assert.ok(Object.values(manifest).includes(url), `${page}: ${url}`);
    }
  }
  const homepage = await readFile(join(output, 'index.html'), 'utf8');
  assert.ok(homepage.indexOf('<style>') < homepage.indexOf('<script>'));
  assert.match(homepage, /getComputedStyle\(root\)/);
  assert.match(homepage, /name="theme-color" content="#[\da-f]+"/i);
  const redirects = await readFile(join(output, '_redirects'), 'utf8');
  assert.match(redirects, /^\/cr-surf-rides.html \/surf-riders.html 301$/m);
  assert.match(redirects, /^\/desk.html \/ 301$/m);
  // The VM's Caddy rules must carry exactly the same redirects and headers.
  const caddy = await readFile(join(output, 'site.caddy'), 'utf8');
  assert.deepEqual(
    [...caddy.matchAll(/^redir (\S+ \S+ \d+)$/gm)].map(([, rule]) => rule),
    redirects.split('\n').filter((rule) => rule && !rule.endsWith(' 200')),
  );
  for (const [, path, block] of headers.matchAll(/^(\/\S*)\n((?: {2}.+\n)+)/gm)) {
    const matcher = path === '/*' ? '' : `${path} `;
    const expected = block
      .trimEnd()
      .split('\n')
      .map((line) => line.trim().replace(/^([\w-]+): (.*)$/, '\t$1 "$2"'));
    assert.ok(caddy.includes(`header ${matcher}{\n${expected.join('\n')}\n}`), `Caddy ${path}`);
  }
  await assert.rejects(access(join(output, 'desk.html')));
  await assert.rejects(access(join(output, 'cr-surf-rides.html')));
  assert.ok(!Object.keys(manifest).some((file) => /desk\.|-source\.png|\.md$/.test(file)));
  const again = await buildSite({ root, output });
  assert.deepEqual(again.manifest, result.manifest, 'Identical inputs yield identical cache URLs');
});

test('theme sources work as external references and inline without duplicate requests', async () => {
  const html = await readFile(join(root, 'index.html'), 'utf8');
  assert.match(
    html,
    /<link\s+rel="stylesheet"\s+href="assets\/homepage\/theme-critical.css"\s+data-inline\s*\/>/,
  );
  assert.match(
    html,
    /<script\s+src="assets\/homepage\/theme-bootstrap.js"\s+data-inline><\/script>/,
  );
  const rendered = inlineHomepage(html);
  assert.doesNotMatch(rendered, /\bdata-inline\b|(?:href|src)="assets\/homepage\/theme-/);
  assert.ok(rendered.indexOf('<style>') < rendered.indexOf('<script>'));
  assert.equal(inlineHomepage(rendered), rendered, 'Built HTML is not transformed again');
  assert.throws(
    () => inlineHomepage('<script src="unknown.js" data-inline></script>'),
    /Unknown inline script source: unknown.js/,
  );
});

test('asset references preserve imports, fragments, srcsets and unrelated URLs', () => {
  const manifest = {
    'assets/shared/input.js': '/immutable/code/assets/shared/input.js',
    'assets/books/catalog.json': '/immutable/code/assets/books/catalog.json',
    'assets/fonts/font.ttf': '/immutable/font/assets/fonts/font.ttf',
    'assets/workstation/scene.webp': '/immutable/image/assets/workstation/scene.webp',
  };
  assert.equal(
    rewriteReferences(
      "import '../shared/input.js'; url('../fonts/font.ttf')",
      'assets/game/game.js',
      manifest,
    ),
    "import '/immutable/code/assets/shared/input.js'; url('/immutable/font/assets/fonts/font.ttf')",
  );
  assert.equal(
    rewriteReferences(
      'assets/workstation/scene.webp 768w, assets/workstation/scene.webp 1536w',
      'index.html',
      manifest,
    ),
    '/immutable/image/assets/workstation/scene.webp 768w, /immutable/image/assets/workstation/scene.webp 1536w',
  );
  assert.equal(
    rewriteReferences(`${SITE_ORIGIN}/assets/workstation/scene.webp#view`, 'index.html', manifest),
    `${SITE_ORIGIN}/immutable/image/assets/workstation/scene.webp#view`,
  );
  assert.equal(
    rewriteReferences('https://example.com/photo.jpg url(#clip)', 'styles.css', manifest),
    'https://example.com/photo.jpg url(#clip)',
  );
});
