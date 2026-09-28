import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './lib/site-build.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await buildSite({ root, output: join(root, 'dist') });
console.log(
  `Prepared ${result.files} runtime files (${(result.bytes / 1024 / 1024).toFixed(2)} MiB) in dist/.`,
);
