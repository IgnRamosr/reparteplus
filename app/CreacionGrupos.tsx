import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';




export default function CrearGrupo() {

  const [nombreGrupo, setNombreGrupo] = useState('');
  const nombreValido = nombreGrupo.trim().length > 0;

  const crearGrupo = () => {
    const nombreGrupoLimpio = nombreGrupo.trim();

    if(!nombreGrupoLimpio){

      return;
    }

    Alert.alert('OK', `Creando grupo: ${nombreGrupoLimpio}`);

  }

  return (
    <View style={estilos.container}>
        <View style={{position:'absolute', top:0, justifyContent:'center' , margin:'10%'}}>
          <View style={{width:'100%', flex:1, justifyContent:'center', alignItems:'center'}}>
            <Text style={{color:'black', fontSize:40, fontWeight:'bold'}}>Reparte+</Text>
            <Text style={{color:'black', fontSize:20, fontWeight:'bold'}}>Creación de grupos</Text>
          </View>
        </View>
        <View style={{width:'100%', gap:8 }}>

          <Text style={{alignItems:'flex-start', color:'black', fontSize:20, fontWeight:'600', marginLeft:'5%' }}>Nombre de grupo</Text>

        <TextInput 
        onChangeText={(nombre) => {setNombreGrupo(nombre);}} 
        placeholder="Ej: Viaje a Pucón"
        maxLength={40}
        style={estilos.inputNombreGrupo}>
        </TextInput>
        <View style={{justifyContent:'center', alignItems:'center'}}>
        <View style={{width:'60%'}}>
          <Pressable
          onPress={crearGrupo}
          disabled={!nombreValido}
          style={({pressed}) => [estilos.botonCrearGrupo,!nombreValido && estilos.botonCrearGrupoDeshabilitado, pressed && nombreValido && estilos.botonCrearGrupoPresionado]}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>Crear</Text>
          </Pressable>
        </View>
        </View>
        </View>
      </View>
  )
}

const estilos = StyleSheet.create({
    container: {backgroundColor: "#f8fafc", justifyContent: 'center', alignItems: 'center', flex:1},
    inputNombreGrupo: {borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, width:'90%', marginLeft:'5%' },
    inputNombreGrupoError: {borderWidth: 1, borderColor: "#dc2626", borderRadius: 8, padding: 12, width:'90%', marginLeft:'5%' },
    botonCrearGrupo: {marginTop: 16,height: 48 ,borderRadius: 15, backgroundColor: 'black',alignItems:'center', justifyContent: 'center'},
    botonCrearGrupoDeshabilitado: {marginTop: 16,height: 48 ,borderRadius: 15, backgroundColor: 'black',alignItems:'center', justifyContent: 'center', opacity: 0.5 },
    botonCrearGrupoPresionado: { opacity: 0.85, transform: [{ scale: 0.99 }] },
})