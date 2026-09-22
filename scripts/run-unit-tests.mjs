import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? findTests(path)
      : entry.name.endsWith('.test.ts')
        ? [path]
        : [];
  });
}
const tests = findTests(join(root, 'src')).sort();
if (!tests.length) throw new Error('No unit tests found.');
// A local server may be using .next. Allow tests to compile elsewhere without
// touching its production build, generated types or the developer's next-env.d.ts.
const outputDirectory = resolve(root, process.env.CLINICVIEW_UNIT_TEST_OUTPUT || '.next/unit-tests');
const compiled = spawnSync(
  process.execPath,
  [
    join(root, 'node_modules/typescript/bin/tsc'),
    '--rootDir',
    'src',
    '--outDir',
    outputDirectory,
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--target',
    'ES2022',
    '--noEmit',
    'false',
    '--incremental',
    'false',
    '--isolatedModules',
    'false',
    '--skipLibCheck',
    ...tests,
  ],
  { cwd: root, stdio: 'inherit' },
);
if (compiled.status !== 0) process.exit(compiled.status ?? 1);
const result = spawnSync(
  process.execPath,
  [
    '--test',
    ...tests.map((file) =>
      join(
        outputDirectory,
        relative(join(root, 'src'), file).replace(/\.ts$/, '.js'),
      ),
    ),
  ],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
