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

## Autos de ejemplo

`ejemplos.sql` carga los 12 autos del diseño (sin fotos, marcados con `extra.ejemplo`). Se pega en Supabase → SQL Editor → Run.
Para sacarlos: `delete from public.autos where concesionaria = 'carlitos' and extra ? 'ejemplo';`
