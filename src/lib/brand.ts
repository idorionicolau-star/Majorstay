/**
 * Constante central da marca MajorStay.
 * Qualquer alteração de nome, logótipo, cores ou textos de suporte é feita exclusivamente aqui.
 */
export const BRAND = {
  name: 'MajorStay',
  shortName: 'MajorStay',
  fullName: 'MajorStay — Gestão de Quartos, Estadias e Hotelaria',
  tagline: 'Gestão inteligente de quartos, estadias e bar',
  description: 'Sistema especializado em hotelaria, lodges e guest houses: controlo de quartos em tempo real, cobrança por hora ou pernoita, bar e fecho de caixa sem desvios.',
  currency: 'MT',
  currencySuffix: 'MTn',
  domain: 'majorstay.app',
  support: {
    whatsappDisplay: '84 233 3717',
    whatsappRaw: '258842333717',
    email: 'contacto@majorstay.app',
  },
  colors: {
    primary: '#ba5a1a', // Terracota Hotelaria Nobre
    primaryHover: '#9c4811', // Terracota Profundo
    gold: '#df9e42', // Ouro Champagne / Âmbar
    darkBg: '#1e1714', // Ébano Amadeirado / Espresso
    lightBg: '#faf7f2', // Linho Nobre / Warm Alabaster
    nude: '#efebe4', // Areia / Taupe Suave
  },
} as const;
