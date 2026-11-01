// Arma el sitio estático en _site/ a partir de src/ y los autos de Supabase (concesionaria 'carlitos').
// Cada auto tiene su propia página (/autos/<slug>/) con título, descripción, foto para compartir y datos
// estructurados para Google. GitHub Actions lo corre en cada push a main, cuando se guarda un auto en el
// panel y cada 15 minutos. Las fotos se bajan y se publican junto con la web, así las visitas no consumen
// el plan de Supabase.
//
//   node scripts/generar.js                   → para publicar
//   node scripts/generar.js --local           → para probar: python3 -m http.server 8792 -d _site
//   SOLO_SI_CAMBIO=1 node scripts/generar.js  → no hace nada si los autos no cambiaron desde la última publicación
//   --datos archivo.json [--fotos carpeta]    → usa esas filas (mismo formato que Supabase) en vez de la base
//
// Sin dependencias, solo Node 22+.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, '_site');
const ESTATICOS = ['css', 'js', 'img'];

const args = process.argv.slice(2);
const opcion = (n) => (args.includes(n) ? path.resolve(args[args.indexOf(n) + 1]) : null);
const DATOS = opcion('--datos');
const FOTOS_LOCALES = opcion('--fotos');

// Se cargan los mismos archivos que usa el navegador.
const ctx = vm.createContext({ window: {} });
const correr = (f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
correr('js/config.js');
const C = ctx.window.CARLITOS_CONFIG;

const SITIO = C.sitio.replace(/\/?$/, '/');
const BASE = args.includes('--local') ? '/' : new URL(SITIO).pathname;
const HOY = new Date().toISOString().slice(0, 10);
const NEGOCIO = 'Automotora Carlitos';
const PRECIOS_RAPIDOS = [10000, 15000, 20000, 30000];
const TRANSMISIONES = ['Manual', 'Automático'];
const POR_PAGINA = 12;

let K, AUTOS, esc;

async function main() {
  const filas = DATOS ? JSON.parse(fs.readFileSync(DATOS, 'utf8')) : await leerSupabase();
  ctx.window.CARLITOS_AUTOS = filas.map(deFila).filter(Boolean);
  correr('js/common.js');
  K = ctx.window.CARLITOS;
  esc = K.esc;

  const hash = crypto.createHash('sha256').update(JSON.stringify(filas)).digest('hex').slice(0, 16);
  if (process.env.SOLO_SI_CAMBIO) {
    const anterior = await fetch(SITIO + 'estado.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (anterior && anterior.hash === hash) {
      console.log('Los autos no cambiaron desde la última publicación, no hay nada para publicar.');
      salida('cambio', 'false');
      return;
    }
  }

  fs.rmSync(SALIDA, { recursive: true, force: true });
  for (const dir of ESTATICOS) fs.cpSync(path.join(RAIZ, dir), path.join(SALIDA, dir), { recursive: true });
  await bajarFotos(K.autos);
  // El catálogo filtra en el navegador con estos mismos datos.
  escribir('js/autos.js', '// Generado por scripts/generar.js.\nwindow.CARLITOS_AUTOS = ' +
    JSON.stringify(K.autos.map(({ _fotos, descripcion, equipamiento, ...a }) => a), null, 1) + ';\n');
  AUTOS = K.recientes();

  generarPaginas();
  escribir('estado.json', JSON.stringify({ hash, generado: new Date().toISOString(), autos: AUTOS.length }) + '\n');
  salida('cambio', 'true');
  console.log(`Listo: ${AUTOS.length} autos (${DATOS ? path.basename(DATOS) : 'Supabase'}). indexar=${C.indexar} → _site/`);
}

// ---- Supabase ----

async function leerSupabase() {
  // Las claves sb_publishable_ van solo en apikey. La base solo devuelve autos publicados y no vendidos.
  const res = await fetch(`${C.supabaseUrl}/rest/v1/autos?select=*&concesionaria=eq.${encodeURIComponent(C.concesionaria)}&order=created_at.desc`,
    { headers: { apikey: C.supabaseKey } });
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`);
  return res.json();
}

// Fila de la base → formato que usan las plantillas y el navegador. Si a un auto le falta algo, se saltea.
function deFila(r) {
  if (!r.publicado || r.estado === 'vendido') return null;
  const falta = ['slug', 'marca', 'modelo', 'anio', 'combustible', 'transmision'].filter((k) => r[k] === null || r[k] === undefined || r[k] === '');
  if (falta.length) {
    console.warn(`Aviso: se saltea el auto ${r.id} (${r.marca} ${r.modelo}), falta: ${falta.join(', ')}`);
    return null;
  }
  const dir = `img/autos/${r.slug}/`;
  return {
    id: r.slug,
    marca: r.marca, modelo: r.modelo, anio: r.anio, km: r.km || 0,
    tipo: r.tipo || 'auto', carroceria: r.carroceria || '',
    combustible: r.combustible, transmision: r.transmision,
    motor: r.motor || '', color: r.color || '', puertas: r.puertas || null,
    precio: r.precio || null, moneda: r.moneda || 'USD',
    etiqueta: r.etiqueta || '',
    reservado: r.estado === 'reservado',
    destacado: !!r.destacado,
    ingreso: r.created_at,
    actualizado: (r.updated_at || r.created_at).slice(0, 10),
    descripcion: r.descripcion || '',
    equipamiento: (r.equipamiento || []).map((e) => e.trim()).filter(Boolean),
    fotos: [], miniaturas: [],
    // Rutas en el bucket; bajarFotos() completa fotos/miniaturas con las que se pudieron bajar.
    _fotos: (r.fotos || []).map((p) => ({ p, archivo: dir + path.posix.basename(p) }))
  };
}

// Las fotos no cambian nunca (nombre = uuid): se guardan en .cache/fotos/ y solo se bajan las nuevas.
// GitHub Actions conserva esa carpeta entre publicaciones (actions/cache).
const CACHE_FOTOS = path.join(RAIZ, '.cache', 'fotos');

async function bajarFotos(autos) {
  const url = (p) => `${C.supabaseUrl}/storage/v1/object/public/fotos/${p.split('/').map(encodeURIComponent).join('/')}`;
  const bajar = async (p, destino) => {
    let origen = path.join(FOTOS_LOCALES || CACHE_FOTOS, p);
    if (!fs.existsSync(origen)) {
      if (FOTOS_LOCALES) return false;
      const res = await fetch(url(p));
      if (!res.ok) return false;
      fs.mkdirSync(path.dirname(origen), { recursive: true });
      fs.writeFileSync(origen, Buffer.from(await res.arrayBuffer()));
    }
    const f = path.join(SALIDA, destino);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.copyFileSync(origen, f);
    return true;
  };
  const tareas = autos.flatMap((a) => a._fotos.map((f) => async () => {
    const chica = f.archivo.replace(/\.jpg$/, '_m.jpg');
    f.ok = await bajar(f.p, f.archivo);
    f.chica = f.ok && (await bajar(f.p.replace(/\.jpg$/, '_m.jpg'), chica)) ? chica : f.archivo;
    if (!f.ok) console.warn(`Aviso: no se pudo bajar la foto ${f.p} de ${a.id}`);
  }));
  // De a 6 descargas a la vez.
  const cola = tareas.slice();
  await Promise.all(Array.from({ length: 6 }, async () => { while (cola.length) await cola.shift()(); }));
  for (const a of autos) {
    const ok = a._fotos.filter((f) => f.ok);
    a.fotos = ok.map((f) => f.archivo);
    a.miniaturas = ok.map((f) => f.chica);
  }
}

function salida(clave, valor) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
}

// ---- Plantillas: {{ clave.sub }} y {{> parcial }} ----

const parciales = {};
for (const f of fs.readdirSync(path.join(SRC, '_partials'))) {
  parciales[path.basename(f, '.html')] = fs.readFileSync(path.join(SRC, '_partials', f), 'utf8');
}

function render(tpl, datos) {
  return tpl.replace(/\{\{\s*(>\s*)?([\w.-]+)\s*\}\}/g, (_, parcial, clave) => {
    if (parcial) {
      if (!(clave in parciales)) throw new Error(`No existe el parcial ${clave}`);
      return render(parciales[clave], datos);
    }
    const v = clave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), datos);
    if (v === undefined) throw new Error(`Falta el dato {{${clave}}}`);
    return String(v);
  });
}

// Íconos en las plantillas: {{i.wa-20}} = ícono "wa" de 20 px; {{i.arrowRight-18-24}} con trazo 2.4;
// {{i.clock-20-20-oro}} en dorado.
const iconos = new Proxy({}, {
  get(_, clave) {
    const [nombre, size, ancho, color] = String(clave).split('-');
    return K.icono(nombre, Number(size) || 20, { width: ancho ? Number(ancho) / 10 : 2, stroke: color === 'oro' ? '#F5B800' : undefined });
  }
});

function jsonld(...objs) {
  return objs.map((o) => '<script type="application/ld+json">' +
    JSON.stringify(o).replace(/</g, '\\u003c') + '</script>').join('\n');
}

// ?v=<hash del archivo>: cuando cambia un css/js, el navegador no usa la copia vieja (Pages cachea 10 min).
const versiones = {};
function v(rel) {
  versiones[rel] = versiones[rel] || crypto.createHash('sha1').update(fs.readFileSync(path.join(SALIDA, rel))).digest('hex').slice(0, 8);
  return versiones[rel];
}

function scripts(raiz, nombres) {
  return nombres.map((n) => `<script src="${raiz}js/${n}.js?v=${v(`js/${n}.js`)}" defer></script>`).join('\n');
}

function waFlotante(href) {
  return `<a class="wa-float" href="${esc(href)}" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">${K.icono('wa', 30)}</a>`;
}

// ruta: '' (inicio), 'catalogo/', 'autos/<slug>/', '404.html'...
function pagina(plantilla, ruta, datos) {
  const prof = ruta.endsWith('/') ? ruta.split('/').length - 1 : 0;
  // El 404 se sirve en cualquier URL, por eso usa rutas absolutas.
  const raiz = ruta === '404.html' ? BASE : prof ? '../'.repeat(prof) : './';
  const generico = K.waUrl();
  const d = Object.assign({
    raiz,
    v: { css: v('css/site.css'), adminCss: v('css/admin.css'), admin: v('js/admin.js') },
    canonical: SITIO + ruta,
    robots: C.indexar ? '<meta name="robots" content="index, follow, max-image-preview:large">' : '<meta name="robots" content="noindex">',
    ogTipo: 'website',
    ogTitulo: datos.titulo,
    ogImagen: SITIO + 'img/og.jpg',
    cssExtra: '',
    jsonld: '',
    nav: { inicio: '', catalogo: '', vende: '' },
    wa: { href: esc(generico), label: esc(C.whatsappLabel), tel: K.telUrl() },
    fab: waFlotante(generico),
    anio: new Date().getFullYear(),
    i: iconos,
    negocio: {
      direccion: esc(C.direccion), direccionLarga: esc(C.direccionLarga), zona: esc(C.zona),
      horarioCorto: esc(C.horarioCorto), mapa: esc(C.mapa), seguidores: esc(C.seguidores),
      instagram: esc(C.instagram), instagramUrl: `https://www.instagram.com/${esc(C.instagram)}/`,
      tiktok: esc(C.tiktok), tiktokUrl: `https://www.tiktok.com/@${esc(C.tiktok)}`,
      vendedor: esc(C.vendedorInstagram), vendedorUrl: `https://www.instagram.com/${esc(C.vendedorInstagram)}/`
    }
  }, datos);
  d.scripts = scripts(raiz, d.js || ['config', 'common']);
  const html = render(fs.readFileSync(path.join(SRC, plantilla), 'utf8'), d);
  escribir(ruta === '' || ruta.endsWith('/') ? ruta + 'index.html' : ruta, html);
}

function escribir(rel, contenido) {
  const f = path.join(SALIDA, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenido);
}

// ---- Datos estructurados (schema.org) ----

const NEGOCIO_ID = SITIO + '#negocio';
const negocioLd = {
  '@context': 'https://schema.org',
  '@type': 'AutoDealer',
  '@id': NEGOCIO_ID,
  name: NEGOCIO,
  description: 'Automotora en Paso de la Arena, Montevideo. Compra, venta y permuta de autos usados.',
  url: SITIO,
  image: SITIO + 'img/og.jpg',
  telephone: '+' + C.whatsapp,
  address: {
    '@type': 'PostalAddress',
    streetAddress: C.direccionLarga,
    addressLocality: 'Montevideo',
    addressRegion: 'Montevideo',
    postalCode: '12600',
    addressCountry: 'UY'
  },
  openingHours: C.horarioSchema.split(',').map((h) => h.trim()),
  sameAs: ['https://www.instagram.com/' + C.instagram + '/', 'https://www.tiktok.com/@' + C.tiktok]
};

function migas(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item }))
  };
}

function autoLd(a, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: K.titulo(a),
    url,
    image: a.fotos.length ? a.fotos.map((f) => SITIO + f) : undefined,
    description: a.descripcion || undefined,
    brand: { '@type': 'Brand', name: a.marca },
    model: a.modelo,
    vehicleModelDate: String(a.anio),
    bodyType: a.carroceria || undefined,
    itemCondition: 'https://schema.org/UsedCondition',
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: a.km, unitCode: 'KMT' },
    fuelType: a.combustible,
    vehicleTransmission: a.transmision,
    vehicleEngine: a.motor ? { '@type': 'EngineSpecification', name: a.motor } : undefined,
    color: a.color || undefined,
    numberOfDoors: a.puertas || undefined,
    offers: a.precio ? {
      '@type': 'Offer',
      price: a.precio,
      priceCurrency: a.moneda === 'UYU' ? 'UYU' : 'USD',
      availability: a.reservado ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      url,
      seller: { '@type': 'AutoDealer', '@id': NEGOCIO_ID, name: NEGOCIO, url: SITIO }
    } : undefined
  };
}

// ---- Páginas ----

const unicos = (lista) => [...new Set(lista.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es'));
const opciones = (lista) => lista.map((x) => `<option>${esc(x)}</option>`).join('');

function generarPaginas() {
  const marcas = unicos(AUTOS.map((a) => a.marca));
  const tipos = unicos(AUTOS.map((a) => a.carroceria));
  const grilla = (autos, raiz) => autos.map((a) => K.card(a, raiz)).join('');

  // Inicio
  // El destacado de la semana; si no hay ninguno marcado, el último que entró con fotos.
  const destacado = AUTOS.find((a) => a.destacado) || AUTOS.find((a) => a.fotos.length);
  pagina('index.html', '', {
    titulo: `${NEGOCIO} — Autos usados en Paso de la Arena`,
    ogTitulo: NEGOCIO,
    descripcion: 'Autos usados en Paso de la Arena, Montevideo. Mirá el stock, consultá por WhatsApp y vení a verlo a Cno. Cibils 5700.',
    jsonld: jsonld(negocioLd, { '@context': 'https://schema.org', '@type': 'WebSite', name: NEGOCIO, url: SITIO, inLanguage: 'es-UY' }),
    nav: { inicio: ' aria-current="page"', catalogo: '', vende: '' },
    js: ['config', 'common', 'formularios'],
    destacado: destacado
      ? `<a class="hero-car" href="${K.autoUrl(destacado, './')}">` +
        (destacado.fotos.length ? `<img class="hero-car-photo" src="./${esc(destacado.fotos[0])}" alt="${esc(K.titulo(destacado))}" fetchpriority="high">` : K.SILUETA) +
        `<span class="hero-car-caption">Destacado de la semana · <strong>${esc(K.nombre(destacado))}</strong> · ${K.precio(destacado)}</span></a>`
      : `<div class="hero-car">${K.SILUETA}</div>`,
    marcas: opciones(marcas),
    tipos: opciones(tipos),
    precios: PRECIOS_RAPIDOS.map((p) => `<option value="${p}">U$S ${K.miles(p)}</option>`).join(''),
    recientes: AUTOS.length
      ? `<div class="grid-cards">${grilla(AUTOS.slice(0, 6), './')}</div>`
      : `<div class="empty"><strong>Estamos cargando el stock</strong><span class="muted">Mientras tanto, escribinos y te contamos qué autos tenemos.</span>` +
        `<a class="btn btn-wa" href="${esc(K.waUrl('Hola! ¿Qué autos tienen disponibles?'))}" target="_blank" rel="noopener">${K.icono('wa', 20)}Consultar por WhatsApp</a></div>`,
    permuta: esc(K.waUrl('Hola! Quiero consultar por una permuta.')),
    horarios: C.horarios.map(([dia, hora]) =>
      `<div class="hours-row"><span class="soft">${esc(dia)}</span><strong${hora ? '' : ' class="muted"'}>${esc(hora || 'Cerrado')}</strong></div>`).join('')
  });

  // Catálogo: lo arma el generador sin filtros; js/catalogo.js aplica los de la URL.
  const maxPrecio = Math.max(0, ...AUTOS.map((a) => K.enDolares(a) || 0));
  const techo = Math.max(10000, Math.ceil(maxPrecio / 5000) * 5000);
  const chips = (nombre, todos, lista) => lista.length ? `
          <fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px">
            <legend class="field-label-caps" style="padding: 0; margin-bottom: 10px">${{ marca: 'Marca', tipo: 'Tipo', caja: 'Transmisión' }[nombre]}</legend>
            <div class="chips">
              <label class="chip"><input type="radio" name="${nombre}" value="" checked><span>${todos}</span></label>` +
    lista.map((x) => `
              <label class="chip"><input type="radio" name="${nombre}" value="${esc(x)}"><span>${esc(x)}</span></label>`).join('') + `
            </div>
          </fieldset>` : '';
  const primera = AUTOS.slice(0, POR_PAGINA);
  pagina('catalogo.html', 'catalogo/', {
    titulo: `Catálogo de autos | ${NEGOCIO}`,
    ogTitulo: 'Catálogo de autos',
    descripcion: 'Todos los autos usados disponibles en Automotora Carlitos, con fotos, precio y consulta directa por WhatsApp.',
    jsonld: jsonld(migas([['Inicio', SITIO], ['Catálogo', SITIO + 'catalogo/']])),
    nav: { inicio: '', catalogo: ' aria-current="page"', vende: '' },
    js: ['config', 'autos', 'common', 'catalogo'],
    filtros: chips('marca', 'Todas', marcas) + chips('tipo', 'Todos', tipos) + chips('caja', 'Todas', TRANSMISIONES),
    techo,
    techoLabel: K.miles(techo),
    busco: esc(K.waUrl('Hola! Busco un auto que no vi en la web.')),
    total: AUTOS.length,
    totalLabel: AUTOS.length === 1 ? 'auto encontrado' : 'autos encontrados',
    grilla: grilla(primera, '../'),
    vacio: AUTOS.length ? ' hidden' : '',
    paginas: paginacion(1, Math.ceil(AUTOS.length / POR_PAGINA), (n) => `./?pagina=${n}`)
  });

  // Una ficha por auto
  for (const a of AUTOS) generarAuto(a);

  // Vendé tu auto
  const anios = [];
  for (let y = new Date().getFullYear() + 1; y >= 1990; y--) anios.push(y);
  pagina('vende.html', 'vende-tu-auto/', {
    titulo: `Vendé tu auto | ${NEGOCIO}`,
    ogTitulo: 'Vendé tu auto',
    descripcion: 'Te compramos el auto. Completá los datos y mandanos las fotos por WhatsApp.',
    jsonld: jsonld(migas([['Inicio', SITIO], ['Vendé tu auto', SITIO + 'vende-tu-auto/']])),
    nav: { inicio: '', catalogo: '', vende: ' aria-current="page"' },
    js: ['config', 'common', 'formularios'],
    fab: '',
    anios: opciones(anios.map(String)),
    tomas: ['Frente', 'Lateral', 'Trasera', 'Interior', 'Tablero (km)', 'Motor']
      .map((s) => `<div class="shot">${K.icono('camera', 20)}${s}</div>`).join('')
  });

  // 404: GitHub Pages lo sirve para cualquier URL que no exista, por ejemplo un auto vendido.
  pagina('404.html', '404.html', {
    titulo: `Página no encontrada | ${NEGOCIO}`,
    descripcion: 'La página que buscás no existe. Mirá los autos usados disponibles en Automotora Carlitos.',
    robots: '<meta name="robots" content="noindex">',
    js: ['config', 'common', 'no-encontrado']
  });

  // Panel del dueño
  pagina('admin.html', 'admin/', {
    titulo: `Panel · ${NEGOCIO}`,
    descripcion: 'Panel de administración de Automotora Carlitos.',
    robots: '<meta name="robots" content="noindex, nofollow">',
    cssExtra: `<link rel="stylesheet" href="../css/admin.css?v=${v('css/admin.css')}">`,
    js: ['config', 'common'],
    fab: ''
  });

  // sitemap.xml y robots.txt
  const urls = [
    [SITIO, HOY, '1.0'],
    [SITIO + 'catalogo/', HOY, '0.9'],
    ...AUTOS.map((a) => [SITIO + `autos/${a.id}/`, a.actualizado, '0.8']),
    [SITIO + 'vende-tu-auto/', HOY, '0.7']
  ];
  escribir('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([loc, lastmod, prio]) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><priority>${prio}</priority></url>`).join('\n') +
    '\n</urlset>\n');
  escribir('robots.txt', `User-agent: *\nAllow: /\nDisallow: ${BASE}admin/\n\nSitemap: ${SITIO}sitemap.xml\n`);
}

// Botonera de páginas del catálogo. El navegador la vuelve a armar con los filtros (js/catalogo.js).
function paginacion(actual, total, href) {
  if (total < 2) return '';
  let html = '<nav class="pagination" aria-label="Paginación">';
  if (actual > 1) html += `<a href="${href(actual - 1)}" aria-label="Página anterior">${K.icono('arrowLeft', 18, { width: 2.4 })}</a>`;
  for (let n = 1; n <= total; n++) html += n === actual ? `<span aria-current="page">${n}</span>` : `<a href="${href(n)}">${n}</a>`;
  if (actual < total) html += `<a href="${href(actual + 1)}" aria-label="Página siguiente">${K.icono('arrowRight', 18, { width: 2.4 })}</a>`;
  return html + '</nav>';
}

function generarAuto(a) {
  const ruta = `autos/${a.id}/`;
  const url = SITIO + ruta;
  const raiz = '../../';
  const nombre = K.nombre(a);
  const fotos = a.fotos;

  const ficha = [
    ['Año', a.anio], ['Kilómetros', K.km(a)], ['Combustible', a.combustible], ['Transmisión', a.transmision],
    ['Motor', a.motor], ['Color', a.color], ['Tipo', a.carroceria], ['Puertas', a.puertas]
  ].filter(([, x]) => x).map(([l, x]) => `<div class="panel spec"><small>${l}</small><strong>${esc(x)}</strong></div>`).join('');

  let galeria = fotos.length
    ? `<img src="${raiz}${esc(fotos[0])}" alt="${esc(nombre)}, foto 1 de ${fotos.length}" data-gallery-image fetchpriority="high">`
    : `<span class="placeholder" style="display: flex; justify-content: center; width: 100%">${K.SILUETA}</span>`;
  galeria += K.cartel(a);
  if (fotos.length > 1) {
    galeria += `<span class="gallery-count">Foto <span data-gallery-current>1</span> de ${fotos.length}</span>` +
      `<button type="button" class="gallery-nav prev" aria-label="Foto anterior" data-gallery-prev>${K.icono('chevronLeft', 22, { width: 2.4 })}</button>` +
      `<button type="button" class="gallery-nav next" aria-label="Foto siguiente" data-gallery-next>${K.icono('chevronRight', 22, { width: 2.4 })}</button>`;
  }
  const miniaturas = fotos.length > 1
    ? '<div class="thumbs">' + fotos.map((f, i) =>
      `<button type="button" class="thumb" data-gallery-thumb="${i}" data-src="${raiz}${esc(f)}" aria-label="Ver foto ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}>` +
      `<img src="${raiz}${esc(a.miniaturas[i])}" alt="" loading="lazy"></button>`).join('') + '</div>'
    : '';

  const parrafos = a.descripcion.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const extra = [
    parrafos.length && `<div class="panel">\n      <h2 class="display">Descripción</h2>\n      ${parrafos.map((p) => `<p>${esc(p)}</p>`).join('\n      ')}\n    </div>`,
    a.equipamiento.length && `<div class="panel">\n      <h2 class="display">Equipamiento</h2>\n      <ul class="equipment">` +
      a.equipamiento.map((e) => `<li>${K.icono('check', 18, { stroke: '#F5B800', width: 2.6 })}${esc(e)}</li>`).join('') + '</ul>\n    </div>'
  ].filter(Boolean);

  // Parecidos: primero los de la misma carrocería, después los de precio más cercano.
  const similares = AUTOS.filter((o) => o.id !== a.id)
    .sort((x, y) => (y.carroceria === a.carroceria) - (x.carroceria === a.carroceria) ||
      Math.abs((K.enDolares(x) || 0) - (K.enDolares(a) || 0)) - Math.abs((K.enDolares(y) || 0) - (K.enDolares(a) || 0)))
    .slice(0, 3)
    .map((s) => `
      <a class="card mini-card" href="${K.autoUrl(s, raiz)}" style="flex-direction: row">
        <span class="mini-card-media">${K.portada(s, raiz)}</span>
        <span class="mini-card-body">
          <span class="card-brand" style="font-size: 14px">${esc(s.marca)}</span>
          <span class="card-model" style="font-size: 22px">${esc(s.modelo)}</span>
          <span class="muted" style="font-size: 14px">${s.anio} · ${K.km(s)} · ${esc(s.transmision)}</span>
          <span class="price" style="font-size: 26px; margin-top: 4px">${K.precio(s)}</span>
        </span>
      </a>`).join('');

  const interes = K.waUrl(K.mensajes.interes(a));
  pagina('auto.html', ruta, {
    titulo: esc(`${K.titulo(a)} · ${K.precio(a)} | ${NEGOCIO}`),
    ogTitulo: esc(K.titulo(a)),
    descripcion: esc([a.anio, K.km(a), a.combustible, a.transmision, K.precio(a)].join(' · ') +
      `. En ${C.direccion}, Paso de la Arena. Consultá por WhatsApp.`),
    ogTipo: 'product',
    ogImagen: fotos.length ? SITIO + fotos[0] : SITIO + 'img/og.jpg',
    jsonld: jsonld(autoLd(a, url), migas([['Inicio', SITIO], ['Catálogo', SITIO + 'catalogo/'], [K.titulo(a), url]])),
    nav: { inicio: '', catalogo: ' aria-current="page"', vende: '' },
    js: ['config', 'common', 'ficha'],
    fab: waFlotante(interes),
    a: {
      marca: esc(a.marca), modelo: esc(a.modelo), nombre: esc(nombre), precio: K.precio(a),
      subtitulo: esc([a.anio, a.carroceria, a.puertas ? `${a.puertas} puertas` : ''].filter(Boolean).join(' · '))
    },
    galeria,
    miniaturas,
    ficha,
    interes: esc(interes),
    visita: esc(K.waUrl(K.mensajes.visita(a))),
    extra: extra.length ? `<section class="wrap detail-extra">\n    ${extra.join('\n    ')}\n  </section>` : '',
    similares: similares ? `<section class="wrap" style="padding-bottom: 96px">
  <div class="section-head" style="margin-bottom: 28px">
    <h2 class="display h3">También te pueden <span class="gold">interesar</span></h2>
    <a class="link-arrow" href="${raiz}catalogo/">Ver todo el catálogo →</a>
  </div>
  <div class="grid-cards" style="gap: 20px">${similares}
  </div>
</section>` : ''
  });
}

main().catch((e) => {
  console.error('Error: ' + e.message);
  process.exit(1);
});
