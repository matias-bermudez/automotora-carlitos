-- Autos de ejemplo de Automotora Carlitos: los 12 del diseño original, sin fotos.
-- Sirven para ver la web con contenido hasta cargar el stock real (issue #3).
--
-- Requiere el esquema compartido (plataforma-automotoras/supabase/schema.sql) ya aplicado.
-- Pegar en Supabase → SQL Editor → Run. Se puede correr más de una vez: no duplica.
--
-- Para borrarlos cuando haya autos reales:
--   delete from public.autos where concesionaria = 'carlitos' and extra ? 'ejemplo';

insert into public.autos
  (concesionaria, slug, marca, modelo, anio, km, tipo, carroceria, combustible, transmision, motor, color, puertas, precio, etiqueta, destacado, equipamiento, descripcion, extra, created_at)
values
  ('carlitos', 'chevrolet-onix-1-0-turbo-lt-2021', 'Chevrolet', 'Onix 1.0 Turbo LT', 2021, 48000, 'auto', 'Hatch', 'Nafta', 'Manual', '1.0 Turbo', 'Gris plata', 5, 16900, 'Recién ingresado', true, array['Aire acondicionado', 'Dirección asistida', 'Levantavidrios eléctricos', 'Cierre centralizado', 'Pantalla multimedia', 'Cámara de retroceso', 'Airbags frontales y laterales', 'Control de estabilidad'], 'Onix LT con motor 1.0 turbo, muy económico para el uso diario. Services al día, cubiertas en buen estado y papeles listos para transferir.' || chr(10) || 'Vení a verlo y probarlo al local. Tomamos tu usado como parte de pago.', '{"ejemplo": true}', now() - interval '1 minutes'),
  ('carlitos', 'volkswagen-polo-1-6-msi-comfortline-2020', 'Volkswagen', 'Polo 1.6 MSI Comfortline', 2020, 55000, 'auto', 'Hatch', 'Nafta', 'Automático', '1.6', null, 5, 17500, null, false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '2 minutes'),
  ('carlitos', 'hyundai-hb20-1-6-premium-2019', 'Hyundai', 'HB20 1.6 Premium', 2019, 61000, 'auto', 'Hatch', 'Nafta', 'Automático', '1.6', null, 5, 14900, 'Único dueño', false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '3 minutes'),
  ('carlitos', 'chevrolet-tracker-1-2-turbo-lt-2021', 'Chevrolet', 'Tracker 1.2 Turbo LT', 2021, 39000, 'camioneta', 'SUV', 'Nafta', 'Automático', '1.2', null, 5, 23900, 'Recién ingresado', false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '4 minutes'),
  ('carlitos', 'volkswagen-gol-trend-1-6-2018', 'Volkswagen', 'Gol Trend 1.6', 2018, 72000, 'auto', 'Hatch', 'Nafta', 'Manual', '1.6', null, 5, 10500, null, false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '5 minutes'),
  ('carlitos', 'hyundai-accent-1-4-gl-2015', 'Hyundai', 'Accent 1.4 GL', 2015, 98000, 'auto', 'Sedán', 'Nafta', 'Manual', '1.4', null, 4, 8900, 'Oportunidad', false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '6 minutes'),
  ('carlitos', 'chevrolet-prisma-1-4-ltz-2017', 'Chevrolet', 'Prisma 1.4 LTZ', 2017, 80000, 'auto', 'Sedán', 'Nafta', 'Manual', '1.4', null, 4, 11200, null, false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '7 minutes'),
  ('carlitos', 'volkswagen-saveiro-1-6-cabina-simple-2017', 'Volkswagen', 'Saveiro 1.6 Cabina Simple', 2017, 110000, 'camioneta', 'Pickup', 'Nafta', 'Manual', '1.6', null, 2, 12800, null, false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '8 minutes'),
  ('carlitos', 'renault-sandero-1-6-expression-2019', 'Renault', 'Sandero 1.6 Expression', 2019, 66000, 'auto', 'Hatch', 'Nafta', 'Manual', '1.6', null, 5, 12400, null, false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '9 minutes'),
  ('carlitos', 'toyota-etios-1-5-xls-sedan-2018', 'Toyota', 'Etios 1.5 XLS Sedán', 2018, 74000, 'auto', 'Sedán', 'Nafta', 'Manual', '1.5', null, 4, 13600, null, false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '10 minutes'),
  ('carlitos', 'hyundai-creta-1-6-premium-2020', 'Hyundai', 'Creta 1.6 Premium', 2020, 58000, 'camioneta', 'SUV', 'Nafta', 'Automático', '1.6', null, 5, 21500, 'Único dueño', false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '11 minutes'),
  ('carlitos', 'fiat-strada-1-4-working-2019', 'Fiat', 'Strada 1.4 Working', 2019, 92000, 'camioneta', 'Pickup', 'Nafta', 'Manual', '1.4', null, 2, 14200, null, false, '{}'::text[], null, '{"ejemplo": true}', now() - interval '12 minutes')
on conflict (concesionaria, slug) do nothing;
