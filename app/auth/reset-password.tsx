import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { AuthForm } from '@/components/AuthForm';
import { View } from '@/components/Themed';
import { useAuth } from '@/providers/AuthProvider';
export default function ResetPasswordScreen() {
  const { loading, session } = useAuth();
  if (loading) return <ActivityIndicator accessibilityLabel="Loading account" />;
  if (!session) return <Redirect href="/(tabs)/account" />;
  return <View style={{ flex: 1 }}><AuthForm reset /></View>;
}
