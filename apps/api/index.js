const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const { createSecurity, asyncRoute } = require('./security');
const { createAsyncStore } = require('./async-store');
const { createLocalImageStore } = require('./image-store');
const { HttpError } = require('./http');
const { validId } = require('./validation');
const { registerOperations } = require('./operations');
const { registerWorkforce } = require('./modules/workforce');
const { registerCatalog } = require('./modules/catalog');
const { registerFinance } = require('./modules/finance');
const { registerCommunications } = require('./modules/communications');
const { registerEvents } = require('./modules/events');
const { registerTasks } = require('./modules/tasks');
const { registerHandover } = require('./modules/handover');
const { registerDocuments } = require('./modules/documents');
const { createDocumentStore } = require('./document-store');
const { registerAi } = require('./modules/ai');
const { registerWeb } = require('./web-serving');

function createApp({ db, origins = ['http://localhost:5173', 'http://127.0.0.1:5173'], uploadsDir, documentsDir, webDir, imageStore, aiEnabled = false }) {
  db = createAsyncStore(db);
  const app = express();
  const { requireAuth, requireRole, register } = createSecurity(db);
  const logger = (level, message) => { if (level === 'error') console.error(message); };
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
    const origin = req.get('origin');
    if (origin && !origins.includes(origin)) return res.status(403).json({ error: 'Origen no permitido.' });
    next();
  });
  app.use(cors({ origin: origins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'] }));
  app.post('/api/documentos', requireAuth, requireRole(['owner','manager']), express.json({ limit: '15mb' }));
  app.use(express.json({ limit: '6mb' }));
  app.use('/api', (req, res, next) => {
    if (Object.values(req.query).some(value => typeof value !== 'string')) return res.status(400).json({ error: 'Parámetros de consulta inválidos.' });
    if (req.body === null || Array.isArray(req.body)) return res.status(400).json({ error: 'El cuerpo debe ser un objeto JSON.' });
    if (req.body === undefined && (Number(req.get('content-length')) > 0 || req.get('transfer-encoding'))) return res.status(400).json({ error: 'El cuerpo debe enviarse como un objeto application/json.' });
    req.body ??= {};
    next();
  });
  app.param('id', (req, res, next, value) => {
    if (!validId(value)) return res.status(400).json({ error: 'Identificador inválido.' });
    next();
  });
  app.use((req, res, next) => {
    db.ready.then(() => next(), () => res.status(503).json({ error: 'Base de datos no disponible.' }));
  });
  app.get('/api/health', asyncRoute(async (req, res) => {
    (await db.connection.prepare('SELECT 1').get());
    res.json({ status: 'ready' });
  }));
  register(app);
  registerOperations(app, db, { requireAuth, requireRole });
  if (uploadsDir) {
    if (imageStore) throw new Error('Choose one image store; local fallback is not supported.');
    fs.mkdirSync(uploadsDir, { recursive: true });
    imageStore = createLocalImageStore(uploadsDir);
    app.use('/uploads', express.static(uploadsDir, { dotfiles: 'deny', index: false }));
  }
  const documentStore = documentsDir ? createDocumentStore(documentsDir, uploadsDir) : undefined;
  const context = { db, requireAuth, requireRole, imageStore, documentStore, logger, aiEnabled };
  registerWorkforce(app, context);
  registerCatalog(app, context);
  registerFinance(app, context);
  registerCommunications(app, context);
  registerEvents(app, context);
  registerTasks(app, context);
  registerHandover(app, context);
  registerDocuments(app, context);
  registerAi(app, context);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
  if (webDir) registerWeb(app, webDir, [documentsDir, uploadsDir]);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'El archivo es demasiado grande.' : status === 400 ? 'JSON inválido.' : 'No se pudo completar la operación.' });
  });
  return app;
}
module.exports = { createApp };
