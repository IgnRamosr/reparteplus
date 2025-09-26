import AsyncStorage from '@react-native-async-storage/async-storage';

const participanteID = 'participant_id';
const emailParticipante = 'email_participant'
const nombreParticipante = 'name_participant'

export async function guardarIdParticipante(id: number, email: string, name: string) {
    await AsyncStorage.setItem(participanteID, String(id));
    await AsyncStorage.setItem(emailParticipante, String(email));
    await AsyncStorage.setItem(nombreParticipante, String(name));
}

export async function obtenerIDparticipante(): Promise<number> {
    const v = await AsyncStorage.getItem(participanteID);
    return Number(v) ;
}

export async function obtenerCorreoparticipante(): Promise<string> {
    const v = await AsyncStorage.getItem(emailParticipante);
    return String(v) ;
}
export async function obtenerNombreparticipante(): Promise<string> {
    const v = await AsyncStorage.getItem(nombreParticipante);
    return String(v) ;
}

export async function borrarIDparticipante() {
    await AsyncStorage.removeItem(participanteID);
    await AsyncStorage.removeItem(emailParticipante);
    await AsyncStorage.removeItem(nombreParticipante);
}