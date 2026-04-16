import { Platform } from 'react-native';

/**
 * Base URL of the BusTripPlanner backend.
 *
 * Defaults cover local development:
 *   - Android emulator  -> 10.0.2.2  (loopback to the host machine)
 *   - iOS simulator / web -> localhost
 *
 * Override at build time with EXPO_PUBLIC_BACKEND_URL=https://your-host.example.com
 */
const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
const devDefault = Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';

export const BACKEND_BASE_URL = (envUrl && envUrl.trim().length > 0 ? envUrl : devDefault).replace(
  /\/+$/,
  ''
);

export const apiUrl = (path: string): string =>
  `${BACKEND_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
