import React from 'react';
import { View, type ViewProps } from 'react-native';

const BG = '#F8FBFC'; // fondo ledger-teal (casi blanco azulado)

export function ThemedView(props: ViewProps) {
  return <View {...props} style={[{ backgroundColor: BG, flex: 1 }, props.style]} />;
}
