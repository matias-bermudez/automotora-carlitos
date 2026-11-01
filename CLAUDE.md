# Automotora Carlitos — web

Web de **Automotora Carlitos** (autos usados, Cno. Cibils 5700, Paso de la Arena, Montevideo). Parte de la Plataforma Automotoras: reglas en `~/Proyectos/plataforma-automotoras/README.md`, implementación de referencia `~/Proyectos/DNAutos`.

- Repo: https://github.com/matias-bermudez/automotora-carlitos (tiene que ser **público**: Pages gratis no publica privados)
- Web: https://matias-bermudez.github.io/automotora-carlitos/ · panel en `/admin/`
- Seguimiento: issues del repo; los commits los cierran con `Closes #N`.

## Stack

Sitio estático: `scripts/generar.js` (Node 22, sin dependencias, ESM) → `_site/` (no se commitea). Workflow `publicar.yml` (Actions → Pages).
Autos en la base compartida de Supabase (`concesionaria = 'carlitos'`). **No cambiar el esquema desde acá**: lo que falte va en `autos.extra` o se pide en el repo de la plataforma.
No hay acceso de escritura a la base desde acá: cambios de datos = archivo `.sql` para pegar en el SQL Editor.

Mapeo propio de Carlitos: borrador = `publicado false`; fecha de venta = `extra.vendido_el`; tipo del diseño (Hatch, SUV…) = `carroceria`; transmisión "Manual" / "Automático"; `negocios.zonas` = barrio y ciudad (`zona`). Ver `supabase/LEEME.md`.
Datos del negocio (regla 12): la fila de `negocios` pisa a `js/config.js` al publicar; el generador reescribe el `js/config.js` de `_site/`. Ningún número, dirección u horario a mano en plantillas o JS. Probar sin la base: `--negocio fila.json` junto con `--datos`.

Probar: `node scripts/generar.js --local --datos test/autos.json --fotos test/fotos && python3 -m http.server 8792 -d _site`. Tests: `npm test`.
Python http.server no sirve el 404.html: para probar la ficha de un auto vendido, abrir `/404.html` o usar un server que lo haga.

## WhatsApp

Todo contacto es `https://wa.me/<numero>?text=...`, sin cuentas ni backend. **Número de prueba de Matías: 091 969 322 (59891969322)**, en `js/config.js`. El oficial (096 665 018 / 59896665018) va recién al lanzar (issue #1). `indexar: false` hasta entonces.
Si ya hay fila en `negocios`, el número se cambia desde el panel (Datos del negocio): la fila manda sobre config.js.

## Verificación visual

Playwright de otro proyecto: `require('/Users/matibermudez/Proyectos/TapStore-listas/node_modules/playwright')`, `devices['iPhone 13']` para 390 px.

## Registro

- 2026-10-31: primera versión con Express + EJS + SQLite (issues #1–#4).
- 2026-11-01: pasa a la Plataforma Automotoras: sitio estático, Supabase, panel estático, GitHub Pages (#5–#8). Repo pasado a público.
