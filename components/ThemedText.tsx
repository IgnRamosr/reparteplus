import { Text, TextProps } from 'react-native';

export function ThemedText(props: TextProps & { type?: 'title' | 'subtitle' | 'link' | 'defaultSemiBold' }) {
  let style: any = { fontSize: 16 };
  if (props.type === 'title') style = { fontSize: 24, fontWeight: 'bold' };
  if (props.type === 'subtitle') style = { fontSize: 18, color: '#666' };
  if (props.type === 'link') style = { fontSize: 16, color: 'white' };
  if (props.type === 'defaultSemiBold') style = { fontSize: 16, fontWeight: '600' };
  return <Text {...props} style={[style, props.style]} />;
}
