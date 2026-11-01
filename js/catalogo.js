// Catálogo: el generador arma la grilla sin filtros; acá se aplican los de la URL
// (/catalogo/?marca=Chevrolet&hasta=15000&orden=menor&pagina=2) con los datos de js/autos.js.
// Cambiar un filtro recarga la página con la URL nueva, así se puede compartir o volver atrás.
(function () {
  var K = window.CARLITOS;
  var POR_PAGINA = 12;
  var ORDENES = {
    nuevos: function (a, b) { return (b.ingreso || '').localeCompare(a.ingreso || ''); },
    menor: function (a, b) { return (K.enDolares(a) || Infinity) - (K.enDolares(b) || Infinity); },
    mayor: function (a, b) { return (K.enDolares(b) || -1) - (K.enDolares(a) || -1); },
    km: function (a, b) { return a.km - b.km; },
    anio: function (a, b) { return b.anio - a.anio || ORDENES.nuevos(a, b); }
  };

  var form = document.getElementById('filtros');
  var orden = document.querySelector('select[name="orden"][form="filtros"]');
  var rango = form.querySelector('[data-price-range]');
  var precioLabel = form.querySelector('[data-price-output]');
  var techo = Number(rango.getAttribute('data-ceiling'));

  var params = new URLSearchParams(location.search);
  var numero = function (v) { return Number(String(v || '').replace(/\D/g, '')) || 0; };
  var f = {
    q: (params.get('q') || '').trim().slice(0, 60),
    marca: params.get('marca') || '',
    tipo: params.get('tipo') || '',
    caja: params.get('caja') || '',
    hasta: numero(params.get('hasta')),
    orden: ORDENES[params.get('orden')] ? params.get('orden') : 'nuevos',
    pagina: numero(params.get('pagina')) || 1
  };
  if (f.hasta >= techo) f.hasta = 0;
  var hayFiltros = !!(f.q || f.marca || f.tipo || f.caja || f.hasta);

  // ---- El formulario muestra los filtros de la URL ----

  form.elements.q.value = f.q;
  ['marca', 'tipo', 'caja'].forEach(function (nombre) {
    form.querySelectorAll('input[name="' + nombre + '"]').forEach(function (r) { r.checked = r.value === f[nombre]; });
  });
  rango.value = f.hasta || techo;
  orden.value = f.orden;
  function etiquetaPrecio() { return Number(rango.value) >= techo ? 'Sin límite' : 'U$S ' + K.miles(rango.value); }
  precioLabel.textContent = etiquetaPrecio();

  // ---- Resultados ----

  function normal(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var palabras = normal(f.q).split(/\s+/).filter(Boolean);
  var lista = K.autos.filter(function (a) {
    var texto = normal(a.marca + ' ' + a.modelo);
    return (!f.marca || a.marca === f.marca) &&
      (!f.tipo || a.carroceria === f.tipo) &&
      (!f.caja || a.transmision === f.caja) &&
      (!f.hasta || (a.precio && K.enDolares(a) <= f.hasta)) &&
      palabras.every(function (p) { return texto.indexOf(p) >= 0; });
  }).sort(ORDENES[f.orden]);

  var paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  var actual = Math.min(Math.max(1, f.pagina), paginas);

  document.querySelector('[data-grilla]').innerHTML = lista
    .slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA)
    .map(function (a) { return K.card(a); }).join('');
  document.querySelector('[data-total]').textContent = lista.length;
  document.querySelector('[data-total-label]').textContent = lista.length === 1 ? 'auto encontrado' : 'autos encontrados';
  document.querySelector('[data-vacio]').hidden = lista.length > 0;
  document.querySelector('[data-vacio-titulo]').textContent = hayFiltros ? 'Sin resultados con esos filtros' : 'Todavía no hay autos publicados';
  if (hayFiltros) document.querySelector('[data-vacio-texto]').textContent = 'Probá con otra marca o subí el precio. También podés escribirnos y te avisamos cuando entre.';
  document.querySelectorAll('[data-limpiar]').forEach(function (el) { el.hidden = !hayFiltros; });

  // Links de página que mantienen los filtros.
  function pagina(n) {
    var p = new URLSearchParams(location.search);
    if (n > 1) p.set('pagina', n); else p.delete('pagina');
    return './' + (p.toString() ? '?' + p : '');
  }
  var html = '';
  if (paginas > 1) {
    html = '<nav class="pagination" aria-label="Paginación">';
    if (actual > 1) html += '<a href="' + K.esc(pagina(actual - 1)) + '" aria-label="Página anterior">' + K.icono('arrowLeft', 18, { width: 2.4 }) + '</a>';
    for (var n = 1; n <= paginas; n++) {
      html += n === actual ? '<span aria-current="page">' + n + '</span>' : '<a href="' + K.esc(pagina(n)) + '">' + n + '</a>';
    }
    if (actual < paginas) html += '<a href="' + K.esc(pagina(actual + 1)) + '" aria-label="Página siguiente">' + K.icono('arrowRight', 18, { width: 2.4 }) + '</a>';
    html += '</nav>';
  }
  document.querySelector('[data-paginas]').innerHTML = html;

  // ---- Los filtros se aplican solos al cambiarlos ----

  function enviar() { form.requestSubmit(); }
  form.querySelectorAll('input[type="radio"]').forEach(function (el) { el.addEventListener('change', enviar); });
  form.elements.q.addEventListener('change', enviar);
  orden.addEventListener('change', enviar);
  rango.addEventListener('input', function () { precioLabel.textContent = etiquetaPrecio(); });
  rango.addEventListener('change', enviar);

  // No mandar en la URL los filtros vacíos ni el precio en "sin límite".
  // (form.elements incluye el "Ordenar por", que está fuera del formulario con form="filtros").
  form.addEventListener('submit', function () {
    [].forEach.call(form.elements, function (el) {
      if (!el.name) return;
      var vacio = el.type === 'radio' ? el.checked && !el.value : !el.value;
      if (vacio || (el === rango && Number(el.value) >= techo) || (el === orden && el.value === 'nuevos')) el.disabled = true;
    });
  });
  // Si se vuelve con el botón "atrás", reactivar los campos.
  window.addEventListener('pageshow', function () {
    [].forEach.call(form.elements, function (el) { el.disabled = false; });
  });

  // En el celular los filtros arrancan cerrados (salvo que haya alguno aplicado).
  var filtros = document.querySelector('[data-filters]');
  if (!hayFiltros && window.matchMedia('(max-width: 860px)').matches) filtros.open = false;
})();
