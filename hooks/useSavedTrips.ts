import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { latestPerTrip, locationKey, tripKey, type Location, type Trip, type SavedTrip } from '@/lib/savedTrips';
import { parseSavedItems, savedItemsRequest, type SavedItems } from '@/lib/savedItemsApi';

const empty: SavedItems = { locations: [], favorites: [], history: [] };

export function useSavedTrips() {
  const { session } = useAuth();
  const uid = session?.user.id;
  // An epoch also rejects A → signed out → A responses from the earlier session.
  const identity = useRef({ uid, epoch: 0 });
  if (identity.current.uid !== uid) identity.current = { uid, epoch: identity.current.epoch + 1 };
  const epoch = identity.current.epoch;
  const mounted = useRef(true);
  const generation = useRef(0);
  const reads = useRef(new Set<AbortController>());
  const mutation = useRef<symbol | null>(null);
  const [state, setState] = useState<{ epoch: number; lists: SavedItems }>({ epoch, lists: empty });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isCurrent = useCallback(() => mounted.current && identity.current.epoch === epoch && identity.current.uid === uid, [epoch, uid]);
  const refresh = useCallback(async () => {
    if (!isCurrent()) return;
    const version = ++generation.current;
    if (!uid) { setState({ epoch, lists: empty }); setError(''); setLoading(false); return; }
    const controller = new AbortController();
    reads.current.add(controller);
    setLoading(true); setError('');
    try {
      const result = await savedItemsRequest<unknown>(uid, '/saved-items', { signal: controller.signal }, isCurrent);
      const lists = parseSavedItems(result);
      if (isCurrent() && generation.current === version) {
        setState({ epoch, lists: { ...lists, history: latestPerTrip(lists.history) } });
      }
    } catch (failure) {
      if (isCurrent() && generation.current === version) setError(failure instanceof Error ? failure.message : 'Unable to load saved items.');
    } finally {
      reads.current.delete(controller);
      if (isCurrent() && generation.current === version) setLoading(false);
    }
  }, [uid, epoch, isCurrent]);

  useEffect(() => {
    mounted.current = true;
    mutation.current = null; setBusy(false);
    void refresh();
    return () => {
      mounted.current = false;
      generation.current++;
      reads.current.forEach(controller => controller.abort());
      reads.current.clear();
    };
  }, [refresh]);

  const lists = state.epoch === epoch ? state.lists : empty;
  async function write(path: string, method: 'POST' | 'DELETE', body?: unknown) {
    if (!uid || !isCurrent()) throw new Error('Please sign in to save places and trips.');
    if (mutation.current) throw new Error('Please wait for the previous save to finish.');
    const operation = Symbol();
    mutation.current = operation; setBusy(true);
    generation.current++;
    try {
      await savedItemsRequest(uid, path, { method, body }, isCurrent);
      if (isCurrent()) await refresh();
    } finally {
      if (isCurrent() && mutation.current === operation) { mutation.current = null; setBusy(false); setLoading(false); }
    }
  }
  const removeLocation = (location: Location) => write(`/favorite-locations/${encodeURIComponent(locationKey(location))}`, 'DELETE');
  return { ...lists, loading, busy, error: uid ? error : '', refresh,
    removeLocation,
    removeHistory: (trip: SavedTrip) => {
      if (!Number.isSafeInteger(trip.id) || trip.id! <= 0) return Promise.reject(new Error('This history entry could not be identified. Refresh and try again.'));
      return write(`/trip-history/${trip.id}`, 'DELETE');
    },
    toggleLocation: (location: Location) => lists.locations.some(item => locationKey(item) === locationKey(location))
      ? removeLocation(location) : write('/favorite-locations', 'POST', { location }),
    saveTrip: (trip: Trip) => write('/favorite-trips', 'POST', trip),
    removeTrip: (trip: Trip) => write(`/favorite-trips/${encodeURIComponent(tripKey(trip))}`, 'DELETE'),
    recordTrip: async (trip: Trip) => {
      if (!uid || !isCurrent()) return;
      try { await write('/trip-history', 'POST', trip); }
      catch { throw new Error('Trip found, but history could not be saved. Please check your connection and try again.'); }
    },
  };
}
