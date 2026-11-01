// Datos del negocio y de la publicación. Después de cambiar algo hay que publicar (push a main):
// el sitio se regenera solo.
//
// whatsapp: por ahora el número de prueba de Matías (091 969 322).
// Antes de lanzar: el oficial de Automotora Carlitos, 59896665018 / '096 665 018' (issue #1).
window.CARLITOS_CONFIG = {
  whatsapp: '59891969322',      // código de país + número, sin 0 ni espacios
  whatsappLabel: '091 969 322',

  direccion: 'Cno. Cibils 5700',
  direccionLarga: 'Camino Cibils 5700',
  zona: 'Paso de la Arena, Montevideo 12600',
  horarioCorto: 'Lun a Vie 8:30–19 · Sáb 8:30–16',
  horarios: [
    ['Lunes a viernes', '8:30 a 19:00'],
    ['Sábados', '8:30 a 16:00'],
    ['Domingos', '']
  ],
  horarioSchema: 'Mo-Fr 08:30-19:00, Sa 08:30-16:00',  // el mismo horario para Google
  mapa: 'https://www.google.com/maps/search/?api=1&query=Camino+Cibils+5700+Montevideo+Uruguay',
  instagram: 'automotora_carlitos_cibils5700',
  tiktok: 'franco.molina.2023',
  vendedorInstagram: 'franco_molina47',
  seguidores: '+5.200',
  dolar: 40,                    // pesos por dólar, aproximado: solo para filtrar y ordenar autos en pesos

  // Supabase: base compartida de la Plataforma Automotoras (~/Proyectos/plataforma-automotoras).
  // `concesionaria` = id de esta automotora en la base. La clave es la pública (publishable):
  // puede ir en el código, los permisos los pone el schema.sql de la plataforma.
  supabaseUrl: 'https://dfunhdfvtmsmjdzpnhas.supabase.co',
  supabaseKey: 'sb_publishable_4Q-GxNAtPB894PRurMLwkQ_2NRVIjWg',
  concesionaria: 'carlitos',

  // URL pública del sitio, con / al final. Si se compra dominio, cambiarla acá.
  sitio: 'https://matias-bermudez.github.io/automotora-carlitos/',

  // false = Google no indexa la web (meta noindex). Pasar a true al lanzar, con el número oficial.
  indexar: false
};
