import { jest, test, expect } from '@jest/globals';
import { installWebCrypto } from '../webCrypto';

jest.mock('expo-crypto', () => {
  const { createHash, randomFillSync } = jest.requireActual<typeof import('crypto')>('crypto');
  return {
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomValues: jest.fn((array: Uint8Array) => randomFillSync(array)),
  digest: jest.fn(async (_algorithm: string, data: Uint8Array) => {
    const hash = createHash('sha256').update(data).digest();
    return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
  }),
  };
});

test('a runtime without WebCrypto gets secure random values and SHA-256 for PKCE', async () => {
  const target: Parameters<typeof installWebCrypto>[0] = {};
  installWebCrypto(target);
  const array = target.crypto!.getRandomValues!(new Uint32Array(56));
  expect(array.some(value => value !== 0)).toBe(true);
  const hash = await target.crypto!.subtle!.digest('SHA-256', new TextEncoder().encode('abc'));
  expect(Buffer.from(hash).toString('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await expect(target.crypto!.subtle!.digest('SHA-1', new Uint8Array())).rejects.toThrow('Unsupported digest');
});

test('an existing WebCrypto implementation is left alone', () => {
  const crypto = { getRandomValues: jest.fn(), subtle: {} } as unknown as Crypto;
  const target = { crypto };
  installWebCrypto(target);
  expect(target.crypto).toBe(crypto);
  expect(target.crypto.getRandomValues).toBe(crypto.getRandomValues);
  expect(target.crypto.subtle).toBe(crypto.subtle);
});
