# Base de datos

Automotora Carlitos usa la base **compartida** de la Plataforma Automotoras (un solo proyecto de Supabase para todas las automotoras).
El esquema y las reglas están en `~/Proyectos/plataforma-automotoras` (repo `matias-bermudez/plataforma-automotoras`).
No cambiar el esquema desde acá.

En `js/config.js`, `concesionaria: 'carlitos'` es el id de Carlitos en esa base.

## Qué guarda Carlitos en cada columna

| En el panel | En la base |
| --- | --- |
| Borrador | `publicado = false` |
| Disponible / Reservado / Vendido | `publicado = true` y `estado` |
| Fecha de venta (historial) | `extra.vendido_el` (`AAAA-MM-DD`), se pone al marcarlo Vendido |
| Tipo (Hatch, SUV, Pickup…) | `carroceria`; `tipo` se deduce (SUV y Pickup = camioneta, Utilitario = utilitario) |
| Destacado de la semana | `destacado` (el panel deja uno solo) |
| Equipamiento (uno por renglón) | `equipamiento` (text[]) |

## Datos del negocio (tabla `negocios`)

Los edita el dueño en el panel → **Datos del negocio** (upsert de la fila de `carlitos`). Al publicar, `scripts/generar.js`
los pone encima de `js/config.js` en todo el HTML y en el `js/config.js` publicado. Columna vacía (`null`) = queda el de config.js.

| En el panel | En la base | En config.js |
| --- | --- | --- |
| WhatsApp ("095 407 252") | `whatsapp` = `59895407252`, `telefono` = `095 407 252` | `whatsapp`, `whatsappLabel` |
| Dirección | `direccion` | `direccion` y `direccionLarga` (y el link del mapa) |
| Barrio y ciudad | `zonas` | `zona` (el código postal para Google sale de acá) |
| Horario | `horario` | `horarioCorto`; si cambia, la tabla de horarios se arma con sus partes ("Lun a Vie 9–18 · Sáb 9–13") y se deja de mandar el horario a Google |
| Instagram / TikTok | `instagram`, `tiktok` | `instagram`, `tiktok` |

**Ojo:** cuando la fila existe, manda ella. El número oficial (issue #1) se cambia desde el panel, no en config.js.

## Autos de ejemplo

`ejemplos.sql` carga los 12 autos del diseño (sin fotos, marcados con `extra.ejemplo`). Se pega en Supabase → SQL Editor → Run.
Para sacarlos: `delete from public.autos where concesionaria = 'carlitos' and extra ? 'ejemplo';`
