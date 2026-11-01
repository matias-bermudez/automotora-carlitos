// Formatos de Uruguay: punto como separador de miles (48.000), precios en dólares (U$S).

export function thousands(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function priceLabel(price) {
  return price ? 'U$S ' + thousands(price) : 'Consultar';
}

export function kmLabel(km) {
  return thousands(km) + ' km';
}

// "Chevrolet Onix 1.0 Turbo LT" → "chevrolet-onix-1-0-turbo-lt"
export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "Línea uno\n\nLínea dos" → ["Línea uno", "Línea dos"]
export function lines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Convierte "16.900", "U$S 16900" o "16,900" a 16900. Vacío → null.
export function parseInteger(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}
