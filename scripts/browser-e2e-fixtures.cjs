'use strict';
// Explicit synthetic OCR double. It replaces ONLY the internal model boundary;
// browser -> Nest -> PostgreSQL/storage -> review/publication/export remain real.
const { createServer } = require('node:http');
const { createHash, randomUUID } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { createRequire } = require('node:module');
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

const visibleLines = [
  'QA_ORIGINAL_VALIDADO',
  'Registro de demostracion para prueba automatizada',
  'Prueba tipográfica sin valor asistencial: SatO₂ ± µg ≥ ≤ → ✓',
  'Segunda pagina del documento de prueba',
  'Revision humana requerida antes de publicacion',
  'Fin del original de demostracion',
];

async function createFixtures(runDir) {
  const pages = [];
  for (let page = 0; page < 2; page += 1) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="900"><rect width="1100" height="900" fill="white"/>${visibleLines.slice(page * 3, page * 3 + 3).map((text, i) => `<text x="50" y="${150 + i * 180}" font-family="Arial" font-size="30" fill="#0B1026">${text}</text>`).join('')}</svg>`;
    pages.push(await sharp(Buffer.from(svg)).png().toBuffer());
  }
  const React = require('react');
  const { Document, Page, Image, renderToBuffer } = await import('@react-pdf/renderer');
  const source = await renderToBuffer(React.createElement(Document, { title: 'ClinicView E2E - documento sintetico' },
    ...pages.map((buffer, i) => React.createElement(Page, { key: i, size: 'A4' },
      React.createElement(Image, { src: buffer, style: { width: 550, margin: 20 } })))));
  const attachment = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#E6F2FF"/><rect x="20" y="20" width="120" height="140" fill="#1E40AF"/><circle cx="235" cy="90" r="60" fill="#00C7FF"/><text x="154" y="96" font-size="18" font-family="Arial" fill="#0B1026">QA IMAGEN</text></svg>')).png().toBuffer();
  await Promise.all([writeFile(join(runDir, 'source.pdf'), source), writeFile(join(runDir, 'attachment.png'), attachment)]);
  return { pages, source };
}

async function startOcrDouble(key, fixtures) {
  const jobs = new Map();
  const json = (res, code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  const server = createServer(async (req, res) => {
    try {
      if (req.headers['x-ia-internal-key'] !== key) return json(res, 401, { error: 'Unauthorized test boundary' });
      const artifact = /^\/v1\/artifacts\/([a-f0-9-]+)\/([a-f0-9-]+)\/pages\/([12])\/image$/.exec(req.url);
      if (req.method === 'GET' && artifact) {
        const job = [...jobs.values()].find(j => j.documentId === artifact[1] && j.runId === artifact[2]);
        if (!job) return json(res, 404, {});
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        return res.end(fixtures.pages[Number(artifact[3]) - 1]);
      }
      const route = /^\/v1\/jobs\/([a-f0-9-]{36})(\/result)?$/.exec(req.url);
      if (!route) return json(res, 404, {});
      const id = route[1];
      if (req.method === 'POST' && !route[2]) {
        const chunks = []; let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 30 * 1024 * 1024) return json(res, 413, {});
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const data = Buffer.from(String(body.fileRef).split(',')[1] || '', 'base64');
        if (body.mimeType !== 'application/pdf' || !data.equals(fixtures.source) || createHash('sha256').update(data).digest('hex') !== body.sourceSha256)
          return json(res, 422, { error: 'Only the generated synthetic PDF is accepted' });
        const previous = jobs.get(id);
        if (previous && (previous.documentId !== body.documentId || previous.hash !== body.sourceSha256)) return json(res, 409, {});
        if (previous) previous.submissions += 1;
        else jobs.set(id, { documentId: body.documentId, hash: body.sourceSha256, runId: randomUUID(), createdAt: new Date().toISOString(), createdMs: Date.now(), submissions: 1, polls: 0 });
      } else if (req.method !== 'GET') return json(res, 405, {});
      const job = jobs.get(id);
      if (!job) return json(res, 404, {});
      const complete = Date.now() - job.createdMs >= 3500;
      const lines = visibleLines.map((text, index) => ({
        lineId: `page-${Math.floor(index / 3) + 1}-line-${index % 3 + 1}`,
        text: index === 0 ? 'QA_NO_VALIDADO' : text,
        confidence: 0.8, detectionConfidence: 0.95,
        bbox: [40, 105 + index % 3 * 180, 1060, 170 + index % 3 * 180],
        polygon: [], regionId: null, order: index % 3 + 1,
        warnings: [], recognitionStatus: 'recognized',
      }));
      if (route[2]) {
        if (!complete) return json(res, 409, {});
        return json(res, 200, {
          documentId: job.documentId, processingRunId: job.runId,
          ocr: { text: lines.map(l => l.text).join('\n'), pages: [1, 2].map(page => ({
            page, width: 1100, height: 900, coordinateSpace: 'preprocessed_page_pixels',
            segmentationMethod: 'synthetic_e2e', readingOrderMethod: 'synthetic_e2e',
            lines: lines.slice((page - 1) * 3, page * 3), warnings: [],
          })) },
          entities: [], metrics: null, confidence: { overall: 0.8, level: 'MEDIUM' },
        });
      }
      job.polls += 1;
      return json(res, req.method === 'POST' ? 202 : 200, {
        jobId: id, documentId: job.documentId, sourceSha256: job.hash, attempt: 1,
        status: complete ? 'SUCCEEDED' : req.method === 'POST' ? 'QUEUED' : 'RUNNING',
        processingRunId: job.runId, createdAt: job.createdAt, updatedAt: new Date().toISOString(),
        startedAt: job.createdAt, completedAt: complete ? new Date().toISOString() : null,
        heartbeatAt: new Date().toISOString(), error: null,
        progress: { phase: complete ? 'COMPLETE' : req.method === 'POST' ? 'QUEUED' : 'RECOGNIZING',
          currentPage: complete ? null : 1, pagesTotal: 2, pagesCompleted: complete ? 2 : 0,
          linesTotal: 6, linesCompleted: complete ? 6 : 0, batchesTotal: 2, batchesCompleted: complete ? 2 : 0 },
      });
    } catch { return json(res, 500, { error: 'Synthetic OCR boundary failed' }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8100, '127.0.0.1', resolve); });
  return { server, jobs };
}
module.exports = { createFixtures, startOcrDouble };
