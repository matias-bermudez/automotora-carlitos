import path from 'node:path';
import crypto from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

const whatsappNumber = (process.env.WHATSAPP_NUMBER || '59891969322').replace(/\D/g, '');

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en producción (ver .env.example).');
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, ''),
  dataDir: path.resolve(process.env.DATA_DIR || './data'),
  // Sin SESSION_SECRET (solo en desarrollo) las sesiones se invalidan al reiniciar.
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  whatsappNumber,
};

// Datos fijos del local, usados en todas las páginas.
export const business = {
  name: 'Automotora Carlitos',
  address: 'Cno. Cibils 5700',
  addressLong: 'Camino Cibils 5700',
  area: 'Paso de la Arena, Montevideo 12600',
  hoursShort: 'Lun a Vie 8:30–19 · Sáb 8:30–16',
  hours: [
    ['Lunes a viernes', '8:30 a 19:00'],
    ['Sábados', '8:30 a 16:00'],
    ['Domingos', null],
  ],
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Camino+Cibils+5700+Montevideo+Uruguay',
  instagramUrl: 'https://www.instagram.com/automotora_carlitos_cibils5700/',
  instagramHandle: '@automotora_carlitos_cibils5700',
  tiktokUrl: 'https://www.tiktok.com/@franco.molina.2023',
  tiktokHandle: 'franco.molina.2023',
  sellerInstagramUrl: 'https://www.instagram.com/franco_molina47/',
  sellerInstagramHandle: '@franco_molina47',
  followers: '+5.200',
};
