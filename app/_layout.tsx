import { Stack } from "expo-router";

export default function RootLayout() {
    return (
    <Stack initialRouteName="CreacionGrupos">
        <Stack.Screen name="InvitacionParticipantesLink" options={{ headerShown: false }}/>
        <Stack.Screen name="CreacionGrupos" options={{ headerShown: false }}/>
    </Stack >
    );
}
