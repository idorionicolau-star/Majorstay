/**
 * Constante central da marca MajorStay.
 * Qualquer alteração de nome, logótipo, cores ou textos de suporte é feita exclusivamente aqui.
 */
export const BRAND = {
  name: 'MajorStay',
  shortName: 'MajorStay',
  fullName: 'MajorStay — Gestão de Quartos e Estadias',
  tagline: 'Gestão inteligente de quartos, estadias e bar',
  description: 'Sistema de controlo de quartos em tempo real, cobrança por hora ou pernoita, vendas de bar e fecho de caixa sem desvios.',
  currency: 'MT',
  currencySuffix: 'MTn',
  domain: 'majorstay.app',
  support: {
    whatsappDisplay: '84 233 3717',
    whatsappRaw: '258842333717',
    email: 'contacto@majorstay.app',
  },
  colors: {
    primary: '#2563eb', // Blue
    primaryHover: '#1d4ed8',
    darkBg: '#0f172a',
    lightBg: '#f8fafc',
  },
} as const;
