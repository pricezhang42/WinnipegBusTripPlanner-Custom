import * as ExpoCrypto from 'expo-crypto';

type CryptoTarget = { crypto?: Partial<{ -readonly [K in keyof Crypto]: Crypto[K] }> };

// Hermes has no WebCrypto, so supabase-js would fall back to a Math.random PKCE
// verifier and a `plain` code challenge. Fill in just the pieces it uses.
export function installWebCrypto(target: CryptoTarget = globalThis as CryptoTarget) {
  const crypto = target.crypto ?? (target.crypto = {});
  if (!crypto.getRandomValues) {
    crypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T) =>
      ExpoCrypto.getRandomValues(array as unknown as Uint8Array) as unknown as T) as Crypto['getRandomValues'];
  }
  if (!crypto.subtle) {
    crypto.subtle = {
      digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') return Promise.reject(new Error(`Unsupported digest: ${name}`));
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      },
    } as SubtleCrypto;
  }
}

installWebCrypto();
