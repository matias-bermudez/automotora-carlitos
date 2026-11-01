// Formularios que terminan en WhatsApp: contacto (inicio) y Vendé tu auto.
// No se guarda nada: se arma el mensaje y se abre wa.me con el texto listo.
(function () {
  var K = window.CARLITOS;
  var digitos = function (v) { return String(v || '').replace(/\D/g, ''); };

  var mensajes = {
    contacto: function (d) {
      var quien = d.nombre + (d.telefono ? ' (tel. ' + d.telefono + ')' : '');
      var lineas = ['Hola Automotora Carlitos! Soy ' + quien + '.', 'Consulta: ' + d.interes + '.'];
      if (d.mensaje) lineas.push('', d.mensaje);
      return lineas.join('\n');
    },

    vender: function (d) {
      var auto = [d.marca, d.modelo, d.anio].filter(Boolean).join(' ');
      var lineas = [
        'Hola Automotora Carlitos! Quiero vender mi auto.',
        '',
        'Nombre: ' + (d.nombre || '—'),
        'Celular: ' + (d.celular || '—') + (d.zona ? ' · ' + d.zona : ''),
        '',
        'Auto: ' + (auto || '—'),
        'Kilómetros: ' + (digitos(d.km) ? K.miles(digitos(d.km)) : '—'),
        d.combustible + ' · ' + d.transmision,
        'Precio pretendido: ' + (digitos(d.precio) ? 'U$S ' + K.miles(digitos(d.precio)) : 'a conversar'),
        'Permuta: ' + d.permuta
      ];
      if (d.comentarios) lineas.push('', 'Comentarios: ' + d.comentarios);
      lineas.push('', 'Les mando las fotos del auto por acá a continuación.');
      return lineas.join('\n');
    }
  };

  document.querySelectorAll('form[data-wa-form]').forEach(function (form) {
    var armar = mensajes[form.getAttribute('data-wa-form')];
    var preview = document.querySelector('[data-wa-preview]');
    var error = document.querySelector('[data-wa-error]');
    var enviado = document.querySelector('[data-wa-sent]');
    function datos() {
      var d = {};
      new FormData(form).forEach(function (v, k) { d[k] = String(v).trim(); });
      return d;
    }

    function actualizar() {
      if (preview) preview.textContent = armar(datos());
      if (error && form.checkValidity()) error.hidden = true;
    }
    form.addEventListener('input', actualizar);
    form.addEventListener('change', actualizar);
    actualizar();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var falta = [].slice.call(form.querySelectorAll('[required]')).filter(function (el) { return !el.value.trim(); })[0];
      if (falta) {
        if (error) error.hidden = false;
        falta.focus();
        form.reportValidity();
        return;
      }
      var url = K.waUrl(armar(datos()));
      var ventana = window.open(url, '_blank');
      if (ventana) ventana.opener = null;
      else window.location.href = url;
      if (enviado) {
        enviado.hidden = false;
        enviado.querySelector('[data-wa-retry]').setAttribute('href', url);
      }
    });
  });
})();
