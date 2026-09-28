import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createSiteServer } from './serve.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const { values, positionals } = parseArgs({
  options: { root: { type: 'string', default: projectRoot } },
  allowPositionals: true,
});
const tests = join(projectRoot, 'tests');
const built = resolve(values.root) !== resolve(projectRoot);
const suites = positionals.length
  ? positionals.map((name) => {
      const filename = resolve(tests, name);
      if (dirname(filename) !== tests || !filename.endsWith('.cjs')) {
        throw new Error(`Expected a browser suite filename within tests/: ${name}`);
      }
      return filename;
    })
  : (await readdir(tests))
      .filter((name) => !built || name !== 'desk-smoke.cjs')
      .filter((name) =>
        /(?:-smoke|^responsive-.+|^homepage-theme-load|^game-lifecycle)\.cjs$/.test(name),
      )
      .sort()
      .map((name) => join(tests, name));

const artifactRoot = resolve(process.env.TEST_ARTIFACT_DIR || join(projectRoot, 'test-results'));
await mkdir(artifactRoot, { recursive: true });
const artifacts = await mkdtemp(join(artifactRoot, 'browser-'));
const server = createSiteServer({ root: resolve(values.root) });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseURL = `http://127.0.0.1:${server.address().port}/`;
console.log(`Browser test server: ${baseURL} (${resolve(values.root)})`);
console.log(`Artifacts: ${artifacts}`);
let child;
const stop = (signal) => child?.kill(signal);
const interrupt = () => stop('SIGINT');
const terminate = () => stop('SIGTERM');
process.once('SIGINT', interrupt);
process.once('SIGTERM', terminate);
try {
  child = spawn(
    process.execPath,
    ['--test', '--test-concurrency=1', '--test-reporter=spec', ...suites],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        SITE_URL: baseURL,
        TEST_ARTIFACT_DIR: artifacts,
        SITE_BUILT: built ? '1' : '',
      },
    },
  );
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) {
    if (signal) console.error(`Browser tests interrupted by ${signal}`);
    process.exitCode = code || 1;
  }
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', terminate);
}
