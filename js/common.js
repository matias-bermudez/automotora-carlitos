// Helpers compartidos. Se usan en el navegador y también en scripts/generar.js,
// que arma las páginas con estas mismas funciones. Todo se expone en window.CARLITOS.
(function () {
  var C = window.CARLITOS_CONFIG;
  var AUTOS = window.CARLITOS_AUTOS || [];
  var EN_NAVEGADOR = typeof document !== 'undefined';
  // Prefijo relativo hasta la raíz del sitio ('./', '../', '../../'), lo pone el generador en <body data-raiz>.
  var RAIZ = EN_NAVEGADOR && document.body ? document.body.getAttribute('data-raiz') || './' : './';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function raiz(r) { return r == null ? RAIZ : r; }
  // Formatos de Uruguay: punto como separador de miles (48.000), U$S o $ según la moneda.
  function miles(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function precio(a) { return a.precio ? (a.moneda === 'UYU' ? '$ ' : 'U$S ') + miles(a.precio) : 'Consultar'; }
  function km(a) { return miles(a.km) + ' km'; }
  // Para filtrar y ordenar autos con precios en distintas monedas.
  function enDolares(a) { return a.precio ? (a.moneda === 'UYU' ? a.precio / (C.dolar || 40) : a.precio) : null; }
  function nombre(a) { return a.marca + ' ' + a.modelo; }
  function titulo(a) { return nombre(a) + ' ' + a.anio; }
  function autoUrl(a, r) { return raiz(r) + 'autos/' + encodeURIComponent(a.id) + '/'; }
  // URL pública del auto: es la que va en los mensajes de WhatsApp.
  function autoUrlPublica(a) { return C.sitio + 'autos/' + encodeURIComponent(a.id) + '/'; }
  function buscar(id) { return AUTOS.filter(function (a) { return a.id === id; })[0]; }

  // ---- WhatsApp: todas las consultas terminan en un link wa.me con el mensaje ya escrito ----

  function waUrl(text) { return 'https://wa.me/' + C.whatsapp + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function telUrl() { return 'tel:+' + C.whatsapp; }
  var mensajes = {
    interes: function (a) {
      return 'Hola! Me interesa el ' + titulo(a) + (a.precio ? ' (' + precio(a) + ')' : '') +
        ' que vi en la web. ¿Sigue disponible?\n' + autoUrlPublica(a);
    },
    visita: function (a) { return 'Hola! Quiero coordinar una visita para ver el ' + titulo(a) + '.\n' + autoUrlPublica(a); },
    // Auto que ya no está en la web (se vendió): solo se sabe el link.
    vendido: function (url) { return 'Hola! Vi que este auto ya no está en la web. ¿Tienen algo parecido?\n' + url; }
  };

  // ---- Íconos de línea del diseño original ----

  var ICONOS = {
    pin: '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0"/><path d="M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    wa: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>',
    swap: '<path d="M7 10h14l-4-4"/><path d="M17 14H3l4 4"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3"/><path d="M16.5 7.5v.01"/>',
    tiktok: '<path d="M21 7.917v4.034a9.948 9.948 0 0 1-5-1.951v4.5a6.5 6.5 0 1 1-8-6.326v4.326a2.5 2.5 0 1 0 4 2V3h4.083A6.005 6.005 0 0 0 21 7.917z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    camera: '<path d="M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2"/><circle cx="12" cy="13" r="3"/>',
    phone: '<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5-2.5l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7s10 7 10 7s-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12l-3-3M18 15l3-3"/>'
  };
  // o: { stroke, width }
  function icono(nombre, size, o) {
    o = o || {};
    return '<svg class="icon" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="' +
      (o.stroke || 'currentColor') + '" stroke-width="' + (o.width || 2) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONOS[nombre] || '') + '</svg>';
  }

  // Silueta del diseño, para autos que todavía no tienen fotos.
  var SILUETA = '<svg viewBox="0 0 400 160" role="img" aria-label="Foto no disponible"><ellipse cx="200" cy="138" rx="185" ry="9" fill="#000000" opacity="0.4"/><path d="M18 118 L18 98 Q20 84 40 80 L108 70 Q140 42 176 36 L252 34 Q288 36 314 64 L362 74 Q384 80 386 98 L386 118 L330 118 A26 26 0 0 0 278 118 L124 118 A26 26 0 0 0 72 118 Z" fill="#2A2A2F" stroke="#9AA0A6" stroke-width="2.5" stroke-linejoin="round"/><path d="M124 68 Q150 46 180 42 L212 42 L214 68 Z" fill="#141417" stroke="#71717A" stroke-width="2"/><path d="M224 42 L252 42 Q278 44 298 68 L226 68 Z" fill="#141417" stroke="#71717A" stroke-width="2"/><path d="M30 96 L60 94" stroke="#F5B800" stroke-width="4" stroke-linecap="round"/><path d="M370 92 L382 92" stroke="#D00000" stroke-width="5" stroke-linecap="round"/><circle cx="98" cy="120" r="22" fill="#0D0D0F" stroke="#9AA0A6" stroke-width="3"/><circle cx="98" cy="120" r="9" fill="#3F3F46"/><circle cx="304" cy="120" r="22" fill="#0D0D0F" stroke="#9AA0A6" stroke-width="3"/><circle cx="304" cy="120" r="9" fill="#3F3F46"/></svg>';

  // Portada chica (640 px) para tarjetas; si no hay fotos, la silueta.
  function portada(a, r) {
    var src = (a.miniaturas && a.miniaturas[0]) || (a.fotos && a.fotos[0]);
    return src ? '<img src="' + esc(raiz(r) + src) + '" alt="" loading="lazy">' : '<span class="placeholder">' + SILUETA + '</span>';
  }

  function cartel(a) {
    if (a.reservado) return '<span class="badge badge-gold">Reservado</span>';
    return a.etiqueta ? '<span class="badge">' + esc(a.etiqueta) + '</span>' : '';
  }

  // Tarjeta del catálogo y del inicio.
  function card(a, r) {
    var url = autoUrl(a, r);
    var fotos = (a.fotos || []).length;
    return '<article class="card">' +
      '<a class="card-media" href="' + url + '" tabindex="-1" aria-hidden="true">' + portada(a, r) + cartel(a) +
      (a.carroceria ? '<span class="tag-corner tr">' + esc(a.carroceria) + '</span>' : '') +
      (fotos > 1 ? '<span class="tag-corner br">' + icono('camera', 14) + fotos + ' fotos</span>' : '') +
      '</a>' +
      '<div class="card-body">' +
      '<div><div class="card-brand">' + esc(a.marca) + '</div><h3 class="card-model"><a href="' + url + '">' + esc(a.modelo) + '</a></h3></div>' +
      '<div class="pills"><span>' + a.anio + '</span><span>' + km(a) + '</span><span>' + esc(a.combustible) + '</span><span>' + esc(a.transmision) + '</span></div>' +
      '<div class="card-foot"><div><div class="price-label">Precio</div><div class="price">' + precio(a) + '</div></div>' +
      '<div class="card-actions"><a class="btn btn-ghost" href="' + url + '">Ver ficha</a>' +
      '<a class="btn btn-wa btn-icon" href="' + esc(waUrl(mensajes.interes(a))) + '" target="_blank" rel="noopener" aria-label="Consultar por WhatsApp por el ' + esc(titulo(a)) + '">' + icono('wa', 22) + '</a>' +
      '</div></div></div></article>';
  }

  // Más nuevos primero.
  function recientes() {
    return AUTOS.slice().sort(function (a, b) { return (b.ingreso || '').localeCompare(a.ingreso || ''); });
  }

  window.CARLITOS = {
    config: C, autos: AUTOS,
    esc: esc, miles: miles, precio: precio, km: km, enDolares: enDolares, nombre: nombre, titulo: titulo,
    autoUrl: autoUrl, autoUrlPublica: autoUrlPublica, buscar: buscar, recientes: recientes,
    waUrl: waUrl, telUrl: telUrl, mensajes: mensajes,
    icono: icono, SILUETA: SILUETA, portada: portada, cartel: cartel, card: card
  };
})();
