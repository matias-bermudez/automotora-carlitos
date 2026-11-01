// Carga los autos de ejemplo del diseño para probar el sitio (sin fotos).
// Solo corre si la base está vacía, así no ensucia el stock real.
//   npm run seed
import { config } from '../src/config.js';
import { createStore, openDb } from '../src/db.js';

const store = createStore(openDb(config.dataDir));

if (store.statusCounts().total > 0) {
  console.log('La base ya tiene autos cargados, no se agregó nada.');
  process.exit(0);
}

const onixDescription = `Onix LT con motor 1.0 turbo, muy económico para el uso diario. Services al día, cubiertas en buen estado y papeles listos para transferir.
Vení a verlo y probarlo al local. Tomamos tu usado como parte de pago.`;

const onixEquipment = ['Aire acondicionado', 'Dirección asistida', 'Levantavidrios eléctricos', 'Cierre centralizado', 'Pantalla multimedia', 'Cámara de retroceso', 'Airbags frontales y laterales', 'Control de estabilidad'].join('\n');

// marca, modelo, año, km, transmisión, precio, tipo, etiqueta
const demo = [
  ['Chevrolet', 'Onix 1.0 Turbo LT', 2021, 48000, 'Manual', 16900, 'Hatch', 'Recién ingresado'],
  ['Volkswagen', 'Polo 1.6 MSI Comfortline', 2020, 55000, 'Automático', 17500, 'Hatch', ''],
  ['Hyundai', 'HB20 1.6 Premium', 2019, 61000, 'Automático', 14900, 'Hatch', 'Único dueño'],
  ['Chevrolet', 'Tracker 1.2 Turbo LT', 2021, 39000, 'Automático', 23900, 'SUV', 'Recién ingresado'],
  ['Volkswagen', 'Gol Trend 1.6', 2018, 72000, 'Manual', 10500, 'Hatch', ''],
  ['Hyundai', 'Accent 1.4 GL', 2015, 98000, 'Manual', 8900, 'Sedán', 'Oportunidad'],
  ['Chevrolet', 'Prisma 1.4 LTZ', 2017, 80000, 'Manual', 11200, 'Sedán', ''],
  ['Volkswagen', 'Saveiro 1.6 Cabina Simple', 2017, 110000, 'Manual', 12800, 'Pickup', ''],
  ['Renault', 'Sandero 1.6 Expression', 2019, 66000, 'Manual', 12400, 'Hatch', ''],
  ['Toyota', 'Etios 1.5 XLS Sedán', 2018, 74000, 'Manual', 13600, 'Sedán', ''],
  ['Hyundai', 'Creta 1.6 Premium', 2020, 58000, 'Automático', 21500, 'SUV', 'Único dueño'],
  ['Fiat', 'Strada 1.4 Working', 2019, 92000, 'Manual', 14200, 'Pickup', ''],
];

// Se insertan al revés para que el primero de la lista quede como el más reciente.
for (const [brand, model, year, km, transmission, price, body_type, badge] of [...demo].reverse()) {
  const isOnix = model.startsWith('Onix');
  store.createCar({
    brand, model, year, km, price, transmission, body_type, badge,
    fuel: 'Nafta',
    engine: isOnix ? '1.0 Turbo' : model.match(/\d\.\d/)?.[0] ?? '',
    color: isOnix ? 'Gris plata' : '',
    doors: body_type === 'Pickup' ? 2 : body_type === 'Sedán' ? 4 : 5,
    description: isOnix ? onixDescription : '',
    equipment: isOnix ? onixEquipment : '',
    status: 'disponible',
    featured: isOnix,
  });
}

console.log(`Se cargaron ${demo.length} autos de ejemplo.`);
