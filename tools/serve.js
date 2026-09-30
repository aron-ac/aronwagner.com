import { createServer, validateHeaderName, validateHeaderValue } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
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
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// Local development/test server, deliberately bound to loopback by default.
export function createSiteServer({ root: directory = projectRoot } = {}) {
  const root = resolve(directory);
  // Read the two small configuration files before listening. A bad rule must fail
  // startup instead of becoming a misleading 404 or an unhandled rejection.
  function readRules(name) {
    try {
      return readFileSync(resolve(root, name), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return '';
      throw new Error(`Could not read ${name}: ${error.message}`, { cause: error });
    }
  }
  const headers = parseHeaders(readRules('_headers'));
  const redirects = parseRedirects(
    readRules('_redirects') ||
      (root === resolve(projectRoot)
        ? '/cr-surf-rides.html /surf-riders.html 301\n/desk.html / 301\n'
        : ''),
  );
  // Missing pages get the site's 404 page when the served root has one, as in production.
  async function notFound(response) {
    try {
      const page = await readFile(resolve(root, '404.html'));
      response.writeHead(404, { 'content-type': mimeTypes['.html'] }).end(page);
    } catch {
      response.writeHead(404).end('Not found');
    }
  }

  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      const originalPath = decodeURIComponent(url.pathname);
      let pathname = originalPath;
      if (['/_headers', '/_redirects'].includes(pathname)) {
        await notFound(response);
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
        await notFound(response);
        return;
      }
      let html;
      if (extname(filename) === '.html') {
        const { inlineHomepage } = await import('./lib/inline-homepage.js');
        const source = await readFile(filename, 'utf8');
        try {
          html = Buffer.from(inlineHomepage(source));
        } catch (error) {
          // A missing template dependency is an internal failure, even if its
          // filesystem error is ENOENT; the requested page itself exists.
          throw new Error(`Could not render ${originalPath}: ${error.message}`, { cause: error });
        }
      }
      // Cloudflare combines repeated custom headers across matching rules. Keep
      // defaults separate so one configured header replaces, rather than appends
      // to, the default value. Headers handles case-insensitive names and joins.
      const configuredHeaders = new Headers();
      for (const rule of headers) {
        if (!matchesPath(rule.path, originalPath)) continue;
        for (const [name, value] of rule.headers) configuredHeaders.append(name, value);
      }
      response.writeHead(200, {
        'content-type': mimeTypes[extname(filename)] || 'application/octet-stream',
        'content-length': html?.length ?? info.size,
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
        ...Object.fromEntries(configuredHeaders),
      });
      if (request.method === 'HEAD') response.end();
      else if (html) response.end(html);
      else
        createReadStream(filename)
          .on('error', () => response.destroy())
          .pipe(response);
    } catch (error) {
      if (error instanceof URIError || error.code === 'ERR_INVALID_URL')
        response.writeHead(400).end('Bad request');
      else if (['ENOENT', 'ENOTDIR'].includes(error.code)) await notFound(response);
      else if (['EACCES', 'EPERM'].includes(error.code)) response.writeHead(403).end('Forbidden');
      else {
        console.error(`Failed to serve ${request.url}:`, error);
        response.writeHead(500).end('Internal server error');
      }
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
    console.log(`Aron's website: http://localhost:${server.address().port}`);
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
      try {
        validateHeaderName(match[1]);
        validateHeaderValue(match[1], match[2]);
      } catch (error) {
        throw new Error(`Invalid _headers line: ${line}`, { cause: error });
      }
      current.headers.push([match[1], match[2]]);
    } else {
      if (!/^\/[^*]*(?:\*)?$/.test(line)) throw new Error(`Unsupported _headers route: ${line}`);
      current = { path: line, headers: [] };
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
        !source?.startsWith('/') ||
        !target?.startsWith('/') ||
        ![200, 301, 302, 303, 307, 308].includes(status) ||
        source.includes('*')
      ) {
        throw new Error(`Unsupported _redirects rule: ${line}`);
      }
      return { source, target, status };
    });
}
