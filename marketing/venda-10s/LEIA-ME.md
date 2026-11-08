# Vídeo "Uma venda em 10 segundos" (Remotion)

Vídeo vertical (1080×1920, 15 s) para redes sociais e afiliados, com capturas reais da Venda Rápida.

- Vídeo pronto: `venda-em-10-segundos.mp4`
- Cenas: `src/Intro.tsx`, `src/Sale.tsx` (cronómetro + telemóvel), `src/Outro.tsx`; montagem em `src/Video.tsx`.
- Capturas e letra em `public/`.

Editar e voltar a gerar:

```bash
cd marketing/venda-10s
npm i
npx remotion studio                 # pré-visualizar e editar
npx remotion render VendaEm10s out/venda-em-10-segundos.mp4
```

Esta pasta fica fora da compilação da app (tsconfig e eslint ignoram `marketing/`).
