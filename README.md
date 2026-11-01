# Automotora Carlitos — web

Sitio de **Automotora Carlitos** (Cno. Cibils 5700, Paso de la Arena, Montevideo): catálogo de autos usados con ficha por auto, formulario para vender tu auto y un panel para cargar el stock.

**Web:** https://matias-bermudez.github.io/automotora-carlitos/ · **Panel:** https://matias-bermudez.github.io/automotora-carlitos/admin/

Toda la interacción con la gente es por **WhatsApp**: nadie se registra ni crea cuentas.

- **Ficha del auto** → botón *Me interesa este auto*: abre WhatsApp con un mensaje tipo
  _"Hola! Me interesa el Chevrolet Onix 1.0 Turbo LT 2021 (U$S 16.900) que vi en la web. ¿Sigue disponible?"_ + el link de la publicación. También *Llamar* y *Coordinar visita*.
- **Vendé tu auto** → formulario con los datos básicos. Al enviarlo se abre WhatsApp con todo armado y se le pide a la persona que mande las **fotos por ese mismo chat** (WhatsApp no permite adjuntar fotos desde un link).
- **Contacto** (en el inicio) → nombre, teléfono y consulta, también directo a WhatsApp.
- **Panel** (`/admin/`) → cargar, editar y borrar autos, subir fotos desde el celular, elegir portada, destacado de la semana y estado.

### Estados de un auto

| Estado | En la web |
| --- | --- |
| Borrador | No se ve |
| Disponible | En el catálogo |
| Reservado | En el catálogo con el cartel "Reservado" |
| Vendido | Sale de la web y queda en el historial del panel con la fecha de venta. Su link cae en el 404, que avisa que ya no está y ofrece consultar por uno parecido |

## Cómo funciona

Misma arquitectura que el resto de la Plataforma Automotoras (`~/Proyectos/plataforma-automotoras`, referencia: DN Automóviles).

- **Sin servidor.** `scripts/generar.js` (Node 22, sin dependencias) arma todo el sitio en `_site/`: inicio, catálogo, una página por auto (`/autos/<slug>/`), Vendé tu auto, 404, panel, `sitemap.xml` y `robots.txt`.
- **Datos:** base compartida de Supabase, filas de `autos` con `concesionaria = 'carlitos'`. La web no consulta Supabase en vivo: el generador lee los autos, **baja las fotos** y escribe el HTML final.
- **Publicación:** GitHub Actions (`.github/workflows/publicar.yml`) genera y publica en GitHub Pages en cada push a `main`, cuando se guarda un auto en el panel (Supabase dispara el workflow) y cada 15 minutos si cambiaron los autos.
- **Panel:** página estática con supabase-js; login con email y contraseña de Supabase. Solo entran los emails de la tabla `admins` con `carlitos` (o `*`).

## Configuración (`js/config.js`)

- `whatsapp` / `whatsappLabel`: número de todos los botones. **Ahora es el de pruebas (091 969 322). Antes de lanzar: `59896665018` / `096 665 018`** (issue #1).
- Dirección, horarios, Instagram, TikTok y vendedor.
- `supabaseUrl`, `supabaseKey` (clave pública), `concesionaria: 'carlitos'`.
- `sitio`: URL pública con `/` al final (cambiarla si se compra dominio).
- `indexar`: `false` = `noindex` hasta lanzar.

## Probar en tu compu

```sh
npm run local      # genera con los autos de Supabase y sirve en http://localhost:8792
npm test           # tests del generador (con test/autos.json, sin conexión)
```

Sin conexión a la base: `node scripts/generar.js --local --datos test/autos.json --fotos test/fotos`.

## Dar de alta (una vez)

1. En el SQL Editor de Supabase: `update public.concesionarias set sitio = 'https://matias-bermudez.github.io/automotora-carlitos/', repo = 'matias-bermudez/automotora-carlitos' where id = 'carlitos';`
2. Sumar este repo al token de GitHub `dn-automoviles-publicar` (Settings → Developer settings → Fine-grained tokens → Edit → Repository access).
3. Usuario del panel: Authentication → Users → Add user (Auto Confirm) y `insert into public.admins (email, concesionaria) values ('...', 'carlitos');`
4. Opcional: `supabase/ejemplos.sql` carga los 12 autos de ejemplo del diseño.

## Estructura

```
scripts/generar.js   arma _site/ (plantillas + autos de Supabase + fotos)
src/                 plantillas: {{ dato }} y {{> parcial }} (parciales en src/_partials/)
js/config.js         datos del negocio, WhatsApp, Supabase, URL del sitio
js/common.js         helpers compartidos entre navegador y generador (tarjetas, links de WhatsApp, íconos)
js/catalogo.js       filtros del catálogo (en la URL)
js/ficha.js          galería de fotos
js/formularios.js    contacto y Vendé tu auto → WhatsApp
js/no-encontrado.js  404 de autos que ya no están
js/admin.js          panel (supabase-js 2.45.4 desde jsdelivr)
css/                 estilos del sitio y del panel
supabase/            notas de la base y ejemplos.sql
test/                tests del generador con autos de prueba
design/              HTML original de Claude Design
```
