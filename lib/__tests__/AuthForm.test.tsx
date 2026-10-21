import React from 'react';
import { jest, test, expect, beforeEach } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { TextInput, Pressable } from 'react-native';
import { AuthForm } from '../../components/AuthForm';
import { supabase } from '../supabase';
import { router } from 'expo-router';
import { signupConfirmation } from '../signupConfirmation';
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('../supabase', () => ({
  supabase: { auth: {
    signInWithPassword: jest.fn(async () => ({ error: null })),
    signUp: jest.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })),
    updateUser: jest.fn(async () => ({ error: null })),
  } },
  authRedirect: () => 'bustripplanner://auth/callback',
}));
jest.mock('../signupConfirmation', () => ({
  resendSeconds: (pending: { resendAvailableAt: number }) => Math.max(0, Math.ceil((pending.resendAvailableAt - Date.now()) / 1000)),
  signupConfirmation: { get: jest.fn(async () => null), select: jest.fn(async () => {}), remember: jest.fn(async () => ({})) },
}));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(signupConfirmation.get).mockResolvedValue(null); });
test('invalid input does not send credentials; valid input signs in', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<AuthForm />); });
  await act(async () => { await tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(supabase!.auth.signInWithPassword).not.toHaveBeenCalled();
  await act(async () => {
    const inputs = tree.root.findAllByType(TextInput);
    inputs[0].props.onChangeText('test@example.com');
    inputs[1].props.onChangeText('valid-password');
  });
  await act(async () => { await tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(supabase!.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: 'valid-password' });
  await act(async () => tree.unmount());
});
test('recovery submits email without requiring a password', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<AuthForm />); });
  await act(async () => { tree.root.findAllByType(Pressable)[1].props.onPress(); });
  expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText('test@example.com'); });
  await act(async () => { await tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(supabase!.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', { redirectTo: 'bustripplanner://auth/callback' });
  await act(async () => tree.unmount());
});

async function signupForm() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<AuthForm />); });
  await act(async () => { tree.root.findAllByType(Pressable)[2].props.onPress(); });
  await act(async () => {
    const inputs = tree.root.findAllByType(TextInput);
    inputs[0].props.onChangeText(' test@example.com ');
    inputs[1].props.onChangeText('valid-password');
    inputs[2].props.onChangeText('valid-password');
  });
  return tree;
}

test('signup requiring confirmation remembers the email and navigates without putting credentials in the URL', async () => {
  const tree = await signupForm();
  await act(async () => { await tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(supabase!.auth.signUp).toHaveBeenCalledWith({email:'test@example.com',password:'valid-password',options:{emailRedirectTo:'bustripplanner://auth/callback'}});
  expect(signupConfirmation.remember).toHaveBeenCalledWith('test@example.com');
  expect(router.push).toHaveBeenCalledWith('/auth/confirm-email');
  expect(JSON.stringify(tree.toJSON())).toContain('Welcome back');
  expect(tree.root.findAllByType(TextInput)[1].props.value).toBe('');
  await act(async () => tree.unmount());
});

test('signup with an immediate session skips the confirmation page', async () => {
  jest.mocked(supabase!.auth.signUp).mockResolvedValueOnce({data:{session:{access_token:'test'}},error:null} as never);
  const tree = await signupForm();
  await act(async () => { await tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/account');
  expect(router.push).not.toHaveBeenCalled();
  expect(signupConfirmation.remember).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('failed signup stays on the form and does not start a cooldown', async () => {
  jest.mocked(supabase!.auth.signUp).mockResolvedValueOnce({data:{session:null},error:new Error('Signup failed')} as never);
  const tree = await signupForm();
  await act(async () => { await tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(router.push).not.toHaveBeenCalled();
  expect(signupConfirmation.remember).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Signup failed');
  await act(async () => tree.unmount());
});

test('returning to signup for a cooling-down email reopens confirmation without another email request', async () => {
  jest.mocked(signupConfirmation.get).mockResolvedValueOnce({email:'test@example.com',resendAvailableAt:Date.now()+60_000});
  const tree = await signupForm();
  await act(async () => { await tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(supabase!.auth.signUp).not.toHaveBeenCalled();
  expect(signupConfirmation.select).toHaveBeenCalledWith('test@example.com');
  expect(router.push).toHaveBeenCalledWith('/auth/confirm-email');
  await act(async () => tree.unmount());
});
