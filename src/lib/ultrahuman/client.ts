// Ported from jarvis-backend's Ultrahuman/UltrahumanClient.php. jarvis used a
// single global ULTRAHUMAN_URL env var (the Partner API base is the same for
// every partner account); here it's a constant since there's no per-user
// reason for it to vary — only the token differs per user.
const ULTRAHUMAN_BASE_URL = 'https://partner.ultrahuman.com';
const DAILY_METRICS_ENDPOINT = '/api/v1/partner/daily_metrics';

export async function getUltrahumanDailyMetrics(token: string, date: string): Promise<unknown> {
  const url = new URL(DAILY_METRICS_ENDPOINT, ULTRAHUMAN_BASE_URL);
  url.searchParams.set('date', date);

  // Matches jarvis: the raw token as the Authorization header value, no
  // "Bearer " prefix — that's how the Ultrahuman Partner API expects it.
  const res = await fetch(url, {
    headers: { Authorization: token, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Ultrahuman API request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
