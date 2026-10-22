import React from 'react';
import { beforeEach, expect, jest, test } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AuthCallbackScreen from '../../app/auth/callback';
import { exchangeAuthCode } from '../authCallback';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('../authCallback', () => ({ exchangeAuthCode: jest.fn() }));

let tree: ReactTestRenderer;
const text = () => JSON.stringify(tree.toJSON());
async function open(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  await act(async () => { tree = renderer.create(<AuthCallbackScreen />); });
}

beforeEach(() => { jest.clearAllMocks(); });

test('a valid signup link confirms the account and opens Account', async () => {
  jest.mocked(exchangeAuthCode).mockResolvedValue({ data: { session: { access_token: 't' } }, error: null } as any);
  await open({ code: 'abc' });
  expect(exchangeAuthCode).toHaveBeenCalledWith('abc');
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/account');
});

test('an expired signup link names the confirmation email and points to a new code', async () => {
  await open({ error: 'access_denied', error_description: 'Email link is invalid or has expired' });
  expect(text()).toContain('Unable to confirm');
  expect(text()).toContain('This confirmation link is invalid or has expired. Request a new code from the confirmation page.');
  expect(exchangeAuthCode).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

test('an old password reset link is not exchanged and points to Forgot password', async () => {
  await open({ code: 'abc', recovery: 'true' });
  expect(text()).toContain('This password reset link is no longer used. Use Forgot password? to get a code.');
  expect(text()).not.toContain('Unable to confirm');
  expect(exchangeAuthCode).not.toHaveBeenCalled();
  await act(async () => { tree.root.find(node => node.type === Pressable && node.props.testID === 'sign-in').props.onPress(); });
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/account');
});
