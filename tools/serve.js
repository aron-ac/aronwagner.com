import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.ico': 'image/x-icon',
};

// Local development/test server, deliberately bound to loopback by default.
export function createSiteServer({ root: directory = projectRoot } = {}) {
  const root = resolve(directory);
  const rules = Promise.all(
    ['_headers', '_redirects'].map(async (name) => {
      try {
        return await readFile(resolve(root, name), 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw error;
      }
    }),
  ).then(([headers, redirects]) => ({
    headers: parseHeaders(headers),
    redirects: parseRedirects(
      redirects ||
        (root === resolve(projectRoot) ? '/cr-surf-rides.html /surf-riders.html 301\n' : ''),
    ),
  }));
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      const originalPath = decodeURIComponent(url.pathname);
      let pathname = originalPath;
      const { headers, redirects } = await rules;
      if (['/_headers', '/_redirects'].includes(pathname)) {
        response.writeHead(404).end('Not found');
        return;
      }
      const redirect = redirects.find((rule) => matchesPath(rule.source, pathname));
      if (redirect) {
        const target = new URL(redirect.target, url);
        if (!target.search) target.search = url.search;
        if (redirect.status !== 200) {
          response
            .writeHead(redirect.status, { Location: target.pathname + target.search + target.hash })
            .end();
          return;
        }
        pathname = decodeURIComponent(target.pathname);
      }
      if (pathname.split('/').some((part) => part.startsWith('.') || part === 'node_modules')) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      let filename = resolve(root, `.${pathname}`);
      if (filename !== root && !filename.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      let info = await stat(filename);
      if (info.isDirectory()) {
        filename += `${sep}index.html`;
        info = await stat(filename);
      }
      if (!info.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      let html;
      if (extname(filename) === '.html') {
        const { inlineHomepage } = await import('./lib/inline-homepage.js');
        html = Buffer.from(await inlineHomepage(await readFile(filename, 'utf8')));
      }
      const configuredHeaders = Object.assign(
        {},
        ...headers
          .filter((rule) => matchesPath(rule.path, originalPath))
          .map((rule) => rule.headers),
      );
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(filename)] || 'application/octet-stream',
        'Content-Length': html?.length ?? info.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        ...configuredHeaders,
      });
      if (request.method === 'HEAD') response.end();
      else if (html) response.end(html);
      else
        createReadStream(filename)
          .on('error', () => response.destroy())
          .pipe(response);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: '8000' },
      root: { type: 'string', default: projectRoot },
    },
  });
  const server = createSiteServer({ root: values.root });
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(Number(values.port), '127.0.0.1', () => {
    console.log(`Mark's website: http://localhost:${server.address().port}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

// The build emits only exact routes and trailing-wildcard header rules. Fail
// clearly if that contract grows rather than silently testing different policy.
function matchesPath(pattern, pathname) {
  return pattern.endsWith('*') ? pathname.startsWith(pattern.slice(0, -1)) : pattern === pathname;
}
function parseHeaders(text) {
  const rules = [];
  let current;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      const match = line.trim().match(/^([^:]+):\s*(.*)$/);
      if (!current || !match) throw new Error(`Unsupported _headers line: ${line}`);
      current.headers[match[1]] = match[2];
    } else {
      if (!/^\/[^*]*(?:\*)?$/.test(line)) throw new Error(`Unsupported _headers route: ${line}`);
      current = { path: line, headers: {} };
      rules.push(current);
    }
  }
  return rules;
}
function parseRedirects(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => {
      const [source, target, code, extra] = line.trim().split(/\s+/);
      const status = Number(code);
      if (
        extra ||
        !source.startsWith('/') ||
        !target.startsWith('/') ||
        ![200, 301, 302, 303, 307, 308].includes(status) ||
        source.includes('*')
      ) {
        throw new Error(`Unsupported _redirects rule: ${line}`);
      }
      return { source, target, status };
    });
}
