# Vídeo "O seu stock sempre certo" (Remotion)

Vídeo vertical (1080×1920, 30 s) para redes sociais e afiliados, com capturas reais da app:

1. **Entrada de stock** — Stock Rápido → "cimento 50" → lote (240 → 290) → confirmar.
2. **Produto com variações** — "Pavê" → produto novo (categoria sugerida) → cores Vermelho/Cinzento/Preto com quantidades → 3 variações no lote.
3. **Inventário** — Cimento com 290, a família Pavê agrupada com o stock de cada cor, e o alerta do que está a acabar.

- Vídeo pronto: `stock-em-30-segundos.mp4`
- Cenas em `src/Scenes.tsx` (usam `src/PhoneScene.tsx`: telemóvel, legendas, toques e destaques); montagem em `src/Video.tsx`.
- Capturas e letra em `public/`.

```bash
cd marketing/stock-30s
npm i
npx remotion studio
npx remotion render StockEm30s out/stock-em-30-segundos.mp4
```
