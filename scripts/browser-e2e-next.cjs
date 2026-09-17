'use strict';
// Run Next in this owned process so IPC shutdown never kills a user's server.
const { createServer } = require('node:http');
const { resolve } = require('node:path');
const next = require('next');
const dir = resolve(process.env.BROWSER_E2E_RUN_DIR, 'frontend');
const app = next({ dev: false, dir, hostname: 'localhost', port: 3110 });
let server;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server?.closeAllConnections();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
  await app.close();
  process.exit(0);
}
process.on('message', message => { if (message === 'shutdown') void close(); });
process.on('disconnect', () => void close());
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
app.prepare().then(() => {
  server = createServer(app.getRequestHandler());
  server.listen(3110, '127.0.0.1', () => process.send?.({ ready: true }));
}).catch(() => { console.error('Isolated Next server failed to start.'); process.exit(1); });
