import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Small chunks also support devices with a low per-item Keychain size limit.
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    const manifest = await SecureStore.getItemAsync(key);
    if (!manifest) return null;
    const { id, count } = JSON.parse(manifest) as { id: string; count: number };
    const chunks = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${id}.${i}`)));
    return chunks.some(chunk => chunk === null) ? null : chunks.join('');
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    }
    const previous = await SecureStore.getItemAsync(key);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const chunks = value.match(/[\s\S]{1,500}/g) ?? [''];
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${id}.${i}`, chunk)));
    await SecureStore.setItemAsync(key, JSON.stringify({ id, count: chunks.length }));
    if (previous) {
      const old = JSON.parse(previous);
      await Promise.all(Array.from({ length: old.count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${old.id}.${i}`)));
    }
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    }
    const manifest = await SecureStore.getItemAsync(key);
    await SecureStore.deleteItemAsync(key);
    if (manifest) {
      const { id, count } = JSON.parse(manifest);
      await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${id}.${i}`)));
    }
  },
};
