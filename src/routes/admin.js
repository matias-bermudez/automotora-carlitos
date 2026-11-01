import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express, { Router } from 'express';
import multer from 'multer';

import { BODY_TYPES, FUELS, STATUSES, TRANSMISSIONS } from '../db.js';
import { clearSessionCookie, createLoginLimiter, createSessionCookie, verifyPassword } from '../auth.js';
import { parseInteger } from '../format.js';

const router = Router();
const limiter = createLoginLimiter();

const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_PHOTOS = 30;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, req.app.locals.uploadsDir),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + PHOTO_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => cb(null, Boolean(PHOTO_TYPES[file.mimetype])),
});

function removeFiles(dir, filenames) {
  for (const name of filenames) fs.rm(path.join(dir, path.basename(name)), { force: true }, () => {});
}

router.use(express.urlencoded({ extended: false, limit: '200kb' }));

// Rechaza formularios enviados desde otros sitios (además de la cookie SameSite=Strict).
router.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const origin = req.get('origin');
  if (origin && new URL(origin).host !== req.get('host')) return res.status(403).send('Origen no permitido');
  next();
});

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.locals.meta = { title: 'Admin', noindex: true };
  next();
});

// ---------- Login ----------

router.get('/login', (req, res) => {
  if (req.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null, username: '' });
});

router.post('/login', (req, res) => {
  const { store, settings } = req.app.locals;
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (limiter.blocked(req.ip)) {
    return res.status(429).render('admin/login', { error: 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.', username });
  }
  const admin = store.findAdmin(username);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    limiter.fail(req.ip);
    return res.status(401).render('admin/login', { error: 'Usuario o contraseña incorrectos.', username });
  }
  limiter.reset(req.ip);
  res.set('Set-Cookie', createSessionCookie(admin.id, { secret: settings.sessionSecret, secure: settings.isProduction }));
  res.redirect('/admin');
});

router.post('/salir', (req, res) => {
  res.set('Set-Cookie', clearSessionCookie());
  res.redirect('/admin/login');
});

// ---------- Todo lo que sigue requiere sesión ----------

router.use((req, res, next) => {
  if (!req.admin) return res.redirect('/admin/login');
  next();
});

router.get('/', (req, res) => {
  const { store } = req.app.locals;
  const status = STATUSES.includes(req.query.estado) ? req.query.estado : '';
  res.render('admin/cars', {
    cars: store.listCars(status),
    counts: store.statusCounts(),
    status,
    statuses: STATUSES,
    notice: req.query.ok || '',
  });
});

const EMPTY_CAR = {
  brand: '', model: '', year: new Date().getFullYear(), km: '', price: '', fuel: 'Nafta', transmission: 'Manual',
  body_type: 'Hatch', engine: '', color: '', doors: '', badge: '', description: '', equipment: '', status: 'disponible', featured: 0,
  photos: [],
};

function renderForm(res, car, errors = [], status = 200) {
  res.status(status).render('admin/car-form', {
    car,
    errors,
    statuses: STATUSES,
    bodyTypes: BODY_TYPES,
    fuels: FUELS,
    transmissions: TRANSMISSIONS,
    maxPhotos: MAX_PHOTOS,
  });
}

function parseCar(body) {
  const text = (v, max = 120) => String(v ?? '').trim().slice(0, max);
  const car = {
    brand: text(body.brand, 40),
    model: text(body.model, 80),
    year: parseInteger(body.year),
    km: parseInteger(body.km) ?? 0,
    price: parseInteger(body.price),
    fuel: text(body.fuel),
    transmission: text(body.transmission),
    body_type: text(body.body_type),
    engine: text(body.engine, 40),
    color: text(body.color, 40),
    doors: parseInteger(body.doors),
    badge: text(body.badge, 30),
    description: text(body.description, 4000),
    equipment: text(body.equipment, 2000),
    status: text(body.status),
    featured: body.featured ? 1 : 0,
  };
  const maxYear = new Date().getFullYear() + 1;
  const errors = [];
  if (!car.brand) errors.push('Falta la marca.');
  if (!car.model) errors.push('Falta el modelo.');
  if (!car.year || car.year < 1950 || car.year > maxYear) errors.push(`El año tiene que estar entre 1950 y ${maxYear}.`);
  if (!FUELS.includes(car.fuel)) errors.push('Elegí un combustible de la lista.');
  if (!TRANSMISSIONS.includes(car.transmission)) errors.push('Elegí la transmisión.');
  if (!BODY_TYPES.includes(car.body_type)) errors.push('Elegí el tipo de auto.');
  if (!STATUSES.includes(car.status)) errors.push('Estado inválido.');
  if (car.doors && (car.doors < 2 || car.doors > 5)) errors.push('Las puertas tienen que ser entre 2 y 5.');
  return { car, errors };
}

const toIdList = (v) => [].concat(v ?? []).map(Number).filter(Number.isInteger);

router.get('/autos/nuevo', (req, res) => renderForm(res, EMPTY_CAR));

router.post('/autos', upload.array('photos', MAX_PHOTOS), (req, res) => {
  const { store, uploadsDir } = req.app.locals;
  const files = (req.files || []).map((f) => f.filename);
  const { car, errors } = parseCar(req.body);
  if (errors.length) {
    removeFiles(uploadsDir, files);
    return renderForm(res, { ...car, photos: [] }, errors, 422);
  }
  const id = store.createCar(car);
  store.addPhotos(id, files);
  res.redirect(`/admin?ok=${encodeURIComponent(`Se guardó ${car.brand} ${car.model}.`)}`);
});

router.get('/autos/:id', (req, res, next) => {
  const car = req.app.locals.store.getCar(Number(req.params.id));
  if (!car) return next();
  renderForm(res, car);
});

router.post('/autos/:id', upload.array('photos', MAX_PHOTOS), (req, res, next) => {
  const { store, uploadsDir } = req.app.locals;
  const id = Number(req.params.id);
  const existing = store.getCar(id);
  const files = (req.files || []).map((f) => f.filename);
  if (!existing) {
    removeFiles(uploadsDir, files);
    return next();
  }
  const { car, errors } = parseCar(req.body);
  if (errors.length) {
    removeFiles(uploadsDir, files);
    return renderForm(res, { ...car, id, photos: existing.photos }, errors, 422);
  }
  store.updateCar(id, car);
  removeFiles(uploadsDir, store.deletePhotos(id, toIdList(req.body.delete_photo)));
  const room = Math.max(0, MAX_PHOTOS - store.getCar(id).photos.length);
  store.addPhotos(id, files.slice(0, room));
  removeFiles(uploadsDir, files.slice(room));
  const cover = Number(req.body.cover);
  if (cover) store.setCover(id, cover);
  res.redirect(`/admin?ok=${encodeURIComponent(`Se actualizó ${car.brand} ${car.model}.`)}`);
});

router.post('/autos/:id/estado', (req, res) => {
  const { store } = req.app.locals;
  const status = String(req.body.status || '');
  if (STATUSES.includes(status)) store.setStatus(Number(req.params.id), status);
  res.redirect(backToAdmin(req));
});

// Vuelve a la lista con el mismo filtro que tenía, sin seguir links a otros sitios.
function backToAdmin(req) {
  try {
    const ref = new URL(req.get('referer'));
    if (ref.host === req.get('host') && ref.pathname.startsWith('/admin')) return ref.pathname + ref.search;
  } catch {}
  return '/admin';
}

router.post('/autos/:id/borrar', (req, res) => {
  const { store, uploadsDir } = req.app.locals;
  removeFiles(uploadsDir, store.deleteCar(Number(req.params.id)));
  res.redirect(`/admin?ok=${encodeURIComponent('Se borró la publicación.')}`);
});

export default router;
