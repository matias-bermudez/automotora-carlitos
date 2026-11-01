// Automotora Carlitos — interacción del sitio público (sin dependencias).

const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const digits = (v) => String(v || '').replace(/\D/g, '');

// ---------- Galería de la ficha ----------

document.querySelectorAll('[data-gallery]').forEach((gallery) => {
  const image = gallery.querySelector('[data-gallery-image]');
  const thumbs = [...gallery.querySelectorAll('[data-gallery-thumb]')];
  const current = gallery.querySelector('[data-gallery-current]');
  if (!image || thumbs.length < 2) return;
  let index = 0;

  const show = (i) => {
    index = (i + thumbs.length) % thumbs.length;
    image.src = thumbs[index].dataset.src;
    image.alt = image.alt.replace(/foto \d+/, `foto ${index + 1}`);
    if (current) current.textContent = index + 1;
    thumbs.forEach((t, k) => t.setAttribute('aria-current', String(k === index)));
  };

  thumbs.forEach((t, k) => t.addEventListener('click', () => show(k)));
  gallery.querySelector('[data-gallery-prev]')?.addEventListener('click', () => show(index - 1));
  gallery.querySelector('[data-gallery-next]')?.addEventListener('click', () => show(index + 1));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });

  // Deslizar con el dedo en el celular.
  let startX = null;
  const main = image.parentElement;
  main.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  main.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
});

// ---------- Filtros del catálogo: se aplican solos al cambiarlos ----------

document.querySelectorAll('form[data-autosubmit]').forEach((form) => {
  const submit = () => form.requestSubmit();
  form.querySelectorAll('input[type="radio"], select').forEach((el) => el.addEventListener('change', submit));
  document.querySelectorAll(`[form="${form.id}"][data-autosubmit-field]`).forEach((el) => el.addEventListener('change', submit));
  form.querySelector('input[type="search"]')?.addEventListener('change', submit);

  const range = form.querySelector('[data-price-range]');
  const output = form.querySelector('[data-price-output]');
  if (range && output) {
    const label = () => (Number(range.value) >= Number(range.dataset.ceiling) ? 'Sin límite' : 'U$S ' + thousands(range.value));
    range.addEventListener('input', () => (output.textContent = label()));
    range.addEventListener('change', submit);
  }

  // No mandar en la URL los filtros vacíos ni el precio en "sin límite".
  form.addEventListener('submit', () => {
    form.querySelectorAll('input, select').forEach((el) => {
      const atCeiling = el === range && Number(el.value) >= Number(el.dataset.ceiling);
      if ((!el.value && el.type !== 'radio') || atCeiling) el.disabled = true;
      if (el.type === 'radio' && el.checked && !el.value) el.disabled = true;
    });
  });
  // Si se vuelve con el botón "atrás", reactivar los campos.
  window.addEventListener('pageshow', () => form.querySelectorAll(':disabled').forEach((el) => (el.disabled = false)));
});

// En el celular los filtros arrancan cerrados (salvo que haya alguno aplicado).
const filters = document.querySelector('[data-filters]');
if (filters && !filters.hasAttribute('data-active') && window.matchMedia('(max-width: 860px)').matches) {
  filters.open = false;
}

// ---------- Formularios que terminan en WhatsApp ----------

const builders = {
  contacto(data) {
    const who = data.nombre + (data.telefono ? ` (tel. ${data.telefono})` : '');
    const lines = [`Hola Automotora Carlitos! Soy ${who}.`, `Consulta: ${data.interes}.`];
    if (data.mensaje) lines.push('', data.mensaje);
    return lines.join('\n');
  },

  vender(data) {
    const car = [data.marca, data.modelo, data.anio].filter(Boolean).join(' ');
    const lines = [
      'Hola Automotora Carlitos! Quiero vender mi auto.',
      '',
      `Nombre: ${data.nombre || '—'}`,
      `Celular: ${data.celular || '—'}${data.zona ? ' · ' + data.zona : ''}`,
      '',
      `Auto: ${car || '—'}`,
      `Kilómetros: ${data.km ? thousands(digits(data.km)) : '—'}`,
      `${data.combustible} · ${data.transmision}`,
      `Precio pretendido: ${digits(data.precio) ? 'U$S ' + thousands(digits(data.precio)) : 'a conversar'}`,
      `Permuta: ${data.permuta}`,
    ];
    if (data.comentarios) lines.push('', `Comentarios: ${data.comentarios}`);
    lines.push('', 'Les mando las fotos del auto por acá a continuación.');
    return lines.join('\n');
  },
};

document.querySelectorAll('form[data-wa-form]').forEach((form) => {
  const build = builders[form.dataset.waForm];
  const number = form.dataset.waNumber;
  const preview = document.querySelector('[data-wa-preview]');
  const error = document.querySelector('[data-wa-error]');
  const sent = document.querySelector('[data-wa-sent]');
  const read = () => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
  const link = () => `https://wa.me/${number}?text=${encodeURIComponent(build(read()))}`;

  const refresh = () => {
    if (preview) preview.textContent = build(read());
    if (error && form.checkValidity()) error.hidden = true;
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
    if (invalid) {
      if (error) error.hidden = false;
      invalid.focus();
      form.reportValidity();
      return;
    }
    const url = link();
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else window.location.href = url;
    if (sent) {
      sent.hidden = false;
      sent.querySelector('[data-wa-retry]')?.setAttribute('href', url);
    }
  });
});
