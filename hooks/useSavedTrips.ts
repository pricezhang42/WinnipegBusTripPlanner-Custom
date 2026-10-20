import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { isLocation, latestPerTrip, locationKey, tripKey, Location, Trip, SavedTrip } from '@/lib/savedTrips';

type Lists = { locations: Location[]; favorites: SavedTrip[]; history: SavedTrip[] };
const empty: Lists = { locations: [], favorites: [], history: [] };
export function useSavedTrips() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const current = useRef(uid); current.current = uid;
  const generation = useRef(0);
  const mutation = useRef(false);
  const [state, setState] = useState<{ uid?: string; lists: Lists }>({ lists: empty });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!uid || !supabase) { setState({ lists: empty }); setError(''); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [locations, favorites, history] = await Promise.all([
        supabase.from('favorite_locations').select('location').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('favorite_trips').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('trip_history').select('*').eq('user_id', uid).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10),
      ]);
      if (locations.error || favorites.error || history.error) throw new Error('Unable to load your saved places and trips. Please try again.');
      if (current.current === uid && generation.current === version) setState({ uid, lists: {
        locations: (locations.data ?? []).map(row => row.location).filter(isLocation),
        favorites: (favorites.data ?? []).filter(row => isLocation(row.origin) && isLocation(row.destination)),
        // The database keeps one row per trip; this also hides duplicates saved before that migration.
        history: latestPerTrip((history.data ?? []).filter(row => isLocation(row.origin) && isLocation(row.destination))),
      } });
    } catch (failure) { if (current.current === uid && generation.current === version) setError(failure instanceof Error ? failure.message : 'Unable to load saved items.'); }
    finally { if (current.current === uid && generation.current === version) setLoading(false); }
  }, [uid]);
  useEffect(() => { refresh(); return () => { generation.current++; }; }, [refresh]);
  const lists = state.uid === uid ? state.lists : empty;
  async function write(operation: () => PromiseLike<{ error: unknown }>) {
    if (!uid || !supabase || current.current !== uid) throw new Error('Please sign in to save places and trips.');
    if (mutation.current) throw new Error('Please wait for the previous save to finish.');
    mutation.current = true; setBusy(true);
    try {
      const { error } = await operation();
      if (error) throw new Error('Could not save your changes. Please check your connection and try again.');
      if (current.current === uid) await refresh();
    } finally { mutation.current = false; setBusy(false); }
  }
  return { ...lists, loading, busy, error: uid ? error : '', refresh,
    removeLocation: (location: Location) => write(() => supabase!.from('favorite_locations').delete().eq('user_id', uid!).eq('location_key', locationKey(location))),
    removeHistory: (trip: SavedTrip) => {
      if (trip.id == null) return Promise.reject(new Error('This history entry could not be identified. Refresh and try again.'));
      return write(() => supabase!.from('trip_history').delete().eq('user_id', uid!).eq('id', trip.id!));
    },
    toggleLocation: (location: Location) => {
      const key = locationKey(location);
      return write(() => lists.locations.some(item => locationKey(item) === key)
        ? supabase!.from('favorite_locations').delete().eq('user_id', uid!).eq('location_key', key)
        : supabase!.from('favorite_locations').upsert({ user_id: uid, location_key: key, location }, { onConflict: 'user_id,location_key' }));
    },
    saveTrip: (trip: Trip) => write(() => supabase!.from('favorite_trips').upsert({ user_id: uid, trip_key: tripKey(trip), ...trip }, { onConflict: 'user_id,trip_key' })),
    removeTrip: (trip: Trip) => write(() => supabase!.from('favorite_trips').delete().eq('user_id', uid!).eq('trip_key', tripKey(trip))),
    recordTrip: async (trip: Trip) => {
      if (!uid || !supabase || current.current !== uid) return;
      const { error } = await supabase.rpc('record_planned_trip', { p_origin: trip.origin, p_destination: trip.destination });
      if (error) throw new Error('Trip found, but history could not be saved. Please check your connection.');
      if (current.current === uid) await refresh();
    },
  };
}
