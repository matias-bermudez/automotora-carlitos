// Panel del dueño (/admin/): login, lista de autos (con el historial de vendidos), alta/edición/baja y fotos.
// Los permisos los pone la base compartida: solo los emails de la tabla admins con 'carlitos' (o '*') pueden escribir.
// La web pública no lee de acá en vivo: scripts/generar.js la regenera cuando se guarda un auto.
//
// Vistas por la URL (así anda el botón "atrás" del celular): #/ lista · #/nuevo · #/auto/<id> · #/negocio
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const C = window.CARLITOS_CONFIG;
const K = window.CARLITOS;
const BUCKET = 'fotos';
const CONCESIONARIA = C.concesionaria;
const MAX_FOTOS = 30;
const $ = (s) => document.querySelector(s);
const esc = K.esc;

// Un auto en la base tiene `publicado` y `estado`; en el panel se ve como una sola "situación".
const SITUACIONES = ['borrador', 'disponible', 'reservado', 'vendido'];
const NOMBRES = { borrador: 'Borrador', disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido' };
const situacion = (a) => (a.publicado ? a.estado : 'borrador');

const form = $('#f-auto');
const sb = createClient(C.supabaseUrl, C.supabaseKey);
let autos = [];
let dentro = false;
let filtro = '';
// Editor: auto que se edita (null = nuevo), fotos actuales (rutas en el bucket),
// las subidas en esta edición (se borran si no se guarda) y las quitadas (se borran al guardar).
let actual = null;
let fotos = [];
let nuevas = [];
let quitadas = [];
let subiendo = 0;

iniciar();

async function iniciar() {
  const { data } = await sb.auth.getSession();
  if (data.session && (await tienePermiso())) await entrar();
  else vista('login');
}

function vista(nombre) {
  $('#cargando').hidden = true;
  for (const v of ['login', 'lista', 'editor', 'negocio']) $('#v-' + v).hidden = v !== nombre;
  $('#admin-nav').hidden = nombre === 'login';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const activo = a.dataset.nav === (nombre === 'editor' && !actual ? 'nuevo' : nombre);
    if (activo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function aviso(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { t.hidden = true; }, 5000);
}

function errores(el, lista) {
  el.innerHTML = lista && lista.length
    ? (lista.length > 1 ? '<strong>Revisá estos datos:</strong><ul>' + lista.map((e) => `<li>${esc(e)}</li>`).join('') + '</ul>' : esc(lista[0]))
    : '';
  el.hidden = !(lista && lista.length);
}

// ---- Login ----

$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  errores($('#login-error'));
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  if (error) return errores($('#login-error'), ['Email o contraseña incorrectos.']);
  if (!(await tienePermiso())) return;
  f.reset();
  await entrar();
});

async function entrar() {
  dentro = true;
  await cargarLista();
  await mostrar();
}

async function tienePermiso() {
  const { data } = await sb.rpc('puede_editar', { c: CONCESIONARIA });
  if (data) return true;
  await sb.auth.signOut();
  vista('login');
  errores($('#login-error'), ['Este usuario no tiene permiso para editar Automotora Carlitos. Hay que agregarlo en la tabla admins de Supabase.']);
  return false;
}

$('#salir').addEventListener('click', async () => {
  await sb.auth.signOut();
  dentro = false;
  history.replaceState(null, '', location.pathname);
  vista('login');
});

// ---- Navegación ----

window.addEventListener('hashchange', () => { if (dentro) mostrar(); });

function mostrar() {
  // Si se sale del editor sin guardar, las fotos subidas en esa edición no quedaron en ningún auto.
  if (nuevas.length) {
    borrarArchivos(nuevas);
    nuevas = [];
  }
  const ruta = location.hash.replace(/^#/, '');
  const id = (ruta.match(/^\/auto\/(\d+)$/) || [])[1];
  if (ruta === '/nuevo') abrir(null);
  else if (ruta === '/negocio') abrirNegocio();
  else if (id && autos.some((a) => String(a.id) === id)) abrir(autos.find((a) => String(a.id) === id));
  else {
    pintarLista();
    vista('lista');
  }
}

// ---- Lista ----

async function cargarLista() {
  const [{ data, error }] = await Promise.all([
    sb.from('autos').select('*').eq('concesionaria', CONCESIONARIA).order('created_at', { ascending: false }),
    leerPublicacion()
  ]);
  if (error) {
    aviso('No se pudo cargar la lista: ' + error.message);
    return;
  }
  autos = data;
}

// Cuándo se generó la web publicada (estado.json lo escribe scripts/generar.js).
// Un auto modificado después de eso todavía no se ve en la web.
let publicadoEn = null;
async function leerPublicacion() {
  try {
    const r = await fetch(C.sitio + 'estado.json?t=' + Date.now(), { cache: 'no-store' });
    publicadoEn = r.ok ? new Date((await r.json()).generado) : null;
  } catch {
    publicadoEn = null;
  }
}
const pendiente = (a) => publicadoEn && new Date(a.updated_at) > publicadoEn;

// Mientras haya cambios sin publicar, se vuelve a mirar cada 20 segundos.
let revision;
function revisarPublicacion() {
  clearTimeout(revision);
  if (!autos.some(pendiente)) return;
  revision = setTimeout(async () => {
    await leerPublicacion();
    if (!$('#v-lista').hidden) pintarLista();
    else revisarPublicacion();
  }, 20000);
}

function urlFoto(ruta, chica) {
  return sb.storage.from(BUCKET).getPublicUrl(chica ? ruta.replace(/\.jpg$/, '_m.jpg') : ruta).data.publicUrl;
}

const fecha = (iso) => new Date(iso).toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' });
const fechaCorta = (dia) => dia.split('-').reverse().join('/');

function pintarLista() {
  const cuenta = (s) => autos.filter((a) => situacion(a) === s).length;
  $('#tabs').innerHTML = [['', 'Todos', autos.length], ...SITUACIONES.map((s) => [s, NOMBRES[s], cuenta(s)])]
    .map(([s, nombre, n]) => `<button type="button" data-filtro="${s}" aria-pressed="${filtro === s}">${nombre} <span>${n}</span></button>`).join('');

  const lista = autos.filter((a) => !filtro || situacion(a) === filtro);
  if (!lista.length) {
    $('#lista').innerHTML = `<li class="empty"><strong>${filtro ? `No hay autos en "${NOMBRES[filtro]}"` : 'Todavía no cargaste ningún auto'}</strong>` +
      `<a class="btn btn-red" href="#/nuevo">${K.icono('plus', 20)}Cargar el primero</a></li>`;
    return revisarPublicacion();
  }
  $('#lista').innerHTML = lista.map((a) => {
    const s = situacion(a);
    const editar = `#/auto/${a.id}`;
    const fechas = 'Cargado el ' + fecha(a.created_at) + (a.extra && a.extra.vendido_el ? ' · Vendido el ' + fechaCorta(a.extra.vendido_el) : '');
    const enLaWeb = s === 'disponible' || s === 'reservado';
    return `<li class="panel admin-row status-${s}">
      <a class="admin-thumb" href="${editar}">${a.fotos.length ? `<img src="${esc(urlFoto(a.fotos[0], true))}" alt="" loading="lazy">` : '<span>Sin fotos</span>'}</a>
      <div class="admin-row-info">
        <a href="${editar}" class="admin-row-title">${esc(K.titulo(a))}</a>
        <span class="muted">${K.precio(a)} · ${K.km(a)} · ${a.fotos.length} fotos${a.destacado ? ' · <strong style="color: var(--gold)">★ Destacado</strong>' : ''}</span>
        <span class="muted" style="font-size: 13px">${fechas}</span>
        ${pendiente(a) ? '<span class="publicando">Publicándose en la web…</span>' : ''}
      </div>
      <div class="admin-row-status">
        <label class="sr-only" for="estado-${a.id}">Estado</label>
        <select class="input status-select" id="estado-${a.id}" data-id="${a.id}">
          ${SITUACIONES.map((x) => `<option value="${x}"${x === s ? ' selected' : ''}>${NOMBRES[x]}</option>`).join('')}
        </select>
      </div>
      <div class="admin-row-actions">
        ${enLaWeb ? `<a class="btn btn-ghost btn-icon" href="${K.autoUrl({ id: a.slug }, '../')}" target="_blank" rel="noopener" aria-label="Ver en el sitio" title="Ver en el sitio">${K.icono('eye', 20)}</a>` : ''}
        <a class="btn btn-ghost btn-icon" href="${editar}" aria-label="Editar" title="Editar">${K.icono('edit', 20)}</a>
      </div>
    </li>`;
  }).join('');
  revisarPublicacion();
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (!b) return;
  filtro = b.dataset.filtro;
  pintarLista();
});

// Cambiar el estado desde la lista guarda al toque.
$('#lista').addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-id]');
  if (!sel) return;
  const a = autos.find((x) => String(x.id) === sel.dataset.id);
  sel.disabled = true;
  const { error } = await sb.from('autos').update(camposDeSituacion(sel.value, a)).eq('id', a.id);
  if (error) aviso('No se pudo cambiar el estado: ' + error.message);
  else aviso(`${K.titulo(a)}: ${NOMBRES[sel.value]}. ${AVISOS[sel.value]}`);
  await cargarLista();
  pintarLista();
});

const AVISOS = {
  borrador: 'Ya no se ve en la web (en un par de minutos).',
  disponible: 'En un par de minutos se ve en la web.',
  reservado: 'En un par de minutos se ve en la web con el cartel "Reservado".',
  vendido: 'Sale de la web en un par de minutos y queda acá en el historial.'
};

// publicado/estado/extra.vendido_el para una situación. La fecha de venta se guarda la primera vez.
function camposDeSituacion(s, a) {
  const extra = Object.assign({}, a && a.extra);
  if (s === 'vendido') extra.vendido_el = extra.vendido_el || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Montevideo' });
  else delete extra.vendido_el;
  return {
    publicado: s !== 'borrador',
    estado: s === 'borrador' ? 'disponible' : s,
    extra
  };
}

// ---- Datos del negocio ----
// Se guardan en la tabla `negocios`; al publicar pisan a config.js en toda la web.

const CAMPOS_NEGOCIO = ['direccion', 'zonas', 'horario', 'instagram', 'tiktok'];
// Campo del formulario → clave de CARLITOS_CONFIG (lo que hoy muestra la web).
const EN_CONFIG = { direccion: 'direccion', zonas: 'zona', horario: 'horarioCorto', instagram: 'instagram', tiktok: 'tiktok' };
const fNegocio = $('#f-negocio');

async function abrirNegocio() {
  errores($('#neg-error'));
  vista('negocio');
  const { data, error } = await sb.from('negocios').select('*').eq('concesionaria', CONCESIONARIA).maybeSingle();
  if (error) errores($('#neg-error'), ['No se pudieron leer los datos guardados: ' + error.message]);
  // Lo guardado en la base; lo que falte, lo que hoy publica la web (config.js).
  fNegocio.whatsapp.value = (data && data.telefono) || C.whatsappLabel || '';
  for (const k of CAMPOS_NEGOCIO) fNegocio[k].value = (data && data[k]) || C[EN_CONFIG[k]] || '';
}

// "095 407 252", "+598 95 407 252" o "2303 6119" → { whatsapp: '59895407252', telefono: '095 407 252' }.
function telefonoUY(texto) {
  let d = texto.replace(/\D/g, '');
  if (d.startsWith('598')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^[0-9]{8}$/.test(d)) return null;
  const telefono = d.startsWith('9') ? `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : `${d.slice(0, 4)} ${d.slice(4)}`;
  return { whatsapp: '598' + d, telefono };
}

fNegocio.addEventListener('submit', async (e) => {
  e.preventDefault();
  errores($('#neg-error'));
  const tel = telefonoUY(fNegocio.whatsapp.value);
  if (!tel) return errores($('#neg-error'), ['El WhatsApp tiene que ser un número de Uruguay, por ejemplo 095 407 252.']);
  const fila = { concesionaria: CONCESIONARIA, ...tel };
  for (const k of CAMPOS_NEGOCIO) fila[k] = fNegocio[k].value.trim().replace(/^@/, '') || null;
  $('#guardar-negocio').disabled = true;
  const { error } = await sb.from('negocios').upsert(fila, { onConflict: 'concesionaria' });
  $('#guardar-negocio').disabled = false;
  if (error) return errores($('#neg-error'), ['No se pudo guardar: ' + error.message]);
  Object.assign(C, { whatsapp: tel.whatsapp, whatsappLabel: tel.telefono });
  aviso('Guardado. En un par de minutos se actualiza en toda la web.');
  location.hash = '#/';
});

// ---- Editor ----

const MONTOS = ['km', 'precio'];

function abrir(a) {
  actual = a;
  form.reset();
  errores($('#ed-errores'));
  fotos = a ? a.fotos.slice() : [];
  nuevas = [];
  quitadas = [];
  if (a) {
    for (const el of form.elements) {
      if (!el.name || el.type === 'radio') continue;
      const v = a[el.name];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.tagName === 'SELECT') {
        // Un valor cargado por otro lado (ej. "Automática") se agrega para no perderlo al guardar.
        if (v && ![...el.options].some((o) => o.value === String(v))) el.add(new Option(v, v));
        if (v) el.value = String(v);
      }
      else if (MONTOS.includes(el.name)) el.value = v ? K.miles(v) : '';
      else if (el.name === 'equipamiento') el.value = (v || []).join('\n');
      else el.value = v === null || v === undefined ? '' : String(v);
    }
    form.querySelector(`[name="situacion"][value="${situacion(a)}"]`).checked = true;
  }
  $('#ed-titulo').textContent = a ? `${a.marca} ${a.modelo}` : 'Cargar auto';
  $('#guardar').textContent = a ? 'Guardar cambios' : 'Guardar auto';
  const enLaWeb = a && (situacion(a) === 'disponible' || situacion(a) === 'reservado');
  $('#ed-ver').hidden = !enLaWeb;
  if (enLaWeb) $('#ed-ver').href = K.autoUrl({ id: a.slug }, '../');
  $('#zona-borrar').hidden = !a;
  pintarFotos();
  vista('editor');
}

const digitos = (v) => String(v || '').replace(/\D/g, '');
const tipoDe = (carroceria) => (carroceria === 'Pickup' || carroceria === 'SUV' ? 'camioneta' : carroceria === 'Utilitario' ? 'utilitario' : 'auto');

// Lee el formulario. Precios y km se escriben como en Uruguay ("48.000", "U$S 16.900"): se toman solo los dígitos.
function leerFormulario() {
  const v = (n) => form.elements[n].value.trim();
  const problemas = [];
  const anio = Number(digitos(v('anio')));
  const anioMax = new Date().getFullYear() + 1;
  if (!v('marca')) problemas.push('Falta la marca.');
  if (!v('modelo')) problemas.push('Falta el modelo.');
  if (!anio || anio < 1950 || anio > anioMax) problemas.push(`El año tiene que estar entre 1950 y ${anioMax}.`);
  const puertas = digitos(v('puertas')) ? Number(digitos(v('puertas'))) : null;
  if (puertas !== null && (puertas < 1 || puertas > 6)) problemas.push('Las puertas tienen que ser entre 1 y 6.');
  const s = form.querySelector('[name="situacion"]:checked').value;
  const carroceria = v('carroceria');
  const fila = Object.assign({
    marca: v('marca'),
    modelo: v('modelo'),
    anio,
    km: Number(digitos(v('km'))) || 0,
    precio: Number(digitos(v('precio'))) || null,
    moneda: v('moneda'),
    carroceria,
    tipo: tipoDe(carroceria),
    combustible: v('combustible'),
    transmision: v('transmision'),
    motor: v('motor') || null,
    color: v('color') || null,
    puertas,
    etiqueta: v('etiqueta') || null,
    descripcion: v('descripcion') || null,
    equipamiento: v('equipamiento').split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    destacado: form.elements.destacado.checked,
    fotos
  }, camposDeSituacion(s, actual));
  return { fila, problemas };
}

function slugDe(f) {
  return `${f.marca} ${f.modelo} ${f.anio}`.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (subiendo) return errores($('#ed-errores'), ['Esperá a que terminen de subir las fotos.']);
  const { fila, problemas } = leerFormulario();
  if (problemas.length) {
    errores($('#ed-errores'), problemas);
    return window.scrollTo(0, 0);
  }
  errores($('#ed-errores'));

  $('#guardar').disabled = true;
  // El slug es la URL del auto (/autos/<slug>/): marca-modelo-año. Se mantiene mientras no cambien
  // esos datos; si cambian, se actualiza. Si ya existe otro igual, se le agrega -2, -3...
  const base = slugDe(fila);
  const mismo = actual && (actual.slug === base || actual.slug.startsWith(base + '-'));
  let error, guardado;
  for (let n = 1; n < 20; n++) {
    const slug = mismo ? actual.slug : n === 1 ? base : `${base}-${n}`;
    ({ data: guardado, error } = actual
      ? await sb.from('autos').update({ ...fila, slug }).eq('id', actual.id).select().single()
      : await sb.from('autos').insert({ ...fila, slug, concesionaria: CONCESIONARIA }).select().single());
    if (!error || error.code !== '23505' || mismo) break;
  }
  if (!error && fila.destacado) {
    // Destacado de la semana: uno solo a la vez.
    ({ error } = await sb.from('autos').update({ destacado: false })
      .eq('concesionaria', CONCESIONARIA).eq('destacado', true).neq('id', guardado.id));
  }
  $('#guardar').disabled = false;
  if (error) return errores($('#ed-errores'), ['No se pudo guardar: ' + error.message]);

  await borrarArchivos(quitadas);
  nuevas = [];
  aviso('Guardado. ' + AVISOS[situacion(fila)]);
  await cargarLista();
  location.hash = '#/';
});

$('#borrar').addEventListener('click', async () => {
  if (!confirm(`¿Seguro que querés borrar el ${K.titulo(actual)} y todas sus fotos? No se puede deshacer.\n\nSi ya se vendió, mejor marcalo como Vendido para que quede en el historial.`)) return;
  const { error } = await sb.from('autos').delete().eq('id', actual.id);
  if (error) return errores($('#ed-errores'), ['No se pudo borrar: ' + error.message]);
  await borrarArchivos([...actual.fotos, ...nuevas]);
  nuevas = [];
  aviso('Auto borrado.');
  await cargarLista();
  location.hash = '#/';
});

// ---- Fotos: se suben al elegirlas, achicadas en el navegador ----

function pintarFotos() {
  $('#fotos').innerHTML = fotos.map((ruta, i) => `
    <div class="photo-item">
      ${nuevas.includes(ruta) ? '<span class="photo-new">Nueva</span>' : ''}
      <img src="${esc(urlFoto(ruta, true))}" alt="Foto ${i + 1}">
      <label class="photo-opt"><input type="radio" name="portada" data-i="${i}"${i === 0 ? ' checked' : ''}> Portada</label>
      <button type="button" class="photo-opt photo-del" data-quitar="${i}">${K.icono('trash', 16)} Quitar</button>
    </div>`).join('');
}

$('#fotos').addEventListener('change', (e) => {
  const r = e.target.closest('[name="portada"]');
  if (!r) return;
  fotos.unshift(...fotos.splice(Number(r.dataset.i), 1));
  pintarFotos();
});

$('#fotos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-quitar]');
  if (!b) return;
  const [ruta] = fotos.splice(Number(b.dataset.quitar), 1);
  // Las nuevas no están en ningún auto todavía: se borran ya. Las otras, recién al guardar.
  if (nuevas.includes(ruta)) {
    nuevas = nuevas.filter((r) => r !== ruta);
    borrarArchivos([ruta]);
  } else quitadas.push(ruta);
  pintarFotos();
});

const dropzone = $('#dropzone');
['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, () => dropzone.classList.add('dragging')));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, () => dropzone.classList.remove('dragging')));

// Dos entradas: la galería (varias a la vez) y la cámara del celular (una por vez, se sube al sacarla).
for (const id of ['#f-fotos', '#f-camara']) {
  $(id).addEventListener('change', (e) => {
    const elegidas = [...e.target.files];
    e.target.value = '';
    subirFotos(elegidas);
  });
}

async function subirFotos(elegidas) {
  const lugar = MAX_FOTOS - fotos.length - subiendo;
  const archivos = elegidas.slice(0, Math.max(0, lugar));
  if (elegidas.length > archivos.length) aviso(`Hasta ${MAX_FOTOS} fotos por auto: quedaron afuera ${elegidas.length - archivos.length}.`);
  const estado = $('#subiendo');
  subiendo += archivos.length;
  let hechas = 0;
  for (const archivo of archivos) {
    estado.hidden = false;
    estado.textContent = `Subiendo foto ${++hechas} de ${archivos.length}…`;
    try {
      const ruta = `${CONCESIONARIA}/${crypto.randomUUID()}.jpg`;
      const [grande, chica] = await Promise.all([achicar(archivo, 1600, 0.82), achicar(archivo, 640, 0.78)]);
      for (const [r, blob] of [[ruta, grande], [ruta.replace(/\.jpg$/, '_m.jpg'), chica]]) {
        const { error } = await sb.storage.from(BUCKET).upload(r, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (error) throw error;
      }
      fotos.push(ruta);
      nuevas.push(ruta);
      pintarFotos();
    } catch (err) {
      aviso(`No se pudo subir ${archivo.name}: ${err.message || err}`);
    }
    subiendo--;
  }
  estado.hidden = true;
}

// Achica la foto del celular (3–10 MB) a un JPG de ~200 KB, respetando la orientación.
async function achicar(archivo, max, calidad) {
  const img = await decodificar(archivo);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error('formato de imagen no soportado');
  return blob;
}

// createImageBitmap con orientación no anda en todos los Safari: si falla, se usa un <img>
// (los navegadores ya lo giran según la foto).
async function decodificar(archivo) {
  try {
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function borrarArchivos(rutas) {
  if (!rutas.length) return;
  await sb.storage.from(BUCKET).remove(rutas.flatMap((r) => [r, r.replace(/\.jpg$/, '_m.jpg')]));
}
