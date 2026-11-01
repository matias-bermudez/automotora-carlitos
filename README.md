# Automotora Carlitos — sitio web

Sitio de **Automotora Carlitos** (Cno. Cibils 5700, Paso de la Arena, Montevideo): catálogo de autos usados con ficha por auto, formulario para vender tu auto y un panel para cargar el stock.

Toda la interacción con la gente es por **WhatsApp**: nadie se registra ni crea cuentas.

- **Ficha del auto** → botón *Me interesa este auto*: abre WhatsApp con un mensaje tipo
  _"Hola! Me interesa el Chevrolet Onix 1.0 Turbo LT 2021 (U$S 16.900) que vi en la web. ¿Sigue disponible?"_ + el link de la publicación.
- **Vendé tu auto** → formulario con los datos básicos. Al enviarlo se abre WhatsApp con todo armado y se le pide a la persona que mande las **fotos por ese mismo chat** (WhatsApp no permite adjuntar fotos desde un link).
- **Contacto** (en la portada) → nombre, teléfono y consulta, también directo a WhatsApp.
- **Admin** (`/admin`) → una sola cuenta. Cargar, editar y borrar autos, subir fotos desde el celular, elegir portada, marcar destacado y cambiar el estado.

### Estados de un auto

| Estado | En la web |
| --- | --- |
| Borrador | No se ve (solo el admin puede previsualizarlo) |
| Disponible | En el catálogo |
| Reservado | En el catálogo con la etiqueta "Reservado" |
| Vendido | Sale del catálogo pero queda en el historial del admin. Su link sigue andando y muestra "Vendido" con un botón para consultar por uno similar |

## Stack

- Node.js ≥ 22.13 + Express 5, vistas EJS renderizadas en el servidor (así los links compartidos en WhatsApp muestran foto y título).
- SQLite con el módulo que trae Node (`node:sqlite`), sin dependencias nativas.
- Fotos guardadas en disco. El panel las achica en el navegador (1600 px, JPEG) antes de subirlas.
- Diseño original de Claude Design en [`design/`](design/).

## Correrlo en tu compu

```bash
npm install
cp .env.example .env      # y completá SESSION_SECRET
npm run crear-admin       # te pide usuario y contraseña
npm run seed              # opcional: carga los 12 autos de ejemplo del diseño
npm run dev               # http://localhost:3000
```

Tests: `npm test`.

## Configuración (`.env`)

| Variable | Para qué |
| --- | --- |
| `WHATSAPP_NUMBER` | Número que recibe las consultas, con código de país y sin `+` (ej. `59891969322`). **Ahora está el de pruebas (091 969 322). Antes de publicar, cambiarlo al oficial: `59896665018`.** |
| `SITE_URL` | Dominio público, ej. `https://automotoracarlitos.com.uy`. Se usa en los links que van por WhatsApp. |
| `SESSION_SECRET` | Clave larga y aleatoria para la sesión del admin. Obligatoria en producción. |
| `DATA_DIR` | Carpeta de la base de datos y las fotos. En producción tiene que ser un disco persistente. |
| `PORT` | Puerto (por defecto 3000). |

El resto de los datos del local (dirección, horarios, Instagram, TikTok) están en [`src/config.js`](src/config.js).

## Publicarlo

Necesita un servidor con **disco persistente** (ahí viven la base y las fotos). Opciones simples:

- **Railway** o **Fly.io**: usan el `Dockerfile` del repo. Montar un volumen en `/data`.
- **Render**: servicio web + *persistent disk* montado en `/data`.
- Un VPS cualquiera con Node 22 y `npm start` detrás de nginx.

En cualquier caso: definir `NODE_ENV=production`, `SESSION_SECRET`, `SITE_URL`, `WHATSAPP_NUMBER`, y después correr una vez `npm run crear-admin` (o con `ADMIN_USERNAME` y `ADMIN_PASSWORD` como variables para hacerlo sin preguntas).

**Backup**: alcanza con copiar la carpeta `DATA_DIR` (archivo `automotora.sqlite` + carpeta `uploads/`).

## Estructura

```
src/
  server.js          arranque
  app.js             app de Express (headers, estáticos, helpers de vistas)
  config.js          variables de entorno y datos del local
  db.js              esquema SQLite y consultas
  auth.js            contraseñas (scrypt), cookie de sesión firmada, freno al login
  whatsapp.js        links wa.me y mensajes de cada auto
  routes/public.js   portada, catálogo, ficha, vendé tu auto, sitemap
  routes/admin.js    login y ABM de autos/fotos
views/               plantillas EJS (sitio y admin)
public/              CSS, JS del navegador e íconos
scripts/             crear-admin y seed de ejemplo
test/                tests con node:test
design/              HTML original de Claude Design
```
