export type GarminOauthTokens = {
  oauth1: Record<string, unknown>;
  oauth2: Record<string, unknown>;
};

/** JSON blob stored in Vault — password for re-login, OAuth for session reuse. */
export type GarminSecret = {
  password: string;
  tokens?: GarminOauthTokens;
};

export type GarminDayMetrics = {
  date: string;
  steps: number | null;
  active_kcal: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  sleep_minutes: number | null;
  hrv: number | null;
  vo2max: number | null;
  weight_kg: number | null;
  raw: Record<string, unknown>;
};
