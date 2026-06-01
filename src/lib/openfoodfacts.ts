// Open Food Facts — gratuit, fără cheie. Pentru a căuta produse din magazin
// (Lidl/Kaufland) cu calorii/macros per 100g și poză. Util pt logarea meselor.
// Docs: https://world.openfoodfacts.org/data

export type OFFProduct = {
  code: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  kcalPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
};

const BASE = 'https://world.openfoodfacts.org';

export async function searchFood(query: string, limit = 10): Promise<OFFProduct[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit}` +
    `&fields=code,product_name,brands,image_front_small_url,nutriments`;
  const res = await fetch(url, { headers: { 'User-Agent': 'AICoach/0.1' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.products ?? []).map((p: any): OFFProduct => ({
    code: p.code,
    name: p.product_name || 'necunoscut',
    brand: p.brands,
    imageUrl: p.image_front_small_url,
    kcalPer100g: p.nutriments?.['energy-kcal_100g'],
    proteinPer100g: p.nutriments?.proteins_100g,
    carbsPer100g: p.nutriments?.carbohydrates_100g,
    fatPer100g: p.nutriments?.fat_100g,
  }));
}

// Scan după cod de bare (ex: din input manual sau, mai târziu, scanner pe telefon).
export async function getByBarcode(barcode: string): Promise<OFFProduct | null> {
  const res = await fetch(`${BASE}/api/v2/product/${barcode}.json`, {
    headers: { 'User-Agent': 'AICoach/0.1' },
  });
  if (!res.ok) return null;
  const { product: p, status } = await res.json();
  if (status !== 1 || !p) return null;
  return {
    code: p.code,
    name: p.product_name || 'necunoscut',
    brand: p.brands,
    imageUrl: p.image_front_small_url,
    kcalPer100g: p.nutriments?.['energy-kcal_100g'],
    proteinPer100g: p.nutriments?.proteins_100g,
    carbsPer100g: p.nutriments?.carbohydrates_100g,
    fatPer100g: p.nutriments?.fat_100g,
  };
}
