import { apiUrl } from '@/constants/Backend';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { isLocation, type Location, type SavedTrip } from './savedTrips';

export type SavedItems = { locations: Location[]; favorites: SavedTrip[]; history: SavedTrip[] };
type RequestOptions = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; signal?: AbortSignal };
const signedOut = () => new Error('Please sign in again to access saved places and trips.');
let refreshing: { userId: string; promise: Promise<Session> } | undefined;

async function sessionFor(userId: string, isCurrent: () => boolean) {
  if (!supabase || !isCurrent()) throw signedOut();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId || !isCurrent()) throw signedOut();
  return data.session;
}

async function renewedSession(userId: string, rejectedToken: string, isCurrent: () => boolean) {
  const current = await sessionFor(userId, isCurrent);
  if (current.access_token !== rejectedToken) return current;
  if (!refreshing || refreshing.userId !== userId) {
    const promise = supabase!.auth.refreshSession().then(({ data, error }) => {
      if (error || !data.session || data.session.user.id !== userId) throw signedOut();
      return data.session;
    });
    const pending = { userId, promise };
    refreshing = pending;
    void promise.finally(() => { if (refreshing === pending) refreshing = undefined; }).catch(() => {});
  }
  await refreshing.promise;
  return sessionFor(userId, isCurrent);
}

/** Retry only a rejected authentication attempt, never an ambiguous network failure. */
export async function savedItemsRequest<T = void>(userId: string, path: string, options: RequestOptions = {},
  isCurrent: () => boolean = () => true): Promise<T> {
  let session = await sessionFor(userId, isCurrent);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!isCurrent() || options.signal?.aborted) throw signedOut();
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort);
    const timeout = setTimeout(abort, 25000);
    try {
      const response = await fetch(apiUrl(`/api/me${path}`), {
        method: options.method ?? 'GET', signal: controller.signal,
        headers: { Authorization: `Bearer ${session.access_token}`, ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      if (!isCurrent()) throw signedOut();
      if (response.status === 401 && attempt === 0) {
        session = await renewedSession(userId, session.access_token, isCurrent);
        continue;
      }
      if (!response.ok) {
        if (response.status === 401) throw signedOut();
        if (response.status === 403) throw new Error('This saved item could not be deleted because access was denied. Please contact support.');
        if (response.status === 429) throw new Error('Too many saved-item requests. Please wait a moment and try again.');
        if (response.status === 400 || response.status === 413) throw new Error('This saved place or trip could not be accepted. Please check it and try again.');
        throw new Error('Saved places and trips are temporarily unavailable. Please try again.');
      }
      if (response.status === 204) return undefined as T;
      return await response.json() as T;
    } catch (error) {
      if (!isCurrent()) throw signedOut();
      if (error instanceof Error && error.name !== 'AbortError' && !(error instanceof TypeError)) throw error;
      throw new Error('Could not connect to saved places and trips. Please check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  throw signedOut();
}

export function parseSavedItems(value: unknown): SavedItems {
  const lists = value as SavedItems | null;
  const validTrip = (trip: SavedTrip) => !!trip && isLocation(trip.origin) && isLocation(trip.destination) &&
    typeof trip.created_at === 'string' && Number.isFinite(Date.parse(trip.created_at));
  if (!lists || !Array.isArray(lists.locations) || !lists.locations.every(isLocation) ||
      !Array.isArray(lists.favorites) || !lists.favorites.every(validTrip) ||
      !Array.isArray(lists.history) || !lists.history.every(trip => validTrip(trip) && Number.isSafeInteger(trip.id) && trip.id! > 0)) {
    throw new Error('The server returned invalid saved items. Please try again.');
  }
  return { locations: lists.locations, favorites: lists.favorites, history: lists.history.slice(0, 10) };
}
