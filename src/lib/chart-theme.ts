/** Shared Recharts styling — uses CSS variables for light/dark. */

export const CHART_MARGIN = { top: 12, right: 16, left: 4, bottom: 4 };

export const axisTick = {
  fontSize: 11,
  fill: 'hsl(var(--muted-foreground))',
};

export const gridStroke = 'hsl(var(--border) / 0.6)';

export const tooltipStyle: Record<string, string> = {
  borderRadius: '8px',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--card-foreground))',
  fontSize: '12px',
  boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
};

export function weightYDomain(weights: number[], target?: number | null): [number, number] {
  const all = weights.filter(w => Number.isFinite(w));
  if (target != null) all.push(target);
  if (!all.length) return [0, 100];

  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min;
  const pad = span < 0.3 ? 1.5 : Math.max(0.8, span * 0.2);

  return [
    Math.floor((min - pad) * 10) / 10,
    Math.ceil((max + pad) * 10) / 10,
  ];
}
