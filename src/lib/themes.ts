
export type Theme = {
  name: string;
  primary: {
    light: string; // HSL value 'h s% l%'
    dark: string;
  };
};

export const themes: Theme[] = [
  { name: 'Default', primary: { light: '258 83% 65%', dark: '258 75% 70%' } },
  { name: 'Red', primary: { light: '4 70% 50%', dark: '4 75% 55%' } },
  { name: 'Crimson', primary: { light: '348 83% 47%', dark: '348 73% 42%' } },
  { name: 'Orange', primary: { light: '25 95% 53%', dark: '25 90% 48%' } },
  { name: 'Amber', primary: { light: '38 92% 53%', dark: '38 82% 48%' } },
  { name: 'Gold', primary: { light: '45 100% 51%', dark: '45 90% 46%' } },
  { name: 'Yellow', primary: { light: '45 93% 47%', dark: '48 96% 47%' } },
  { name: 'Chartreuse', primary: { light: '90 100% 50%', dark: '90 90% 45%' } },
  { name: 'Lime', primary: { light: '84 76% 42%', dark: '84 66% 37%' } },
  { name: 'Olive', primary: { light: '60 39% 41%', dark: '60 29% 31%' } },
  { name: 'Green', primary: { light: '142 76% 36%', dark: '142 60% 31%' } },
  { name: 'Emerald', primary: { light: '158 76% 36%', dark: '158 66% 31%' } },
  { name: 'Teal', primary: { light: '162 72% 42%', dark: '162 82% 34%' } },
  { name: 'Turquoise', primary: { light: '174 72% 56%', dark: '174 62% 46%' } },
  { name: 'Cyan', primary: { light: '188 82% 44%', dark: '188 72% 39%' } },
  { name: 'Sky', primary: { light: '199 98% 54%', dark: '199 88% 49%' } },
  { name: 'Blue', primary: { light: '217 82% 55%', dark: '217 82% 60%' } },
  { name: 'Navy', primary: { light: '240 35% 25%', dark: '240 25% 15%' } },
  { name: 'Indigo', primary: { light: '243 93% 63%', dark: '243 83% 58%' } },
  { name: 'Violet', primary: { light: '250 84% 60%', dark: '250 74% 55%' } },
  { name: 'Purple', primary: { light: '262 84% 60%', dark: '262 74% 55%' } },
  { name: 'Fuchsia', primary: { light: '304 84% 60%', dark: '304 74% 55%' } },
  { name: 'Magenta', primary: { light: '300 76% 72%', dark: '300 66% 67%' } },
  { name: 'Pink', primary: { light: '330 84% 60%', dark: '330 74% 55%' } },
  { name: 'Rose', primary: { light: '346 84% 60%', dark: '346 74% 55%' } },
  { name: 'Maroon', primary: { light: '0 60% 30%', dark: '0 50% 25%' } },
  { name: 'Silver', primary: { light: '0 0% 75%', dark: '0 0% 65%' } },
  { name: 'Slate', primary: { light: '215 28% 47%', dark: '215 20% 65%' } },
  { name: 'Gray', primary: { light: '220 9% 46%', dark: '215 14% 65%' } },
  { name: 'Zinc', primary: { light: '220 13% 46%', dark: '220 9% 65%' } },
  { name: 'Stone', primary: { light: '25 15% 46%', dark: '25 8% 65%' } },
  { name: 'Forest', primary: { light: '150 50% 40%', dark: '150 50% 30%' } },
  { name: 'Ocean', primary: { light: '170 70% 35%', dark: '170 70% 25%' } },
  { name: 'Grape', primary: { light: '270 50% 55%', dark: '270 50% 45%' } },
  { name: 'Charcoal', primary: { light: '220 10% 40%', dark: '220 10% 25%' } },
];
