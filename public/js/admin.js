// Panel de admin: cambio rápido de estado, confirmaciones y subida de fotos achicadas.

const MAX_SIDE = 1600; // px del lado más largo
const QUALITY = 0.82;

// Cambiar el estado desde la lista guarda al toque.
document.querySelectorAll('[data-autosubmit-status]').forEach((select) => {
  select.addEventListener('change', () => select.form.requestSubmit());
});

document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    if (!window.confirm(form.dataset.confirm)) e.preventDefault();
  });
});

// ---------- Fotos ----------

// Las fotos del celular pesan 4–10 MB; las pasamos a JPEG de 1600 px (~300 KB) antes de subirlas.
async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (blob) return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {}
  // Si el navegador no la pudo leer, se sube tal cual (si el formato lo permite).
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file : null;
}

const form = document.querySelector('[data-car-form]');
if (form) {
  const input = form.querySelector('[data-photo-input]');
  const preview = form.querySelector('[data-photo-preview]');
  const status = form.querySelector('[data-upload-status]');
  const errorBox = form.querySelector('[data-upload-error]');
  const submit = form.querySelector('[data-submit]');
  const pending = [];

  const renderPreview = () => {
    preview.replaceChildren(
      ...pending.map((item, i) => {
        const box = document.createElement('div');
        box.className = 'photo-item';
        box.innerHTML = '<span class="photo-new">Nueva</span><img alt=""><button type="button" class="photo-opt photo-del" style="background:none;border:0;border-top:1px solid var(--line)">Quitar</button>';
        box.querySelector('img').src = item.url;
        box.querySelector('button').addEventListener('click', () => {
          URL.revokeObjectURL(item.url);
          pending.splice(i, 1);
          renderPreview();
        });
        return box;
      })
    );
  };

  input.addEventListener('change', () => {
    for (const file of input.files) pending.push({ file, url: URL.createObjectURL(file) });
    input.value = '';
    renderPreview();
  });

  const dropzone = input.closest('.dropzone');
  ['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, () => dropzone.classList.add('dragging')));
  ['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, () => dropzone.classList.remove('dragging')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    errorBox.hidden = true;

    const data = new FormData(form);
    data.delete('photos');
    let skipped = 0;
    for (let i = 0; i < pending.length; i++) {
      status.textContent = `Preparando fotos ${i + 1} de ${pending.length}…`;
      const file = await shrink(pending[i].file);
      if (file) data.append('photos', file);
      else skipped++;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', form.action);
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) status.textContent = `Subiendo… ${Math.round((ev.loaded / ev.total) * 100)}%`;
    });
    xhr.addEventListener('load', () => {
      const landed = new URL(xhr.responseURL || form.action);
      if (xhr.status < 400 && landed.pathname === '/admin') {
        window.location.href = landed.href;
        return;
      }
      // Errores de validación: el servidor devuelve el formulario con los mensajes.
      document.open();
      document.write(xhr.responseText);
      document.close();
    });
    xhr.addEventListener('error', () => {
      submit.disabled = false;
      status.textContent = '';
      errorBox.textContent = 'No se pudo guardar. Revisá la conexión y probá de nuevo.';
      errorBox.hidden = false;
    });
    if (skipped) status.textContent = `${skipped} foto(s) en un formato que no se puede leer quedaron afuera.`;
    xhr.send(data);
  });
}
