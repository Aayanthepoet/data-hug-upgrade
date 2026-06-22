// Server-side fetch wrapper for upstream public-records APIs (NYC Socrata,
// Philly Carto). Adds three layers of resilience:
//
//  1. In-memory TTL cache keyed by the full request URL (+ optional body).
//     Lives inside one Worker isolate — good for burst dedup within a request
//     wave and across rapid user navigations on the same isolate.
//  2. Single-flight de-duplication so concurrent identical requests share one
//     upstream call.
//  3. Retry with exponential backoff + jitter on 429 / 5xx / network errors,
//     honoring the upstream `Retry-After` header when present.
//
// Designed for the Cloudflare Worker SSR runtime: no Node-only APIs, no
// filesystem, no globals beyond Map/Promise/fetch.

type CacheEntry = { expiresAt: number; value: unknown };

const CACHE = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 500;

function cacheGet<T>(key: string): T | undefined {
  const hit = CACHE.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    CACHE.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (CACHE.size >= MAX_CACHE_ENTRIES) {
    // Evict the oldest ~10% to keep memory bounded.
    const drop = Math.ceil(MAX_CACHE_ENTRIES * 0.1);
    let i = 0;
    for (const k of CACHE.keys()) {
      CACHE.delete(k);
      if (++i >= drop) break;
    }
  }
  CACHE.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export interface CachedFetchOptions {
  /** Cache TTL in ms. Default 5 minutes. Set 0 to bypass cache. */
  ttlMs?: number;
  /** Max retry attempts on 429 / 5xx / network errors. Default 3. */
  maxRetries?: number;
  /** Base backoff in ms; doubled each attempt with ±25% jitter. Default 400. */
  backoffMs?: number;
  /** Per-request timeout in ms. Default 12s. */
  timeoutMs?: number;
  /** Tag used in error/log messages (e.g. "nyc:9y3g-c5g6"). */
  label?: string;
  /** Optional request init (method, headers, body). Defaults to GET JSON. */
  init?: RequestInit;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

/**
 * Fetch a JSON endpoint with caching, single-flight dedup, and retry/backoff.
 * Throws after exhausting retries — callers should `.catch()` and degrade
 * gracefully (e.g. return an empty array) so partial failures don't blank the
 * page.
 */
export async function cachedJsonFetch<T>(
  url: string,
  opts: CachedFetchOptions = {},
): Promise<T> {
  const {
    ttlMs = 5 * 60_000,
    maxRetries = 3,
    backoffMs = 400,
    timeoutMs = 12_000,
    label = "upstream",
    init,
  } = opts;

  const method = (init?.method ?? "GET").toUpperCase();
  const bodyKey = typeof init?.body === "string" ? init.body : "";
  const cacheKey = `${method} ${url} ${bodyKey}`;

  if (ttlMs > 0) {
    const hit = cacheGet<T>(cacheKey);
    if (hit !== undefined) return hit;
  }

  const existing = INFLIGHT.get(cacheKey) as Promise<T> | undefined;
  if (existing) return existing;

  const work = (async (): Promise<T> => {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          ...init,
          headers: { Accept: "application/json", ...(init?.headers ?? {}) },
          signal: controller.signal,
        });

        if (res.ok) {
          const json = (await res.json()) as T;
          if (ttlMs > 0) cacheSet(cacheKey, json, ttlMs);
          return json;
        }

        // Retry on rate-limit / transient server errors only.
        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
          const text = await res.text().catch(() => "");
          lastErr = new Error(`${label} ${res.status}: ${text.slice(0, 200)}`);
          if (attempt < maxRetries) {
            await sleep(retryAfter ?? jitterBackoff(backoffMs, attempt));
            continue;
          }
        } else {
          // 4xx other than 429 won't get better — fail fast.
          const text = await res.text().catch(() => "");
          throw new Error(`${label} ${res.status}: ${text.slice(0, 200)}`);
        }
      } catch (err) {
        lastErr = err;
        const aborted = (err as { name?: string })?.name === "AbortError";
        // Don't retry on a non-transient client error we threw above.
        if (!aborted && err instanceof Error && /^\D*\s4\d\d:/.test(err.message)) {
          throw err;
        }
        if (attempt < maxRetries) {
          await sleep(jitterBackoff(backoffMs, attempt));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`${label}: failed after ${maxRetries + 1} attempts`);
  })();

  INFLIGHT.set(cacheKey, work);
  try {
    return await work;
  } finally {
    INFLIGHT.delete(cacheKey);
  }
}

function jitterBackoff(base: number, attempt: number): number {
  const expo = base * Math.pow(2, attempt);
  const jitter = expo * (0.75 + Math.random() * 0.5); // ±25%
  return Math.min(jitter, 8_000);
}

/** Test/diagnostic helper: clear all cached responses. */
export function __clearFetchCache(): void {
  CACHE.clear();
  INFLIGHT.clear();
}
