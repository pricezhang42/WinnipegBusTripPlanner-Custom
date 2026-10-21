import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { AppState, AppStateStatus, Pressable, TextInput } from 'react-native';
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
  supabase: { auth: { resend: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({ data: { session: { access_token: 't' } }, error: null })) } },
  authRedirect: () => 'bustripplanner://auth/callback',
}));
jest.mock('../../lib/signupConfirmation', () => ({
  ...jest.requireActual<typeof import('../../lib/signupConfirmation')>('../../lib/signupConfirmation'),
  signupConfirmation: { get: jest.fn(), remember: jest.fn(), resend: jest.fn(), warning: '' },
}));

let tree: ReactTestRenderer | undefined;
const pressable = (id: string) => tree!.root.find(node => node.type === Pressable && node.props.testID === id);
const button = () => pressable('resend');
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
  expect(text()).toContain('You can also open the link in the email on this device.');
  expect(text()).toContain('user@example.com');
  expect(text()).toContain('Resend code in 60s');
  expect(button().props.disabled).toBe(true);
  await act(async () => { await button().props.onPress(); });
  expect(supabase!.auth.resend).not.toHaveBeenCalled();
  await expire();
  expect(button().props.disabled).toBe(false);
  expect(text()).toContain('"Resend code"');
});

test('resends with the existing callback, blocks double taps and restarts the countdown', async () => {
  await open(); await expire();
  const press = button().props.onPress;
  await act(async () => { await Promise.all([press(), press()]); });
  expect(supabase!.auth.resend).toHaveBeenCalledTimes(1);
  expect(supabase!.auth.resend).toHaveBeenCalledWith({type:'signup',email:'user@example.com',options:{emailRedirectTo:'bustripplanner://auth/callback'}});
  expect(text()).toContain('Resend code in 60s');
  expect(text()).toContain('A new code is on its way.');
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
  expect(pressable('back').props.disabled).toBe(true);
  await act(async () => { finish({error:null} as never); await request; });
  expect(text()).toContain('Resend code in 60s');
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
  expect(text()).toContain('Resend code in 15s');
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
  await act(async () => { pressable('back').props.onPress(); });
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/account');
  expect(supabase!.auth.resend).not.toHaveBeenCalled();
});

test('verifies a 6-digit code and opens Account', async () => {
  await open();
  const input = () => tree!.root.findByType(TextInput);
  expect(text()).toContain('We sent a 6-digit code to');
  await act(async () => { input().props.onChangeText('12a34'); });
  expect(input().props.value).toBe('1234');
  expect(pressable('verify').props.disabled).toBe(true);
  await act(async () => { input().props.onChangeText('1234567'); });
  expect(input().props.value).toBe('123456');
  expect(pressable('verify').props.disabled).toBe(false);
  await act(async () => { await pressable('verify').props.onPress(); });
  expect(supabase!.auth.verifyOtp).toHaveBeenCalledWith({ email: 'user@example.com', token: '123456', type: 'email' });
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/account');
});

test('a wrong or expired code shows an error and clears the entry', async () => {
  jest.mocked(supabase!.auth.verifyOtp).mockResolvedValueOnce({ data: { session: null }, error: Object.assign(new Error('Token has expired or is invalid'), { status: 403 }) } as never);
  await open();
  await act(async () => { tree!.root.findByType(TextInput).props.onChangeText('000000'); });
  await act(async () => { await pressable('verify').props.onPress(); });
  expect(text()).toContain('That code is incorrect or has expired.');
  expect(tree!.root.findByType(TextInput).props.value).toBe('');
  expect(router.replace).not.toHaveBeenCalled();
});
