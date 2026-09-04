// Ported from transaction-manager's packages/gmail/src/real-client.ts.
// Unlike Enable Banking (per-user App ID + PEM), the Gmail OAuth client is
// one app-wide registration (GOOGLE_GMAIL_CLIENT_ID/SECRET) — only the
// per-user refresh token is stored per-user, via Vault (see connection.ts).

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

/** Volume guard only — decides nothing about relevance, unlike screening. */
const DEFAULT_MAX_RESULTS = 200;
/** A marketing HTML mail can be 200KB; nobody needs that many tokens. */
const MAX_BODY_CHARS = 12000;

export class GmailNotConfiguredError extends Error {
  constructor() {
    super('Gmail nu este configurat. Setează GOOGLE_GMAIL_CLIENT_ID și GOOGLE_GMAIL_CLIENT_SECRET.');
    this.name = 'GmailNotConfiguredError';
  }
}

export interface GmailAppCreds {
  clientId: string;
  clientSecret: string;
}

export function getGmailAppCreds(): GmailAppCreds {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GmailNotConfiguredError();
  return { clientId, clientSecret };
}

export interface GmailMessageMetadata {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  snippet: string;
  receivedAt: string;
}

async function exchangeToken(
  body: Record<string, string>
): Promise<{ access_token: string; refresh_token?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Gmail OAuth token error (${res.status}): ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string }>;
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail API error (${res.status} ${path}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function accessTokenFor(creds: GmailAppCreds, refreshToken: string) {
  return exchangeToken({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
}

export function buildConsentUrl(creds: GmailAppCreds, params: { redirectUri: string; state: string }): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', creds.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', params.state);
  return url.toString();
}

export async function exchangeAuthCode(
  creds: GmailAppCreds,
  params: { code: string; redirectUri: string }
): Promise<{ emailAddress: string; refreshToken: string }> {
  const tokens = await exchangeToken({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
  });
  if (!tokens.refresh_token) {
    throw new Error('Google nu a returnat un refresh token — reîncearcă (access_type=offline&prompt=consent).');
  }
  const profile = await gmailFetch<{ emailAddress: string }>(tokens.access_token, '/users/me/profile');
  return { emailAddress: profile.emailAddress, refreshToken: tokens.refresh_token };
}

/**
 * Metadata for everything in the window, no keyword filter — relevance is
 * decided one layer up by screen.ts, against metadata this call is cheap
 * enough to fetch for everything.
 */
export async function listMessageMetadata(
  creds: GmailAppCreds,
  params: { refreshToken: string; sinceHours: number; maxResults?: number }
): Promise<GmailMessageMetadata[]> {
  const tokens = await accessTokenFor(creds, params.refreshToken);
  const maxResults = params.maxResults ?? DEFAULT_MAX_RESULTS;
  const afterSeconds = Math.floor((Date.now() - params.sinceHours * 60 * 60 * 1000) / 1000);
  const query = `after:${afterSeconds}`;

  const list = await gmailFetch<{ messages?: Array<{ id: string }> }>(
    tokens.access_token,
    `/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`
  );

  const messages: GmailMessageMetadata[] = [];
  for (const { id } of list.messages ?? []) {
    const detail = await gmailFetch<{
      id: string;
      snippet: string;
      internalDate: string;
      payload: { headers: Array<{ name: string; value: string }> };
    }>(tokens.access_token, `/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To`);
    const header = (name: string) =>
      detail.payload.headers.find((h) => h.name.toLowerCase() === name)?.value ?? '';
    messages.push({
      id: detail.id,
      subject: header('subject'),
      fromAddress: header('from'),
      toAddress: header('to'),
      snippet: detail.snippet,
      receivedAt: new Date(Number(detail.internalDate)).toISOString(),
    });
  }
  return messages;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

/** Walks the MIME tree for text/plain, falling back to HTML with tags stripped. */
function extractBody(part: GmailPart): string {
  const plain = findPart(part, 'text/plain');
  if (plain) return truncate(decode(plain));
  const html = findPart(part, 'text/html');
  if (html) return truncate(stripHtml(decode(html)));
  return '';
}

function findPart(part: GmailPart, mimeType: string): GmailPart | null {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function decode(part: GmailPart): string {
  return Buffer.from(part.body?.data ?? '', 'base64url').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string): string {
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}…` : text;
}

export async function getMessageBody(
  creds: GmailAppCreds,
  params: { refreshToken: string; id: string }
): Promise<{ id: string; body: string }> {
  const tokens = await accessTokenFor(creds, params.refreshToken);
  const detail = await gmailFetch<{ payload: GmailPart }>(tokens.access_token, `/users/me/messages/${params.id}?format=full`);
  return { id: params.id, body: extractBody(detail.payload) };
}

export async function revokeConnection(refreshToken: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  });
}
