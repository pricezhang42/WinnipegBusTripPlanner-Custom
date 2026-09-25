import React from 'react';
import { jest, test, expect, beforeEach } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { TextInput, Pressable } from 'react-native';
import { AuthForm } from '../../components/AuthForm';
import { supabase } from '../supabase';
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../supabase', () => ({
  supabase: { auth: {
    signInWithPassword: jest.fn(async () => ({ error: null })),
    signUp: jest.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })),
    updateUser: jest.fn(async () => ({ error: null })),
  } },
  authRedirect: () => 'bustripplanner://auth/callback',
}));
beforeEach(() => { jest.clearAllMocks(); });
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
