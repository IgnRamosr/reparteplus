import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Slot, Stack } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import '../lib/amplify';


export default function RootLayout() {

    return (
    <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Slot/>
    </Stack >
    );

function Loader({ message }: { message?: string }) {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        {message && <Text style={{ marginTop: 12, textAlign: "center" }}>{message}</Text>}
        </View>
    );

}
}



