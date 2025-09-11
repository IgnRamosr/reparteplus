// app/invite/[token].tsx
import { useEffect } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';

export default function InviteRedirect() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  useEffect(() => {
    const t = Array.isArray(token) ? token[0] : token;
    const href: Href = t
      ? (`/(auth)/register?invite=${encodeURIComponent(t)}` as Href)
      : ('/(auth)/register' as Href);

    const id = setTimeout(() => router.replace(href), 0); // <- clave
    return () => clearTimeout(id);
  }, [token]);

  return null;
}
