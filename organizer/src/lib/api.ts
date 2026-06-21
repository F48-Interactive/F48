const DEFAULT_API_URL = 'http://localhost:3000/api/v1';

function cleanEnvValue(value: string | undefined, fallback = ''): string {
  return (value || fallback).trim().replace(/^["']+|["']+$/g, '');
}

function normalizeApiUrl(value: string | undefined): string {
  const assignmentPrefix = 'VITE_API_URL=';
  let cleaned = cleanEnvValue(value, DEFAULT_API_URL);

  if (cleaned.startsWith(assignmentPrefix)) {
    cleaned = cleanEnvValue(cleaned.slice(assignmentPrefix.length), DEFAULT_API_URL);
  }

  return cleaned.replace(/\/+$/g, '');
}

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { idempotencyKey?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options?.idempotencyKey) {
      headers['X-Idempotency-Key'] = options.idempotencyKey;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err: ApiError = json.error || {
        code: 'UNKNOWN',
        message: res.statusText,
      };
      throw err;
    }

    return json.data !== undefined ? json.data : json;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown, idempotencyKey?: string) {
    return this.request<T>('POST', path, body, { idempotencyKey });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  del<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

export const api = new ApiClient(API_URL);

/** Generate a unique idempotency key */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}
