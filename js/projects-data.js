// Datos de proyectos de muestra (falsos) compartidos entre resultados.html
// y proyecto.html para esta versión preliminar de FUTURA.
//
// bancosDisponibles: como los proyectos no viven en una tabla de Supabase
// todavía (son datos estáticos acá, igual que las desarrolladoras en
// js/developers-data.js), este campo reemplaza a la tabla `bancos_disponibles`
// pedida originalmente — es la forma de "configurar qué bancos aplican a
// cada proyecto" mientras no exista una tabla `projects` real en Supabase.
// El día que los proyectos se muevan a Supabase, este array pasa a ser una
// columna text[] (o una tabla de unión projects_bancos) sin cambiar la
// interfaz que usa proyecto.js.
//
// amenities: cada amenidad es un objeto { name, description, photos, icon }
// — photos es opcional (array de URLs; vacío en todos los datos de fábrica
// porque no hay assets reales todavía) e icon es el respaldo visual que se
// muestra en la tarjeta cuando no hay fotos (ver js/amenity-icons.js). Lo
// que el equipo edita desde admin.html no toca este array: se guarda como
// override en localStorage vía js/amenities-mock.js, mismo patrón que
// "destacado". AMENITY() arma el objeto a partir de una pequeña librería de
// nombres conocidos para no repetir descripción/ícono cada vez que el mismo
// tipo de amenidad aparece en más de un proyecto.
const AMENITY_LIBRARY = {
  "Piscina": { description: "Piscina para adultos, con área de descanso y sombra techada.", icon: "pool" },
  "Piscina infinita": { description: "Piscina de borde infinito con vista despejada y camastros.", icon: "pool" },
  "Gimnasio": { description: "Gimnasio equipado de aprox. 60 m², con cardio y pesas libres.", icon: "gym" },
  "Coworking": { description: "Espacio de coworking con wifi de alta velocidad y sala de reuniones.", icon: "coworking" },
  "Seguridad 24/7": { description: "Vigilancia las 24 horas con control de acceso y cámaras en zonas comunes.", icon: "security" },
  "Áreas verdes": { description: "Zonas ajardinadas de uso común para caminar o pasar tiempo al aire libre.", icon: "garden" },
  "Salón de eventos": { description: "Salón techado para reuniones y celebraciones, con capacidad para grupos grandes.", icon: "event-hall" },
  "Cancha multiuso": { description: "Cancha techada para fútbol sala, básquet y otros deportes.", icon: "sport-court" },
  "Rooftop": { description: "Terraza en la azotea con vista panorámica y zona de descanso.", icon: "rooftop" },
  "Pet-friendly": { description: "Espacio habilitado para mascotas, con área de esparcimiento.", icon: "pet" },
  "Parque infantil": { description: "Zona de juegos infantiles con superficie de seguridad.", icon: "playground" },
  "Club house": { description: "Salón social con cocina, área de estar y espacio para eventos privados.", icon: "clubhouse" },
  "Senderos naturales": { description: "Senderos peatonales entre áreas verdes, ideales para caminar o trotar.", icon: "trail" },
  "Jardín privado": { description: "Jardín exclusivo de la vivienda, listo para personalizar.", icon: "garden" },
  "Parqueo techado": { description: "Espacio de parqueo cubierto, protegido del sol y la lluvia.", icon: "parking" },
  "Zona de juegos": { description: "Área recreativa al aire libre para niños.", icon: "playground" },
  "Portón de acceso": { description: "Acceso controlado al lote con portón vehicular.", icon: "gate" },
  "Electricidad disponible": { description: "Conexión eléctrica lista para instalar en el lote.", icon: "utilities" },
  "Agua potable": { description: "Servicio de agua potable disponible en el lote.", icon: "water" },
  "Calles asfaltadas": { description: "Calles internas asfaltadas y con acceso directo al lote.", icon: "road" },
};

function AMENITIES(names) {
  return names.map((name) => {
    const def = AMENITY_LIBRARY[name] || { description: "", icon: "default" };
    return { name, description: def.description, icon: def.icon, photos: [] };
  });
}

window.FUTURA_PROJECTS = [
  {
    id: "vista-alta-escazu",
    name: "Vista Alta Escazú",
    zone: "Escazú, San José",
    location: { lat: 9.9189, lng: -84.1439 },
    priceFrom: 185000,
    bedrooms: "2–3 hab.",
    delivery: "2027",
    propertyType: "apartamento",
    destacado: true,
    amenities: AMENITIES(["Piscina", "Gimnasio", "Coworking", "Seguridad 24/7"]),
    developer: { name: "Grupo Terra Nova", slug: "grupo-terra-nova" },
    typologies: [
      { id: "a", name: "Tipo A", sqm: 62, bedrooms: 2, bathrooms: 2 },
      { id: "b", name: "Tipo B", sqm: 88, bedrooms: 3, bathrooms: 2.5 },
    ],
    bancosDisponibles: ["BAC Credomatic", "Banco Nacional", "Banco de Costa Rica", "Scotiabank"],
  },
  {
    id: "bosques-santa-ana",
    name: "Bosques de Santa Ana",
    zone: "Santa Ana, San José",
    location: { lat: 9.9281, lng: -84.183 },
    priceFrom: 265000,
    bedrooms: "3–4 hab.",
    delivery: "2026",
    propertyType: "apartamento",
    destacado: true,
    amenities: AMENITIES(["Áreas verdes", "Piscina", "Salón de eventos", "Cancha multiuso"]),
    developer: { name: "Inversiones Cerro Alto", slug: "inversiones-cerro-alto" },
    typologies: [
      { id: "a", name: "Tipo A", sqm: 110, bedrooms: 3, bathrooms: 3 },
      { id: "b", name: "Tipo B", sqm: 145, bedrooms: 4, bathrooms: 3.5 },
    ],
    bancosDisponibles: ["BAC Credomatic", "Banco Popular", "Davivienda"],
  },
  {
    id: "terrazas-curridabat",
    name: "Terrazas Curridabat",
    zone: "Curridabat, San José",
    location: { lat: 9.9167, lng: -84.0333 },
    priceFrom: 210000,
    bedrooms: "2 hab.",
    delivery: "2027",
    propertyType: "apartamento",
    destacado: false,
    amenities: AMENITIES(["Rooftop", "Gimnasio", "Pet-friendly", "Coworking"]),
    developer: { name: "Constructora Volcán", slug: "constructora-volcan" },
    typologies: [
      { id: "a", name: "Tipo A", sqm: 58, bedrooms: 2, bathrooms: 1 },
      { id: "b", name: "Tipo B", sqm: 68, bedrooms: 2, bathrooms: 2 },
    ],
    bancosDisponibles: ["Banco Nacional", "Banco de Costa Rica", "Banco Promerica", "Scotiabank"],
  },
  {
    id: "alto-heredia",
    name: "Alto Heredia",
    zone: "Heredia centro",
    location: { lat: 10.0, lng: -84.1165 },
    priceFrom: 195000,
    bedrooms: "3 hab.",
    delivery: "2026",
    propertyType: "apartamento",
    destacado: false,
    amenities: AMENITIES(["Piscina", "Parque infantil", "Seguridad 24/7"]),
    developer: { name: "Desarrollos Montebello", slug: "desarrollos-montebello" },
    typologies: [
      { id: "a", name: "Tipo A", sqm: 95, bedrooms: 3, bathrooms: 2 },
      { id: "b", name: "Tipo B", sqm: 105, bedrooms: 3, bathrooms: 2.5 },
    ],
    bancosDisponibles: ["BAC Credomatic", "Banco Nacional", "Banco Popular"],
  },
  {
    id: "cerro-verde",
    name: "Cerro Verde Concepción",
    zone: "San Rafael de Escazú",
    location: { lat: 9.937, lng: -84.152 },
    priceFrom: 340000,
    bedrooms: "4 hab.",
    delivery: "2028",
    propertyType: "apartamento",
    destacado: true,
    amenities: AMENITIES(["Club house", "Piscina infinita", "Gimnasio", "Senderos naturales"]),
    developer: { name: "Altura Desarrollos", slug: "altura-desarrollos" },
    typologies: [
      { id: "a", name: "Tipo A", sqm: 165, bedrooms: 4, bathrooms: 3.5 },
      { id: "b", name: "Penthouse", sqm: 210, bedrooms: 4, bathrooms: 4.5 },
    ],
    bancosDisponibles: ["BAC Credomatic", "Scotiabank", "Banco Lafise", "Banco de Costa Rica"],
  },
  {
    id: "villas-del-roble",
    name: "Villas del Roble",
    zone: "Belén, Heredia",
    location: { lat: 10.0075, lng: -84.1963 },
    priceFrom: 285000,
    bedrooms: "3–4 hab.",
    delivery: "2027",
    propertyType: "casa",
    destacado: false,
    amenities: AMENITIES(["Jardín privado", "Parqueo techado", "Seguridad 24/7", "Zona de juegos"]),
    developer: { name: "Roble Real Homes", slug: "roble-real-homes" },
    typologies: [
      { id: "a", name: "Casa 3 hab.", sqm: 145, bedrooms: 3, bathrooms: 2.5 },
      { id: "b", name: "Casa 4 hab.", sqm: 180, bedrooms: 4, bathrooms: 3 },
    ],
    bancosDisponibles: ["Banco Nacional", "Banco de Costa Rica", "Banco Popular", "Davivienda"],
  },
  {
    id: "terrenos-vista-verde",
    name: "Terrenos Vista Verde",
    zone: "Ciudad Colón, San José",
    location: { lat: 9.9089, lng: -84.2394 },
    priceFrom: 95000,
    bedrooms: "Lote",
    delivery: "2026",
    propertyType: "lote",
    destacado: false,
    amenities: AMENITIES(["Portón de acceso", "Electricidad disponible", "Agua potable", "Calles asfaltadas"]),
    developer: { name: "Desarrollos Vista Verde", slug: "desarrollos-vista-verde" },
    typologies: [
      { id: "a", name: "Lote 300 m²", sqm: 300, bedrooms: 0, bathrooms: 0 },
      { id: "b", name: "Lote 450 m²", sqm: 450, bedrooms: 0, bathrooms: 0 },
    ],
    bancosDisponibles: ["Banco Nacional", "Banco de Costa Rica"],
  },
];
