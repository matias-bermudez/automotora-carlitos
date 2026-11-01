import { Router } from 'express';
import { TRANSMISSIONS } from '../db.js';
import { lines, parseInteger } from '../format.js';
import { carInterestMessage, carVisitMessage, soldCarMessage, waLink } from '../whatsapp.js';

const router = Router();

const PER_PAGE = 12;
const SORT_OPTIONS = [
  ['nuevos', 'Recién ingresados'],
  ['menor', 'Menor precio'],
  ['mayor', 'Mayor precio'],
  ['km', 'Menos kilómetros'],
  ['anio', 'Más nuevos (año)'],
];

const one = (v) => (Array.isArray(v) ? v[0] : v ?? '').toString().trim();

router.get('/', (req, res) => {
  const { store } = req.app.locals;
  res.render('home', {
    featured: store.featuredCar(),
    cars: store.latestCars(6),
    facets: store.facets(),
    meta: { description: 'Autos usados en Paso de la Arena, Montevideo. Mirá el stock, consultá por WhatsApp y vení a verlo a Cno. Cibils 5700.' },
  });
});

router.get('/catalogo', (req, res) => {
  const { store } = req.app.locals;
  const facets = store.facets();
  const priceCeiling = Math.max(10000, Math.ceil(facets.maxPrice / 5000) * 5000);
  const filters = {
    q: one(req.query.q).slice(0, 60),
    brand: one(req.query.marca),
    type: one(req.query.tipo),
    trans: TRANSMISSIONS.includes(one(req.query.caja)) ? one(req.query.caja) : '',
    maxPrice: parseInteger(one(req.query.hasta)),
    sort: SORT_OPTIONS.some(([k]) => k === one(req.query.orden)) ? one(req.query.orden) : 'nuevos',
  };
  if (filters.maxPrice && filters.maxPrice >= priceCeiling) filters.maxPrice = null;
  const page = parseInteger(one(req.query.pagina)) || 1;
  const result = store.searchCars({ ...filters, page, perPage: PER_PAGE });

  // Arma el link de una página manteniendo los filtros actuales.
  const pageUrl = (n) => {
    const params = new URLSearchParams();
    for (const key of ['q', 'marca', 'tipo', 'caja', 'hasta', 'orden']) {
      const v = one(req.query[key]);
      if (v) params.set(key, v);
    }
    if (n > 1) params.set('pagina', n);
    const qs = params.toString();
    return '/catalogo' + (qs ? '?' + qs : '');
  };

  res.render('catalog', {
    ...result,
    filters,
    facets,
    priceCeiling,
    sortOptions: SORT_OPTIONS,
    transmissions: TRANSMISSIONS,
    pageUrl,
    hasFilters: Boolean(filters.q || filters.brand || filters.type || filters.trans || filters.maxPrice),
    meta: { title: 'Catálogo de autos', description: 'Todos los autos usados disponibles en Automotora Carlitos, con fotos, precio y consulta directa por WhatsApp.' },
  });
});

router.get('/autos/:ref', (req, res, next) => {
  const { store } = req.app.locals;
  const id = parseInteger(req.params.ref.split('-')[0]);
  const car = id && store.getCar(id);
  // Los borradores solo los ve el admin (para revisar antes de publicar).
  if (!car || (car.status === 'borrador' && !req.admin)) return next();

  const canonical = res.locals.carUrl(car);
  if (req.path !== canonical) return res.redirect(301, canonical);

  const url = res.locals.absoluteUrl(canonical);
  const sold = car.status === 'vendido';
  const cover = car.photos[0];
  res.render('car', {
    car,
    sold,
    description: lines(car.description),
    equipment: lines(car.equipment),
    similar: store.similarCars(car, 3),
    interestLink: waLink(sold ? soldCarMessage(car, url) : carInterestMessage(car, url)),
    visitLink: waLink(carVisitMessage(car, url)),
    meta: {
      title: `${car.brand} ${car.model} ${car.year}`,
      description: [car.year, res.locals.format.kmLabel(car.km), car.fuel, car.transmission, res.locals.format.priceLabel(car.price)].join(' · '),
      image: cover ? res.locals.absoluteUrl(res.locals.photoUrl(cover.filename)) : null,
      url,
      noindex: car.status === 'borrador',
    },
  });
});

router.get('/vende-tu-auto', (req, res) => {
  const years = [];
  for (let y = new Date().getFullYear() + 1; y >= 1990; y--) years.push(y);
  res.render('sell', {
    years,
    meta: { title: 'Vendé tu auto', description: 'Te compramos el auto. Completá los datos y mandanos las fotos por WhatsApp.' },
  });
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${res.locals.absoluteUrl('/sitemap.xml')}\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const { store } = req.app.locals;
  const { cars } = store.searchCars({ perPage: 1000 });
  const urls = ['/', '/catalogo', '/vende-tu-auto', ...cars.map((c) => res.locals.carUrl(c))];
  const body = urls.map((u) => `<url><loc>${res.locals.absoluteUrl(u)}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
});

export default router;
