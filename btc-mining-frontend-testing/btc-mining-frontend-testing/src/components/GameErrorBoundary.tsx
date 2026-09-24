import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface State { hasError: boolean; error?: string }

export default class GameErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, error: e.message };
  }

  componentDidCatch() {}

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <LinearGradient colors={['#0a0f1e', '#0f172a']} style={s.container}>
        <Text style={s.icon}>⚠️</Text>
        <Text style={s.title}>Game crashed</Text>
        <Text style={s.sub}>Something went wrong. Tap to restart.</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false })}>
          <Text style={s.btnText}>Restart Game</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#0e7490', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
