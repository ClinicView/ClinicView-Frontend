'use strict';
const { spawn, fork } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const { openSync, closeSync } = require('node:fs');
const { join, resolve } = require('node:path');
const net = require('node:net');
const { createFixtures, startOcrDouble } = require('./browser-e2e-fixtures.cjs');
const root = resolve(__dirname, '..');
const backend = resolve(root, '../ClinicView-Backend');
const { assertSafeBrowserDatabaseUrl } = require(join(backend, 'scripts/browser-e2e-safety.cjs'));
const children = [];
let runDir, ocr, closing;

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} is occupied. Existing services will NOT be reused or stopped.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
function child(script, args, env, cwd, name, ipc = false) {
  const log = openSync(join(runDir, `${name}.log`), 'a', 0o600);
  const options = { cwd, env, windowsHide: true, stdio: ['ignore', log, log, ...(ipc ? ['ipc'] : [])] };
  let proc;
  try { proc = ipc ? fork(script, args, options) : spawn(process.execPath, [script, ...args], options); }
  finally { closeSync(log); }
  children.push(proc);
  const finished = new Promise((resolve, reject) => {
    proc.once('error', reject);
    proc.once('exit', code => code === 0 ? resolve() : reject(new Error(`${name} exited ${code}; inspect private log ${join(runDir, `${name}.log`)}`)));
  });
  finished.catch(() => undefined);
  return { proc, finished };
}
async function waitReady(check, proc, description) {
  const until = Date.now() + 180_000;
  while (Date.now() < until) {
    if (proc.exitCode !== null || proc.signalCode) throw new Error(`${description} exited before readiness.`);
    try { if (await check()) return; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`${description} did not become ready; inspect the private logs.`);
}
async function cleanup() {
  if (closing) return closing;
  closing = (async () => {
    for (const proc of [...children].reverse()) {
      if (proc.exitCode !== null || proc.signalCode) continue;
      if (proc.connected) proc.send('shutdown');
      else proc.kill('SIGTERM');
      await Promise.race([new Promise(resolve => proc.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 15000))]);
      if (proc.exitCode === null && !proc.signalCode) proc.kill();
    }
    if (ocr) { ocr.server.closeAllConnections(); await new Promise(resolve => ocr.server.close(resolve)); }
  })();
  return closing;
}
async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) throw new Error('Browser/PDF tests require Node 22.13+ or Node 24+.');
  const databaseUrl = assertSafeBrowserDatabaseUrl();
  await Promise.all([3110, 3101, 8100].map(requireFreePort));
  // Keep Next and its dependency junction on one Windows drive; webpack cannot
  // relativize a client entry from C: to node_modules on D:. Never reuse .next.
  const runsRoot = join(root, '.browser-e2e-runs');
  await fs.mkdir(runsRoot, { recursive: true });
  runDir = await fs.mkdtemp(join(runsRoot, 'clinicview-browser-e2e-'));
  console.log(`Isolated synthetic run: ${runDir}`);
  const key = randomBytes(40).toString('hex');
  const env = { ...process.env, BROWSER_E2E_RUN_DIR: runDir, BROWSER_E2E_DATABASE_URL: databaseUrl,
    NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:3110', IA_INTERNAL_URL: 'http://127.0.0.1:8100',
    IA_INTERNAL_API_KEY: key, NEXT_PUBLIC_API_URL: 'http://localhost:3101/api', NEXT_TELEMETRY_DISABLED: '1',
    JWT_SECRET: randomBytes(40).toString('hex'), JWT_REFRESH_SECRET: randomBytes(40).toString('hex'), AUDIT_HASH_SECRET: randomBytes(40).toString('hex'),
  };
  const fixtures = await createFixtures(runDir);
  ocr = await startOcrDouble(key, fixtures);
  const api = child(join(backend, 'scripts/browser-e2e-server.cjs'), [], env, backend, 'backend', true);
  const copy = join(runDir, 'frontend');
  await fs.mkdir(copy);
  // Selective source snapshot: no .env, .git, existing .next, uploads or credentials.
  for (const name of ['src', 'public', 'package.json', 'next.config.ts', 'tsconfig.json', 'next-env.d.ts'])
    await fs.cp(join(root, name), join(copy, name), { recursive: true });
  await fs.symlink(join(root, 'node_modules'), join(copy, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const build = child(join(root, 'node_modules/next/dist/bin/next'), ['build', copy, '--webpack'], { ...env, NODE_ENV: 'production' }, copy, 'frontend-build');
  console.log('Building an isolated production frontend and preparing a dedicated PostgreSQL schema...');
  await Promise.all([build.finished, waitReady(async () => {
    const manifest = JSON.parse(await fs.readFile(join(runDir, 'backend-manifest.json'), 'utf8'));
    return manifest.ready === true && manifest.pid === api.proc.pid;
  }, api.proc, 'Backend')]);
  const web = child(join(__dirname, 'browser-e2e-next.cjs'), [], { ...env, NODE_ENV: 'production' }, root, 'frontend', true);
  await waitReady(async () => (await fetch('http://localhost:3110/login', { signal: AbortSignal.timeout(3000) })).ok, web.proc, 'Frontend');
  console.log('Running browser -> real backend/storage -> reviewed publication -> downloaded PDF checks. OCR boundary is synthetic.');
  const tests = spawn(process.execPath, [join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.config.ts', ...process.argv.slice(2)],
    { cwd: root, env, windowsHide: true, stdio: 'inherit' });
  children.push(tests);
  const code = await new Promise((resolve, reject) => { tests.once('error', reject); tests.once('exit', resolve); });
  const stats = [...ocr.jobs.entries()].map(([jobId, job]) => ({ jobId, documentId: job.documentId, submissions: job.submissions, polls: job.polls }));
  await fs.writeFile(join(runDir, 'ocr-boundary-stats.json'), JSON.stringify({ synthetic: true, jobs: stats }, null, 2));
  if (stats.some(job => job.submissions !== 1)) throw new Error('Duplicate OCR submissions detected at the internal boundary.');
  if (code !== 0) throw new Error(`Browser suite failed (${code}). Evidence retained under ${runDir}.`);
  if (stats.length !== 2) throw new Error('The complete suite must exercise exactly two OCR jobs, including the unvalidated control.');
  console.log(`PASS. Synthetic PDF, screenshots and diagnostics retained privately under ${runDir}.`);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void cleanup().finally(() => process.exit(1)));
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(cleanup);
