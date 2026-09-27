import { config } from '../config/env';

type QueryValue = string | number | boolean;

export class SupabaseHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function headers(prefer?: string) {
  return {
    apikey: config.supabaseServiceRoleKey,
    Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function supabaseBaseUrl() {
  return config.supabaseUrl
    .replace(/\/$/, '')
    .replace(/\/rest\/v1$/, '');
}

function buildUrl(path: string, query?: Record<string, QueryValue | undefined>) {
  const url = new URL(`${supabaseBaseUrl()}/rest/v1/${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new SupabaseHttpError(response.status, text || response.statusText);
  }
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function supabaseSelect<T>(path: string, query?: Record<string, QueryValue | undefined>): Promise<T[]> {
  const response = await fetch(buildUrl(path, query), { headers: headers() });
  return parseResponse<T[]>(response);
}

export async function supabaseInsert<T>(path: string, body: unknown, onConflict?: string): Promise<T[]> {
  const response = await fetch(buildUrl(path, onConflict ? { on_conflict: onConflict } : undefined), {
    method: 'POST',
    headers: headers('resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(body),
  });
  return parseResponse<T[]>(response);
}

export async function supabasePatch<T>(path: string, query: Record<string, QueryValue>, body: unknown): Promise<T[]> {
  const response = await fetch(buildUrl(path, query), {
    method: 'PATCH',
    headers: headers('return=representation'),
    body: JSON.stringify(body),
  });
  return parseResponse<T[]>(response);
}

export async function supabaseDelete(path: string, query: Record<string, QueryValue>): Promise<void> {
  const response = await fetch(buildUrl(path, query), {
    method: 'DELETE',
    headers: headers(),
  });
  await parseResponse<void>(response);
}

export async function supabaseRpc<T>(fnName: string, body: unknown): Promise<T> {
  const response = await fetch(`${supabaseBaseUrl()}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}
