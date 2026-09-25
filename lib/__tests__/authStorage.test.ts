import { jest, test, expect } from '@jest/globals';
import { authStorage } from '../authStorage';
import * as SecureStore from 'expo-secure-store';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-secure-store', () => {
  const data = new Map();
  return {
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { data.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { data.delete(key); }),
  };
});

test('large sessions survive storage, replacement, and logout', async () => {
  const value = JSON.stringify({ refresh_token: 'x'.repeat(6000), user: { email: 'test@example.com' } });
  await authStorage.setItem('session', value);
  expect(await authStorage.getItem('session')).toBe(value);
  expect(jest.mocked(SecureStore.setItemAsync).mock.calls.every(([, item]) => item.length <= 500)).toBe(true);
  await authStorage.setItem('session', 'replacement');
  expect(await authStorage.getItem('session')).toBe('replacement');
  await authStorage.removeItem('session');
  expect(await authStorage.getItem('session')).toBeNull();
});

test('a failed write preserves the previously saved session', async () => {
  await authStorage.setItem('previous', 'valid session');
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(authStorage.setItem('previous', 'new session')).rejects.toThrow('storage unavailable');
  expect(await authStorage.getItem('previous')).toBe('valid session');
});

test('missing secure storage chunks never return a partial token', async () => {
  await SecureStore.setItemAsync('incomplete', JSON.stringify({ id: 'missing', count: 2 }));
  expect(await authStorage.getItem('incomplete')).toBeNull();
});
