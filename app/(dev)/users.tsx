// app/(dev)/users.tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { clearUsers, getUsers, saveUser } from '../../lib/db';

type UserRow = {
  id: number;
  email: string;
  phone?: string | null;
  password?: string | null;
  inviteToken?: string | null;
  created_at?: string | null;
};

export default function UsersScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setItems(data as UserRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getUsers();
      setItems(data as UserRow[]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>Usuarios (SQLite)</Text>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Btn title="Recargar" onPress={load} />
        <Btn
          title="Crear demo"
          style={{ backgroundColor: '#0b7' }}
          onPress={async () => {
            const rnd = Math.floor(Math.random() * 1e12);
            await saveUser({
              email: `demo${rnd}@test.com`,
              phone: '912345678',
              password: 'Demo123*',
              inviteToken: null,
            });
            await load();
          }}
        />
        <Btn
          title="Borrar todo"
          style={{ backgroundColor: '#700' }}
          onPress={async () => { await clearUsers(); await load(); }}
        />
      </View>

      {loading ? (
        <Text>Cargando…</Text>
      ) : items.length === 0 ? (
        <Text>No hay usuarios guardados.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#ddd' }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.email}</Text>
              {!!item.phone && <Text>{item.phone}</Text>}
              {!!item.created_at && <Text style={{ color: '#666' }}>{item.created_at}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

function Btn({
  title, onPress, style,
}: { title: string; onPress(): void | Promise<void>; style?: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={[{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: '#111' }, style]}
    >
      <Text style={{ color: 'white', fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}
