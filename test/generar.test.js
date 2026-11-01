// Corre el generador con test/autos.json (filas como las devuelve Supabase) y revisa lo que publica.
// test/autos.json tiene los 12 autos del diseño, uno reservado, uno vendido y un borrador.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(RAIZ, '_site');
const SITIO = 'https://matias-bermudez.github.io/automotora-carlitos/';
const leer = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');
const ONIX = 'autos/chevrolet-onix-1-0-turbo-lt-2021/index.html';

before(() => {
  execFileSync(process.execPath, ['scripts/generar.js', '--datos', 'test/autos.json', '--fotos', 'test/fotos'], { cwd: RAIZ, stdio: 'pipe' });
});

function helpers() {
  const ctx = vm.createContext({ window: {} });
  for (const f of ['js/config.js', 'js/common.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx);
  return ctx.window.CARLITOS;
}

test('formatos de Uruguay y mensajes de WhatsApp', () => {
  const K = helpers();
  assert.equal(K.miles(1234567), '1.234.567');
  assert.equal(K.precio({ precio: 16900 }), 'U$S 16.900');
  assert.equal(K.precio({ precio: 450000, moneda: 'UYU' }), '$ 450.000');
  assert.equal(K.precio({ precio: null }), 'Consultar');
  const a = { id: 'fiat-uno-2010', marca: 'Fiat', modelo: 'Uno', anio: 2010, precio: 5000 };
  assert.equal(K.mensajes.interes(a), `Hola! Me interesa el Fiat Uno 2010 (U$S 5.000) que vi en la web. ¿Sigue disponible?\n${SITIO}autos/fiat-uno-2010/`);
  assert.equal(K.waUrl('Hola!'), 'https://wa.me/59891969322?text=Hola!');
});

test('publica solo los autos disponibles y reservados', () => {
  assert.ok(fs.existsSync(path.join(SITE, ONIX)));
  assert.ok(!fs.existsSync(path.join(SITE, 'autos/ford-ka-1-5-se-2017')), 'el vendido no tiene página');
  assert.ok(!fs.existsSync(path.join(SITE, 'autos/kia-picanto-1-0-2016')), 'el borrador no tiene página');
  const autos = leer('js/autos.js');
  assert.ok(!autos.includes('ford-ka') && !autos.includes('kia-picanto'));
  assert.equal(JSON.parse(leer('estado.json')).autos, 12);
  const sitemap = leer('sitemap.xml');
  assert.equal((sitemap.match(/<url>/g) || []).length, 15);
  assert.ok(!sitemap.includes('ford-ka'));
});

test('ficha del auto: WhatsApp con el link, foto para compartir y datos para Google', () => {
  const html = leer(ONIX);
  const wa = html.match(/class="btn btn-wa btn-block btn-cta" href="([^"]+)"/)[1].replace(/&amp;/g, '&');
  const texto = decodeURIComponent(new URL(wa).searchParams.get('text'));
  assert.ok(wa.startsWith('https://wa.me/59891969322?text='));
  assert.ok(texto.includes('Me interesa el Chevrolet Onix 1.0 Turbo LT 2021 (U$S 16.900)'));
  assert.ok(texto.endsWith(`${SITIO}autos/chevrolet-onix-1-0-turbo-lt-2021/`));
  assert.ok(html.includes(`<meta property="og:image" content="${SITIO}img/autos/chevrolet-onix-1-0-turbo-lt-2021/prueba-1.jpg">`));
  assert.ok(html.includes(`<link rel="canonical" href="${SITIO}autos/chevrolet-onix-1-0-turbo-lt-2021/">`));
  assert.ok(html.includes('<meta name="robots" content="noindex">'), 'noindex mientras indexar sea false');
  assert.ok(html.includes('"@type":"Car"') && html.includes('"priceCurrency":"USD"'));
  assert.ok(html.includes('Foto <span data-gallery-current>1</span> de 2'));
  assert.ok(html.includes('Cámara de retroceso'), 'equipamiento');
  assert.ok(fs.existsSync(path.join(SITE, 'img/autos/chevrolet-onix-1-0-turbo-lt-2021/prueba-2_m.jpg')));
  assert.ok(leer('autos/hyundai-hb20-1-6-premium-2019/index.html').includes('<span class="badge badge-gold">Reservado</span>'));
});

test('inicio, catálogo y vendé tu auto', () => {
  const inicio = leer('index.html');
  assert.ok(inicio.includes('Destacado de la semana · <strong>Chevrolet Onix 1.0 Turbo LT</strong>'));
  assert.ok(inicio.includes('"@type":"AutoDealer"'));
  assert.equal((inicio.match(/<article class="card">/g) || []).length, 6);

  const catalogo = leer('catalogo/index.html');
  for (const marca of ['Chevrolet', 'Fiat', 'Hyundai', 'Renault', 'Toyota', 'Volkswagen']) {
    assert.ok(catalogo.includes(`name="marca" value="${marca}"`), marca);
  }
  assert.ok(catalogo.includes('max="25000"'), 'el techo del precio sale del auto más caro');
  assert.equal((catalogo.match(/<article class="card">/g) || []).length, 12);

  // Sin fila de negocios (--datos sin --negocio) se publica la config tal cual, también para el navegador.
  const config = vm.runInNewContext(leer('js/config.js') + ';window.CARLITOS_CONFIG', { window: {} });
  assert.equal(config.whatsapp, '59891969322');
  assert.ok(inicio.includes('<strong>Abierto de lunes a sábado</strong>'));

  const vende = leer('vende-tu-auto/index.html');
  assert.ok(vende.includes('Las fotos van por WhatsApp'));
  assert.ok(!vende.includes('class="wa-float"'), 'sin botón flotante sobre el formulario');
});

test('404 y panel con rutas que funcionan en GitHub Pages', () => {
  const html = leer('404.html');
  assert.ok(html.includes('href="/automotora-carlitos/css/site.css'));
  assert.ok(html.includes('src="/automotora-carlitos/js/no-encontrado.js'));
  const admin = leer('admin/index.html');
  assert.ok(admin.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.ok(admin.includes('type="module" src="../js/admin.js?v='));
  assert.ok(leer('robots.txt').includes('Disallow: /automotora-carlitos/admin/'));
});
