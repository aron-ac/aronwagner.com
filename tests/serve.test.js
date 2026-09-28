import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSiteServer } from '../tools/serve.js';

test('local production server applies build headers and redirects without exposing tooling files', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mark-site-server-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'immutable', 'hash'), { recursive: true });
  await writeFile(join(directory, 'index.html'), '<!doctype html><h1>Home</h1>');
  await writeFile(join(directory, 'immutable', 'hash', 'app.js'), 'window.loaded=true;');
  await writeFile(
    join(directory, '_headers'),
    "/*\n  Content-Security-Policy: default-src 'self'\n/immutable/*\n  Cache-Control: public, max-age=31536000, immutable\n",
  );
  await writeFile(
    join(directory, '_redirects'),
    '/ /index.html 200\n/desk.html / 301\n/cr-surf-rides.html /surf-riders.html 301\n',
  );
  const server = createSiteServer({ root: directory });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.equal(await home.text(), '<!doctype html><h1>Home</h1>');
  assert.equal(home.headers.get('content-security-policy'), "default-src 'self'");
  assert.equal(home.headers.get('cache-control'), 'no-cache');
  const asset = await fetch(`${base}/immutable/hash/app.js`, { method: 'HEAD' });
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(asset.headers.get('content-security-policy'), "default-src 'self'");
  assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(await asset.text(), '');
  for (const [route, target] of [
    ['desk.html', '/'],
    ['cr-surf-rides.html', '/surf-riders.html'],
  ]) {
    const response = await fetch(`${base}/${route}?debug=1`, { redirect: 'manual' });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), `${target}?debug=1`);
  }
  for (const route of ['_headers', '_redirects', '.git/config', 'node_modules/package.json']) {
    assert.ok([403, 404].includes((await fetch(`${base}/${route}`)).status), `${route} is private`);
  }
  assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
  assert.equal((await fetch(`${base}/missing.html`)).status, 404);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});

test('matching header rules combine duplicate names case-insensitively without merging defaults', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mark-site-header-rules-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'immutable'), { recursive: true });
  await writeFile(join(directory, 'index.html'), '<!doctype html><h1>Home</h1>');
  await writeFile(join(directory, 'immutable', 'app.js'), 'window.loaded=true;');
  await writeFile(
    join(directory, '_headers'),
    [
      '/*',
      '  Cache-Control: public',
      '  X-Robots-Tag: nosnippet',
      '  X-Robots-Tag: noarchive',
      '/immutable/*',
      '  cache-control: max-age=31536000',
      '  x-robots-tag: noindex',
      '/immutable/app.js',
      '  CACHE-CONTROL: immutable',
      '/unrelated/*',
      '  Cache-Control: no-store',
      '',
    ].join('\n'),
  );
  const server = createSiteServer({ root: directory });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.headers.get('cache-control'), 'public', 'One rule replaces the default');
  assert.equal(home.headers.get('x-robots-tag'), 'nosnippet, noarchive');
  const asset = await fetch(`${base}/immutable/app.js`);
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(asset.headers.get('x-robots-tag'), 'nosnippet, noarchive, noindex');
  assert.equal(await asset.text(), 'window.loaded=true;');
});

test('invalid server rules fail synchronously before a server can listen', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mark-site-invalid-rules-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [filename, contents, message] of [
    ['_headers', '/*\n  Missing colon\n', /Unsupported _headers line:.*Missing colon/],
    ['_headers', '/*\n  Invalid Header: value\n', /Invalid _headers line:.*Invalid Header/],
    ['_redirects', '/old.html\n', /Unsupported _redirects rule: \/old.html/],
    ['_redirects', '/old.html /new.html 999\n', /Unsupported _redirects rule:.*999/],
  ]) {
    await writeFile(join(directory, filename), contents);
    assert.throws(() => createSiteServer({ root: directory }), message);
    await rm(join(directory, filename));
  }
});

test('internal serving failures return 500 and retain useful diagnostics', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mark-site-internal-error-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'index.html'), '<script src="unknown.js" data-inline></script>');
  const diagnostics = t.mock.method(console, 'error', () => {});
  const server = createSiteServer({ root: directory });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  assert.equal(response.status, 500);
  assert.equal(await response.text(), 'Internal server error');
  assert.equal(diagnostics.mock.callCount(), 1);
  assert.match(diagnostics.mock.calls[0].arguments[1].message, /Unknown inline script source/);
});

test('source server redirects retired pages while preserving query strings', async (t) => {
  const server = createSiteServer();
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [path, destination] of [
    ['desk.html', '/'],
    ['cr-surf-rides.html', '/surf-riders.html'],
  ]) {
    const response = await fetch(`${base}/${path}?debug=1&return=a%2Fb`, { redirect: 'manual' });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), `${destination}?debug=1&return=a%2Fb`);
  }
});
