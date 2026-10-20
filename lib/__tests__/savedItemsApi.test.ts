import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { savedItemsRequest, parseSavedItems } from '../savedItemsApi';

let mockSession: any;
const mockRefresh = jest.fn<() => Promise<any>>();
const mockGetSession = jest.fn<() => Promise<any>>();
jest.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: () => mockGetSession(), refreshSession: () => mockRefresh(),
} } }));
jest.mock('@/constants/Backend', () => ({ apiUrl: (path: string) => `https://backend.test${path}` }));
const mockFetch = jest.fn<typeof fetch>();
const originalFetch = global.fetch;
const response = (status: number, data?: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => data } as Response);
const place = { id: 'a', place_name: 'Home', geometry: { coordinates: [-97, 49] } };

beforeEach(() => {
  mockSession = { user: { id: 'user-a' }, access_token: 'old-token' };
  mockRefresh.mockReset(); mockGetSession.mockReset(); mockFetch.mockReset();
  mockGetSession.mockImplementation(async () => ({ data: { session: mockSession }, error: null }));
  mockRefresh.mockImplementation(async () => {
    mockSession = { ...mockSession, access_token: 'new-token' };
    return { data: { session: mockSession }, error: null };
  });
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('sends only the access token and payload to backend, encoding is caller controlled', async () => {
  mockFetch.mockResolvedValue(response(204));
  await savedItemsRequest('user-a', '/favorite-locations', { method: 'POST', body: { location: place } });
  const [url, options] = mockFetch.mock.calls[0];
  expect(url).toBe('https://backend.test/api/me/favorite-locations');
  expect(options?.headers).toEqual({ Authorization: 'Bearer old-token', 'Content-Type': 'application/json' });
  expect(JSON.parse(String(options?.body))).toEqual({ location: place });
});

test('renews expired token once and retries the rejected request with the new access token', async () => {
  mockFetch.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(204));
  await savedItemsRequest('user-a', '/trip-history', { method: 'POST', body: { origin: place, destination: place } });
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect((mockFetch.mock.calls[1][1]?.headers as any).Authorization).toBe('Bearer new-token');
});

test('concurrent unauthorized requests share one refresh', async () => {
  let finish!: () => void;
  mockRefresh.mockImplementation(() => new Promise(resolve => { finish = () => {
    mockSession = { ...mockSession, access_token: 'new-token' };
    resolve({ data: { session: mockSession }, error: null });
  }; }));
  mockFetch.mockImplementation(async (_url, options) => response((options?.headers as any).Authorization === 'Bearer old-token' ? 401 : 204));
  const requests = [savedItemsRequest('user-a', '/saved-items'), savedItemsRequest('user-a', '/saved-items')];
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all(requests);
});

test('does not loop when a renewed token is also rejected', async () => {
  mockFetch.mockResolvedValue(response(401));
  await expect(savedItemsRequest('user-a', '/saved-items')).rejects.toThrow('sign in');
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

test('does not refresh or replay a mutation after account switching', async () => {
  mockFetch.mockImplementationOnce(async () => {
    mockSession = { user: { id: 'user-b' }, access_token: 'b-token' };
    return response(401);
  });
  await expect(savedItemsRequest('user-a', '/favorite-trips', { method: 'POST', body: {} })).rejects.toThrow('sign in');
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('guard prevents replay after same-account re-login while refreshing', async () => {
  let current = true;
  mockFetch.mockResolvedValue(response(401));
  mockRefresh.mockImplementationOnce(async () => {
    current = false;
    return { data: { session: mockSession }, error: null };
  });
  await expect(savedItemsRequest('user-a', '/favorite-trips', { method: 'POST', body: {} }, () => current)).rejects.toThrow('sign in');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('network errors and server errors never replay mutations', async () => {
  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(savedItemsRequest('user-a', '/trip-history', { method: 'POST', body: {} })).rejects.toThrow('connection');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  mockFetch.mockResolvedValueOnce(response(503));
  await expect(savedItemsRequest('user-a', '/trip-history', { method: 'POST', body: {} })).rejects.toThrow('temporarily');
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('timeouts abort requests without replay', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); });
  }));
  const pending = savedItemsRequest('user-a', '/saved-items');
  const assertion = expect(pending).rejects.toThrow('connection');
  await jest.advanceTimersByTimeAsync(25000);
  await assertion;
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('rejects stale identity before sending any request and validates response structure', async () => {
  await expect(savedItemsRequest('user-b', '/saved-items')).rejects.toThrow('sign in');
  expect(mockFetch).not.toHaveBeenCalled();
  expect(parseSavedItems({ locations: [place], favorites: [], history: [] }).locations).toEqual([place]);
  expect(() => parseSavedItems({ locations: [], favorites: [], history: [{ origin: place, destination: place, created_at: '2026-10-19', id: null }] })).toThrow('invalid');
});
