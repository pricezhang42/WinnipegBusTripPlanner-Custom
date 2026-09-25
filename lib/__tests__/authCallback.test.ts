import { jest, test, expect } from '@jest/globals';
jest.mock('../supabase', () => ({ supabase: { auth: { exchangeCodeForSession: jest.fn() } } }));
import { supabase } from '../supabase';
import { exchangeAuthCode } from '../authCallback';

test('repeated callback renders exchange a one-time code only once', async () => {
  const exchange = jest.mocked(supabase!.auth.exchangeCodeForSession);
  exchange.mockResolvedValue({ data: { user: null, session: null }, error: null } as any);
  const first = exchangeAuthCode('one-time-code');
  const second = exchangeAuthCode('one-time-code');
  expect(first).toBe(second);
  await first;
  expect(exchange).toHaveBeenCalledTimes(1);
  await exchangeAuthCode('different-code');
  expect(exchange).toHaveBeenCalledTimes(2);
});
