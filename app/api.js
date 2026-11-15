// make.fun public API — read-only GET, CORS-open. One request per view.
// Answers are cached in memory and in localStorage, revalidated with ETags
// (If-None-Match → 304 reuses the cached body), and in-flight requests are
// deduplicated. See https://make.fun/api/openapi.json for the shape.

export const API = 'https://make.fun/api';

const STORE_KEY = 'mf-cache-v2';
const STORE_MAX = 24;

// url → { etag, body, fetchedAt }
const memory = new Map();
// url → in-flight Promise
const pending = new Map();
// slug → board item, so a bounty page can paint at once from the board
const boardSeeds = new Map();

function restoreStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      for (const [url, entry] of Object.entries(saved)) {
        if (entry && entry.body !== undefined) memory.set(url, entry);
      }
    }
  } catch {
    // Storage blocked or corrupt: the memory cache still works.
  }
}

function persistStore() {
  try {
    const recent = [...memory.entries()].slice(-STORE_MAX);
    localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(recent)));
  } catch {
    // Quota or private mode: ignore.
  }
}

restoreStore();

/** The cached body for a URL, if we have one (freshness is checked by revalidation). */
export function cachedBody(url) {
  const hit = memory.get(url);
  return hit ? { body: hit.body, fetchedAt: hit.fetchedAt } : null;
}

export function seedFor(slug) {
  return boardSeeds.get(slug);
}

/** GET with ETag revalidation. A 304 or a failed fetch reuses the cached body. */
export async function fetchJson(url, signal) {
  const already = pending.get(url);
  if (already) return already;
  const job = (async () => {
    const hit = memory.get(url);
    const headers = { Accept: 'application/json' };
    if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
    let response;
    try {
      response = await fetch(url, { headers, signal });
    } catch (err) {
      if (hit) return { body: hit.body, fetchedAt: hit.fetchedAt, stale: true };
      throw err;
    }
    if (response.status === 304 && hit) {
      return { body: hit.body, fetchedAt: hit.fetchedAt, revalidated: true };
    }
    if (!response.ok) {
      if (hit) return { body: hit.body, fetchedAt: hit.fetchedAt, stale: true };
      const err = new Error(`make.fun API answered ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const body = await response.json();
    const record = { etag: response.headers.get('ETag'), body, fetchedAt: Date.now() };
    memory.set(url, record);
    persistStore();
    return { body, fetchedAt: record.fetchedAt };
  })();
  pending.set(url, job);
  try {
    return await job;
  } finally {
    pending.delete(url);
  }
}

/** Board: one request. activity=times keeps submissions/chat as {createdAt} rows. */
export async function getBounties(signal) {
  const { body, fetchedAt } = await fetchJson(
    `${API}/competitions?status=open&activity=times&limit=100`,
    signal,
  );
  for (const item of body.items || []) boardSeeds.set(item.slug, item);
  return { data: body, fetchedAt };
}

/** One bounty. submissions=summary keeps the entry list small. */
export async function getBounty(slug, signal) {
  const { body, fetchedAt } = await fetchJson(
    `${API}/competitions/${encodeURIComponent(slug)}?submissions=summary`,
    signal,
  );
  return { data: body, fetchedAt };
}

/** A bounty's leaderboard: one request; the view paginates client-side. */
export async function getLeaderboard(slug, phase, view, signal) {
  const query = new URLSearchParams({ phase, view });
  const { body, fetchedAt } = await fetchJson(
    `${API}/competitions/${encodeURIComponent(slug)}/leaderboard?${query}`,
    signal,
  );
  return { data: body, fetchedAt };
}

/** A public profile. fetch follows a 308 rename; a non-200 throws with .status. */
export async function getProfile(handle, signal) {
  const { body, fetchedAt } = await fetchJson(
    `${API}/profiles/${encodeURIComponent(handle)}`,
    signal,
  );
  return { data: body, fetchedAt };
}
