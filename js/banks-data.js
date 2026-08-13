// Directorio de bancos de muestra (falsos) — compartido entre todos los
// proyectos, igual que js/developers-data.js. Cada proyecto solo referencia
// bancos por nombre en su campo bancosDisponibles (js/projects-data.js); la
// tasa, el plazo, el financiamiento y los requisitos viven acá una sola vez
// porque son datos del banco, no del proyecto, y cambian con frecuencia —
// lo que el equipo edita desde admin.html se guarda como override en
// localStorage vía js/banks-mock.js, mismo patrón que "destacado".
window.FUTURA_BANKS = [
  {
    name: "BAC Credomatic",
    interestRate: 8.75,
    maxTermYears: 30,
    financingPercent: 80,
    requirements: "Ingreso mínimo comprobable de ₡800,000/mes, buen historial crediticio (CIC) y prima mínima del 20%.",
  },
  {
    name: "Banco Nacional",
    interestRate: 9.25,
    maxTermYears: 30,
    financingPercent: 85,
    requirements: "Cuenta activa en BN, ingreso mínimo de ₡700,000/mes y sin morosidad en el CIC.",
  },
  {
    name: "Banco de Costa Rica",
    interestRate: 9.1,
    maxTermYears: 25,
    financingPercent: 80,
    requirements: "Historial crediticio limpio e ingreso familiar mínimo de ₡750,000/mes.",
  },
  {
    name: "Scotiabank",
    interestRate: 8.95,
    maxTermYears: 30,
    financingPercent: 80,
    requirements: "Ingreso mínimo comprobable, seguro de vida y de incendio obligatorios.",
  },
  {
    name: "Banco Popular",
    interestRate: 9.5,
    maxTermYears: 25,
    financingPercent: 90,
    requirements: "Afiliación como asociado e ingreso mínimo de ₡650,000/mes.",
  },
  {
    name: "Davivienda",
    interestRate: 8.9,
    maxTermYears: 30,
    financingPercent: 80,
    requirements: "Ingreso mínimo comprobable y antigüedad laboral mínima de 1 año.",
  },
  {
    name: "Banco Promerica",
    interestRate: 9.4,
    maxTermYears: 25,
    financingPercent: 75,
    requirements: "Buen historial crediticio y prima mínima del 25%.",
  },
  {
    name: "Banco Lafise",
    interestRate: 9.6,
    maxTermYears: 20,
    financingPercent: 70,
    requirements: "Ingreso alto comprobable y prima mínima del 30%.",
  },
];
