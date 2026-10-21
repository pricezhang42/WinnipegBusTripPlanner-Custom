import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { AppState, AppStateStatus, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SignupConfirmation } from '../SignupConfirmation';
import { signupConfirmation } from '../../lib/signupConfirmation';
import { supabase } from '../../lib/supabase';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../../providers/AuthProvider', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { resend: jest.fn(async () => ({ error: null })) } },
  authRedirect: () => 'bustripplanner://auth/callback',
}));
jest.mock('../../lib/signupConfirmation', () => ({
  ...jest.requireActual<typeof import('../../lib/signupConfirmation')>('../../lib/signupConfirmation'),
  signupConfirmation: { get: jest.fn(), remember: jest.fn(), resend: jest.fn(), warning: '' },
}));

let tree: ReactTestRenderer | undefined;
const button = () => tree!.root.findAllByType(Pressable)[0];
const text = () => JSON.stringify(tree!.toJSON());
const pending = () => ({ email: 'user@example.com', resendAvailableAt: Date.now() + 60_000 });
async function open() { await act(async () => { tree = renderer.create(<SignupConfirmation />); }); }
async function expire() { await act(async () => { jest.advanceTimersByTime(60_000); }); }

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-21T12:00:00Z'));
  jest.mocked(signupConfirmation.get).mockResolvedValue(pending());
  jest.mocked(signupConfirmation.remember).mockImplementation(async () => pending());
  jest.mocked(signupConfirmation.resend).mockImplementation(async send => { await send('user@example.com'); return pending(); });
});
afterEach(async () => {
  if (tree) { await act(async () => tree!.unmount()); tree = undefined; }
  jest.restoreAllMocks(); jest.useRealTimers();
});

test('shows the requested message/email, disables resend for 60 seconds, then enables it', async () => {
  await open();
  expect(text()).toContain('Check your email to confirm your account. Open the link on this device, then sign in.');
  expect(text()).toContain('user@example.com');
  expect(text()).toContain('Resend email (60s)');
  expect(button().props.disabled).toBe(true);
  await act(async () => { await button().props.onPress(); });
  expect(supabase!.auth.resend).not.toHaveBeenCalled();
  await expire();
  expect(button().props.disabled).toBe(false);
  expect(text()).toContain('Resend confirmation email');
});

test('resends with the existing callback, blocks double taps and restarts the countdown', async () => {
  await open(); await expire();
  const press = button().props.onPress;
  await act(async () => { await Promise.all([press(), press()]); });
  expect(supabase!.auth.resend).toHaveBeenCalledTimes(1);
  expect(supabase!.auth.resend).toHaveBeenCalledWith({type:'signup',email:'user@example.com',options:{emailRedirectTo:'bustripplanner://auth/callback'}});
  expect(text()).toContain('Resend email (60s)');
  expect(text()).toContain('Confirmation email sent.');
  expect(button().props.disabled).toBe(true);
});

test('disables sending and back buttons until an in-flight request finishes', async () => {
  let finish!: (value: never) => void;
  jest.mocked(supabase!.auth.resend).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await open(); await expire();
  let request!: Promise<void>;
  await act(async () => { request = button().props.onPress(); });
  expect(button().props.disabled).toBe(true);
  expect(text()).toContain('Sending…');
  expect(tree!.root.findAllByType(Pressable)[1].props.disabled).toBe(true);
  await act(async () => { finish({error:null} as never); await request; });
  expect(text()).toContain('Resend email (60s)');
});

test('network errors are visible and permit retry without resetting the expired timer', async () => {
  jest.mocked(supabase!.auth.resend).mockRejectedValueOnce(new Error('Network unavailable'));
  await open(); await expire();
  await act(async () => { await button().props.onPress(); });
  expect(text()).toContain('Network unavailable');
  expect(button().props.disabled).toBe(false);
});

test('server rate limits are visible and impose another cooldown', async () => {
  const error = Object.assign(new Error('Please try again later'), {status:429});
  jest.mocked(supabase!.auth.resend).mockResolvedValueOnce({error} as never);
  await open(); await expire();
  await act(async () => { await button().props.onPress(); });
  expect(text()).toContain('Please try again later');
  expect(signupConfirmation.remember).toHaveBeenCalledWith('user@example.com');
  expect(button().props.disabled).toBe(true);
});

test('remounting restores the existing deadline rather than restarting 60 seconds', async () => {
  const original = pending();
  jest.mocked(signupConfirmation.get).mockResolvedValue(original);
  await open();
  await act(async () => { jest.advanceTimersByTime(20_000); tree!.unmount(); });
  await act(async () => { jest.advanceTimersByTime(25_000); });
  await open();
  expect(text()).toContain('Resend email (15s)');
});

test('foregrounding recalculates time after background suspension', async () => {
  let onChange!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    onChange = callback;
    return {remove:jest.fn()};
  });
  await open();
  jest.setSystemTime(Date.now()+75_000);
  await act(async () => { onChange('active'); });
  expect(button().props.disabled).toBe(false);
});

test('back returns to Account/sign-in, and missing confirmation state cannot send email', async () => {
  jest.mocked(signupConfirmation.get).mockResolvedValue(null);
  await open();
  expect(button().props.disabled).toBe(true);
  await act(async () => { tree!.root.findAllByType(Pressable)[1].props.onPress(); });
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/account');
  expect(supabase!.auth.resend).not.toHaveBeenCalled();
});
