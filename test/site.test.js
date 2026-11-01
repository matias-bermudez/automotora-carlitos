import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { displayPhone, waLink, carInterestMessage } from '../src/whatsapp.js';
import { priceLabel, parseInteger, slugify } from '../src/format.js';

const SITE = 'https://carlitos.test';
let server;
let base;
let store;

before(async () => {
  const app = createApp({ dataDir: ':memory:', settings: { ...config, siteUrl: SITE, sessionSecret: 'secreto-de-prueba' } });
  store = app.locals.store;
  store.upsertAdmin('carlitos', hashPassword('clave-de-prueba'));
  await new Promise((resolve) => (server = app.listen(0, resolve)));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const get = (path, init) => fetch(base + path, { redirect: 'manual', ...init });
const html = async (path, init) => (await get(path, init)).text();

function addCar(overrides = {}) {
  return store.createCar({
    brand: 'Chevrolet', model: 'Onix 1.0 Turbo LT', year: 2021, km: 48000, price: 16900,
    fuel: 'Nafta', transmission: 'Manual', body_type: 'Hatch', status: 'disponible', ...overrides,
  });
}

async function login() {
  const res = await get('/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'carlitos', password: 'clave-de-prueba' }),
  });
  assert.equal(res.status, 302);
  return res.headers.get('set-cookie').split(';')[0];
}

describe('formatos y WhatsApp', () => {
  test('muestra el número uruguayo con formato local', () => {
    assert.equal(displayPhone('59891969322'), '091 969 322');
    assert.equal(displayPhone('59896665018'), '096 665 018');
  });

  test('el link de WhatsApp lleva el mensaje codificado', () => {
    assert.equal(waLink('Hola! ¿Sigue?', '59891969322'), 'https://wa.me/59891969322?text=Hola!%20%C2%BFSigue%3F');
  });

  test('el mensaje de interés incluye el auto, el precio y el link a la ficha', () => {
    const msg = carInterestMessage({ brand: 'Chevrolet', model: 'Onix', year: 2021, price: 16900 }, `${SITE}/autos/1-chevrolet-onix-2021`);
    assert.match(msg, /Chevrolet Onix 2021 \(U\$S 16\.900\)/);
    assert.ok(msg.endsWith(`${SITE}/autos/1-chevrolet-onix-2021`));
  });

  test('precios, números y slugs', () => {
    assert.equal(priceLabel(8900), 'U$S 8.900');
    assert.equal(priceLabel(null), 'Consultar');
    assert.equal(parseInteger('U$S 16.900'), 16900);
    assert.equal(parseInteger(''), null);
    assert.equal(slugify('Citroën C3 1.6 Sedán'), 'citroen-c3-1-6-sedan');
  });
});

describe('sitio público', () => {
  test('la portada usa el número de WhatsApp configurado', async () => {
    const page = await html('/');
    assert.ok(page.includes(`https://wa.me/${config.whatsappNumber}`));
  });

  test('la ficha tiene el botón de WhatsApp con el link de la publicación', async () => {
    const id = addCar();
    const res = await get(`/autos/${id}`);
    assert.equal(res.status, 301);
    const canonical = res.headers.get('location');
    assert.equal(canonical, `/autos/${id}-chevrolet-onix-1-0-turbo-lt-2021`);

    const page = await html(canonical);
    const expected = waLink(carInterestMessage({ brand: 'Chevrolet', model: 'Onix 1.0 Turbo LT', year: 2021, price: 16900 }, SITE + canonical));
    assert.ok(page.includes(expected.replace(/&/g, '&amp;')), 'falta el link de WhatsApp con la URL de la ficha');
    assert.ok(page.includes('Me interesa este auto'));
    assert.ok(page.includes(`<meta property="og:url" content="${SITE}${canonical}">`));
  });

  test('el catálogo filtra por marca y no muestra borradores ni vendidos', async () => {
    addCar({ brand: 'Hyundai', model: 'HB20 Filtro', year: 2019 });
    addCar({ brand: 'Hyundai', model: 'Creta Borrador', year: 2020, status: 'borrador' });
    addCar({ brand: 'Hyundai', model: 'Accent Vendido', year: 2015, status: 'vendido' });
    const page = await html('/catalogo?marca=Hyundai');
    assert.ok(page.includes('HB20 Filtro'));
    assert.ok(!page.includes('Onix 1.0 Turbo LT'));
    assert.ok(!page.includes('Creta Borrador'));
    assert.ok(!page.includes('Accent Vendido'));
  });

  test('un borrador no se ve sin sesión; un vendido sí, marcado como vendido', async () => {
    const draft = addCar({ model: 'Borrador Oculto', status: 'borrador' });
    assert.equal((await get(`/autos/${draft}`)).status, 404);

    const sold = addCar({ model: 'Ya Vendido', status: 'vendido' });
    const page = await html(`/autos/${sold}-chevrolet-ya-vendido-2021`);
    assert.ok(page.includes('Este auto ya se vendió'));
    assert.ok(page.includes('Consultar por uno similar'));
  });
});

describe('admin', () => {
  test('sin sesión manda al login', async () => {
    const res = await get('/admin');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/admin/login');
  });

  test('rechaza una contraseña incorrecta', async () => {
    const res = await get('/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'carlitos', password: 'otra' }),
    });
    assert.equal(res.status, 401);
  });

  test('rechaza formularios que vienen de otro sitio', async () => {
    const cookie = await login();
    const res = await get('/admin/autos/1/borrar', { method: 'POST', headers: { cookie, origin: 'https://malo.example' } });
    assert.equal(res.status, 403);
  });

  test('carga un auto con fotos, lo marca vendido y lo borra', async () => {
    const cookie = await login();
    const form = new FormData();
    for (const [k, v] of Object.entries({
      brand: 'Toyota', model: 'Etios Admin', year: '2018', km: '74.000', price: '13.600',
      fuel: 'Nafta', transmission: 'Manual', body_type: 'Sedán', status: 'disponible',
    })) form.append(k, v);
    form.append('photos', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'frente.jpg');
    form.append('photos', new Blob(['no soy una foto'], { type: 'text/plain' }), 'virus.txt');

    const created = await get('/admin/autos', { method: 'POST', headers: { cookie }, body: form });
    assert.equal(created.status, 302);

    const car = store.listCars().find((c) => c.model === 'Etios Admin');
    assert.equal(car.price, 13600);
    assert.equal(car.km, 74000);
    assert.equal(car.photo_count, 1, 'solo se guarda la imagen, no el .txt');
    assert.equal((await get(`/fotos/${car.cover}`)).status, 200);

    const page = await html(`/autos/${car.id}-toyota-etios-admin-2018`);
    assert.ok(page.includes(`<meta property="og:image" content="${SITE}/fotos/${car.cover}">`));

    const sold = await get(`/admin/autos/${car.id}/estado`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ status: 'vendido' }),
    });
    assert.equal(sold.status, 302);
    const soldCar = store.getCar(car.id);
    assert.equal(soldCar.status, 'vendido');
    assert.ok(soldCar.sold_at, 'guarda la fecha de venta para el historial');

    await get(`/admin/autos/${car.id}/borrar`, { method: 'POST', headers: { cookie } });
    assert.equal(store.getCar(car.id), null);
    assert.equal((await get(`/fotos/${car.cover}`)).status, 404);
  });

  test('muestra los errores si faltan datos obligatorios', async () => {
    const cookie = await login();
    const form = new FormData();
    form.append('brand', '');
    form.append('model', 'Sin marca');
    form.append('year', '1900');
    const res = await get('/admin/autos', { method: 'POST', headers: { cookie }, body: form });
    assert.equal(res.status, 422);
    const page = await res.text();
    assert.ok(page.includes('Falta la marca.'));
    assert.ok(page.includes('El año tiene que estar entre 1950'));
  });
});
