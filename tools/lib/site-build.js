import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, posix, resolve } from 'node:path';
import { inlineHomepage } from './inline-homepage.js';

export const SITE_ORIGIN = 'https://aronwagner.com';
export const pages = ['index.html', 'surf-riders.html', 'bay-racer.html', 'cici-treat-trail.html'];
const textExtensions = new Set(['.js', '.css', '.json']);
const digest = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);

async function runtimeFiles(root) {
  const files = new Set([
    ...pages,
    'script.js',
    'styles.css',
    'favicon.ico',
    'assets/favicon.svg',
    'assets/favicon-32.png',
    'assets/favicon-48.png',
    'assets/apple-touch-icon.png',
    'assets/brand/american-cloud-icon.svg',
    'assets/vendor/three/three.module.js',
    'assets/vendor/three/three.core.js',
    'assets/vendor/three/LICENSE',
  ]);
  async function include(directory, extensions) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const filename = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await include(filename, extensions);
      else if (entry.isFile() && extensions.includes(extname(entry.name))) files.add(filename);
    }
  }
  await include('assets/fonts', ['.ttf', '.txt']);
  await include('assets/polaroids', ['.jpg']);
  await include('assets/books', ['.jpg', '.json']);
  await include('assets/social', ['.jpg']);
  for (const directory of ['shared', 'surf-rides', 'bay-racer', 'cici-treat-trail']) {
    await include(`assets/${directory}`, ['.js', '.css', '.webp', '.glb']);
  }
  for (const filename of [
    'office-day.webp',
    'office-day-small.webp',
    'office-day-v2.webp',
    'office-day-v2-small.webp',
    'office-night-v2.webp',
    'office-night-v2-small.webp',
    'avatar-day-v4.webp',
    'avatar-night-v4.webp',
    'tattoo-day-v5.webp',
    'tampa-bay-screens.webp',
    'wall-safe-day.svg',
    'wall-safe-night.svg',
  ])
    files.add(`assets/workstation/${filename}`);
  return [...files].sort();
}

// Sources use static relative URLs. Rewrite only references present in the
// runtime manifest, including srcset entries, module imports, CSS and catalog URLs.
const referencePattern = new RegExp(
  String.raw`(?:${SITE_ORIGIN.replaceAll('.', '\\.')}\/|(?:\.\.?\/)+|\/)?[\w-][\w./-]*\.(?:json|js|css|jpg|jpeg|png|webp|svg|ttf|woff2|glb|ico)(?![\w.-])(?:\?v=[\w-]+)?(?:#[\w-]+)?`,
  'g',
);

export function rewriteReferences(text, filename, manifest) {
  return text.replace(referencePattern, (reference) => {
    const absolute = reference.startsWith(`${SITE_ORIGIN}/`);
    const local = reference.replace(`${SITE_ORIGIN}/`, '').replace(/^\//, '');
    const [withoutHash, fragment] = local.split('#');
    const clean = withoutHash.replace(/\?v=[\w-]+$/, '');
    const relative = posix.normalize(posix.join(posix.dirname(filename), clean));
    const destination = manifest[clean] || manifest[relative];
    if (!destination) return reference;
    return `${absolute ? SITE_ORIGIN : ''}${destination}${fragment ? `#${fragment}` : ''}`;
  });
}

export async function buildSite({ root, output }) {
  if (resolve(root) === resolve(output))
    throw new Error('Build output cannot replace the source directory');
  const transformHash = digest(await readFile(new URL('./site-build.js', import.meta.url)));
  const filenames = await runtimeFiles(root);
  // Read and validate the complete set before replacing the generated directory.
  const sources = new Map(
    await Promise.all(
      filenames.map(async (filename) => {
        const bytes = await readFile(join(root, filename));
        return [
          filename,
          extname(filename) === '.html' ? Buffer.from(inlineHomepage(bytes.toString())) : bytes,
        ];
      }),
    ),
  );
  const manifest = {};
  const vendor = filenames.filter((file) => file.startsWith('assets/vendor/'));
  const cohortHash = (entries) =>
    digest(Buffer.concat(entries.flatMap((file) => [Buffer.from(`${file}\0`), sources.get(file)])));
  const vendorHash = digest(`${cohortHash(vendor)}\0${transformHash}`);
  const code = filenames.filter(
    (file) => textExtensions.has(extname(file)) && !vendor.includes(file),
  );
  for (const filename of filenames) {
    if (pages.includes(filename) || code.includes(filename)) continue;
    const hash = vendor.includes(filename) ? vendorHash : digest(sources.get(filename));
    manifest[filename] = `/immutable/${hash}/${filename}`;
  }
  // Version the small application graph together so relative module dependencies
  // and their referenced assets always change atomically. Large vendor, image and
  // font files retain independent hashes across unrelated code releases.
  const codeHash = digest(`${cohortHash(code)}\0${JSON.stringify(manifest)}\0${transformHash}`);
  for (const filename of code) manifest[filename] = `/immutable/${codeHash}/${filename}`;

  const emitted = new Map();
  for (const [filename, bytes] of sources) {
    const textual = textExtensions.has(extname(filename)) || pages.includes(filename);
    const contents = textual
      ? Buffer.from(rewriteReferences(bytes.toString(), filename, manifest))
      : bytes;
    emitted.set(manifest[filename]?.slice(1) || filename, contents);
  }
  const inlineHashes = [];
  for (const page of pages) {
    const html = emitted.get(page).toString();
    for (const [, attributes, script] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/\bsrc=/.test(attributes) && script.trim()) {
        inlineHashes.push(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
      }
    }
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(inlineHashes)].join(' ')} https://static.cloudflareinsights.com`,
    // The illustrated scene and dynamic game HUD use element style properties.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  const headers = [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  X-Frame-Options: DENY',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '',
    '/immutable/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
  const redirects = [
    '/cr-surf-rides.html /surf-riders.html 301',
    '/desk.html / 301',
    '/ /index.html 200',
    // Mutable aliases support previously shared social images and already-open
    // pages. New HTML always points directly at immutable assets.
    ...Object.entries(manifest).map(([source, destination]) => `/${source} ${destination} 302`),
    '',
  ].join('\n');
  emitted.set('_headers', Buffer.from(headers));
  emitted.set('_redirects', Buffer.from(redirects));
  emitted.set('asset-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  await rm(output, { recursive: true, force: true });
  for (const [filename, bytes] of emitted) {
    const destination = join(output, filename);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  const bytes = [...emitted.values()].reduce((sum, buffer) => sum + buffer.length, 0);
  return { files: emitted.size, bytes, manifest, csp };
}
