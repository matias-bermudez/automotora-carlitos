// Galería de la ficha del auto. El resto de la página ya viene armado por scripts/generar.js.
(function () {
  var galeria = document.querySelector('[data-gallery]');
  var foto = galeria && galeria.querySelector('[data-gallery-image]');
  var thumbs = galeria ? [].slice.call(galeria.querySelectorAll('[data-gallery-thumb]')) : [];
  if (!foto || thumbs.length < 2) return;
  var actual = 0;
  var contador = galeria.querySelector('[data-gallery-current]');

  function mostrar(i) {
    actual = (i + thumbs.length) % thumbs.length;
    foto.src = thumbs[actual].getAttribute('data-src');
    foto.alt = foto.alt.replace(/foto \d+/, 'foto ' + (actual + 1));
    contador.textContent = actual + 1;
    thumbs.forEach(function (t, k) { t.setAttribute('aria-current', String(k === actual)); });
  }

  thumbs.forEach(function (t, k) { t.addEventListener('click', function () { mostrar(k); }); });
  galeria.querySelector('[data-gallery-prev]').addEventListener('click', function () { mostrar(actual - 1); });
  galeria.querySelector('[data-gallery-next]').addEventListener('click', function () { mostrar(actual + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
    if (e.key === 'ArrowRight') mostrar(actual + 1);
  });

  // Deslizar con el dedo en el celular.
  var x0 = null;
  var principal = foto.parentElement;
  principal.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  principal.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) mostrar(actual + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
