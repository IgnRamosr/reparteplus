import React from 'react';
import { router } from 'expo-router';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { Pressable } from 'react-native';

export default function HomeScreen() {
return (
    <ThemedView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56, gap: 16 }}>
    <ThemedText type="title" style={{ textAlign: 'center' }}>
        Reparte+
    </ThemedText>
    <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 12 }}>
        Mis grupos (demo)
    </ThemedText>

    <ThemedText>Has iniciado sesión correctamente.</ThemedText>

    <Pressable
        onPress={() => router.push('/users' as const)} // opcional: lista SQLite de usuarios
        style={{
        marginTop: 16,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
        }}
    >
        <ThemedText type="link">Ver usuarios (demo)</ThemedText>
    </Pressable>

    <Pressable
        onPress={() => router.replace('/(auth)/login' as const)} // Cerrar sesión
        style={{
        marginTop: 8,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        }}
    >
        <ThemedText type="link">Cerrar sesión</ThemedText>
    </Pressable>
    </ThemedView>
);
}
