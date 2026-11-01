import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { config, business } from './config.js';
import { createStore, openDb } from './db.js';
import { readSession } from './auth.js';
import { icon } from './icons.js';
import * as format from './format.js';
import * as whatsapp from './whatsapp.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp({ dataDir = config.dataDir, settings = config } = {}) {
  const db = openDb(dataDir);
  const store = createStore(db);
  // Con la base en memoria (tests) las fotos van a una carpeta temporal.
  const uploadsDir = dataDir === ':memory:' ? fs.mkdtempSync(path.join(os.tmpdir(), 'carlitos-')) : path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const app = express();
  app.locals.store = store;
  app.locals.uploadsDir = uploadsDir;
  app.locals.settings = settings;

  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));
  app.set('trust proxy', settings.isProduction ? 1 : false);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    next();
  });

  app.use('/static', express.static(path.join(root, 'public'), { maxAge: settings.isProduction ? '7d' : 0 }));
  app.use('/fotos', express.static(uploadsDir, { maxAge: '30d', immutable: true }));

  // Helpers y datos disponibles en todas las vistas.
  app.use((req, res, next) => {
    const baseUrl = settings.siteUrl || `${req.protocol}://${req.get('host')}`;
    const adminId = readSession(req, settings.sessionSecret);
    req.admin = adminId ? store.getAdmin(adminId) : null;
    Object.assign(res.locals, {
      business,
      icon,
      format,
      wa: whatsapp,
      waNumber: settings.whatsappNumber,
      phoneLabel: whatsapp.displayPhone(settings.whatsappNumber),
      path: req.path,
      baseUrl,
      absoluteUrl: (p) => baseUrl + p,
      carUrl: (car) => `/autos/${car.id}-${format.slugify(`${car.brand} ${car.model} ${car.year}`)}`,
      photoUrl: (filename) => `/fotos/${filename}`,
      admin: req.admin,
      meta: {},
    });
    next();
  });

  app.use('/admin', adminRoutes);
  app.use('/', publicRoutes);

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Página no encontrada', message: 'Esta página no existe o el auto ya no está publicado.' });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).render('error', {
      title: 'Algo salió mal',
      message: err.expose ? err.message : 'Hubo un error inesperado. Probá de nuevo en un rato.',
    });
  });

  return app;
}
