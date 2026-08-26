export type Status = 'recovered' | 'ok' | 'strained' | 'empty';

export const STATUS_LABEL: Record<Status, string> = {
  recovered: 'Recuperat',
  ok: 'Ok',
  strained: 'Obosit',
  empty: '—',
};

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function coachNote(days: Status[]): string {
  const strained = days.filter((s) => s === 'strained').length;
  const recovered = days.filter((s) => s === 'recovered').length;
  if (strained >= 3) {
    return 'Multe zile obosite. Taie volumele grele 1–2 zile: tehnică ușoară, plimbare, somn.';
  }
  if (strained >= 1) {
    return 'Ai cel puțin o zi slab recuperată. Păstrează forța, lasă accessory-ul și HIIT-ul.';
  }
  if (recovered >= 4) {
    return 'Săptămâna arată bine. E loc de un antrenament greu pe picioare sau un PR controlat.';
  }
  return 'Recuperare ok. Ține programul, nu adăuga volume extra doar pentru că te simți bine o zi.';
}
