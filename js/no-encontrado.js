// 404: GitHub Pages lo muestra para cualquier URL que no existe. Si era la ficha de un auto,
// casi siempre es porque se vendió (los vendidos salen de la web): se avisa y se ofrece consultar por uno parecido.
(function () {
  var K = window.CARLITOS;
  if (!/\/autos\/[^/]+\/?$/.test(location.pathname)) return;
  document.querySelector('[data-titulo]').textContent = 'Este auto ya no está publicado';
  document.querySelector('[data-texto]').textContent = 'Lo más probable es que ya se haya vendido. Escribinos y te avisamos si entra uno parecido.';
  document.querySelector('[data-wa]').href = K.waUrl(K.mensajes.vendido(location.href));
  document.querySelector('[data-wa-texto]').textContent = 'Consultar por uno similar';
})();
