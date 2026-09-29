import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createSiteServer } from './serve.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const { values, positionals } = parseArgs({
  // --url targets an already running server (such as Caddy) instead of serving --root.
  // --shard k/n runs the kth of n balanced groups, for parallel CI jobs.
  options: {
    root: { type: 'string', default: projectRoot },
    url: { type: 'string' },
    shard: { type: 'string' },
    list: { type: 'boolean', default: false },
  },
  allowPositionals: true,
});
const tests = join(projectRoot, 'tests');
const discovered = positionals.length
  ? positionals.map((name) => {
      const filename = resolve(tests, name);
      if (dirname(filename) !== tests || !filename.endsWith('.cjs')) {
        throw new Error(`Expected a browser suite filename within tests/: ${name}`);
      }
      return filename;
    })
  : (await readdir(tests))
      .filter((name) =>
        /(?:-smoke|^responsive-.+|^homepage-theme-load|^game-lifecycle)\.cjs$/.test(name),
      )
      .sort()
      .map((name) => join(tests, name));
const suites = values.shard ? shard(discovered, values.shard) : discovered;
if (values.list) {
  console.log(suites.map((file) => file.slice(tests.length + 1)).join('\n'));
  process.exit(0);
}

// Approximate seconds per suite on a hosted runner with software WebGL. Unlisted
// suites count as 30s, so new suites are always assigned to some shard.
function shard(files, spec) {
  const [index, count] = spec.split('/').map(Number);
  if (!(Number.isInteger(index) && Number.isInteger(count) && index >= 1 && index <= count)) {
    throw new Error(`Expected --shard k/n with 1 <= k <= n: ${spec}`);
  }
  const seconds = {
    'responsive-bay.cjs': 117,
    'bay-racer-smoke.cjs': 100,
    'responsive-surf.cjs': 82,
    'surf-rides-smoke.cjs': 79,
    'responsive-home.cjs': 43,
    'homepage-smoke.cjs': 33,
  };
  const weight = (file) => seconds[file.slice(tests.length + 1)] ?? 30;
  // Longest first, each onto the currently lightest shard.
  const groups = Array.from({ length: count }, () => ({ total: 0, files: [] }));
  for (const file of [...files].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
    const lightest = groups.reduce((min, group) => (group.total < min.total ? group : min));
    lightest.total += weight(file);
    lightest.files.push(file);
  }
  return groups[index - 1].files.sort();
}

const artifactRoot = resolve(process.env.TEST_ARTIFACT_DIR || join(projectRoot, 'test-results'));
await mkdir(artifactRoot, { recursive: true });
const artifacts = await mkdtemp(join(artifactRoot, 'browser-'));
let server;
let baseURL = values.url && new URL(values.url).href;
if (baseURL) {
  console.log(`Browser test target: ${baseURL}`);
} else {
  server = createSiteServer({ root: resolve(values.root) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseURL = `http://127.0.0.1:${server.address().port}/`;
  console.log(`Browser test server: ${baseURL} (${resolve(values.root)})`);
}
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
      },
    },
  );
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) {
    if (signal) console.error(`Browser tests interrupted by ${signal}`);
    process.exitCode = code || 1;
  }
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', terminate);
}
