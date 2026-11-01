import { config } from './config.js';
import { createApp } from './app.js';
import { displayPhone } from './whatsapp.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Automotora Carlitos en http://localhost:${config.port}`);
  console.log(`Consultas de WhatsApp a ${displayPhone()} (+${config.whatsappNumber})`);
  if (!app.locals.store.adminCount()) {
    console.log('Todavía no hay cuenta de admin. Creala con: npm run crear-admin');
  }
});
