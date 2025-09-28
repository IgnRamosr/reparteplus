import React from 'react';
import { Text, type TextProps } from 'react-native';

const PRIMARY = '#0EA5A4';     // teal principal
const TEXT = '#0F172A';        // texto fuerte
const TEXT_MUTED = '#64748B';  // gris suave

type ThemedTextProps = TextProps & {
  type?: 'title' | 'subtitle' | 'link' | 'default' | 'defaultSemiBold';
};

export function ThemedText({ style, type = 'default', ...rest }: ThemedTextProps) {
  let textStyle: any = { fontSize: 16, color: TEXT };

  switch (type) {
    case 'title':
      textStyle = { fontSize: 28, fontWeight: '800', color: PRIMARY };
      break;
    case 'subtitle':
      textStyle = { fontSize: 18, fontWeight: '600', color: TEXT_MUTED };
      break;
    case 'link':
      textStyle = { fontSize: 16, fontWeight: '600', color: PRIMARY };
      break;
    case 'defaultSemiBold':
      textStyle = { fontSize: 16, fontWeight: '600', color: TEXT };
      break;
    default:
      textStyle = { fontSize: 16, color: TEXT };
  }

  return <Text {...rest} style={[textStyle, style]} />;
}
