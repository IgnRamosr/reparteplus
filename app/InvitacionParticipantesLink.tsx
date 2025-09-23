import React from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

const InvitacionParticipantesLink = () => {
return (
    <View style={estilos.container} >
        <View style={{position:'absolute', top:0, justifyContent:'center' , margin:'10%'}}>
        <View style={{width:'100%', flex:1, justifyContent:'center', alignItems:'center'}}>
            <Text style={{color:'black', fontSize:40, fontWeight:'bold'}}>Reparte+</Text>
            <Text style={{color:'black', fontSize:20, fontWeight:'bold'}}>Invitar participante mediante link</Text>
        </View>||||
        </View>
        <View style={{width:'100%', gap:8 }}>

        <Text style={{alignItems:'flex-start', color:'black', fontSize:20, fontWeight:'600', marginLeft:'5%' }}>Link de grupo</Text>

        <TextInput style={estilos.inputLinkGrupo}></TextInput>
        <View style={{justifyContent:'center', alignItems:'center'}}>
        <View style={{width:'60%'}}>
        <Pressable style={estilos.botonCrearGrupo}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>Compartir link</Text>
        </Pressable>
        </View>
        </View>
        </View>
    </View>
)
}

export default InvitacionParticipantesLink

const estilos = StyleSheet.create({
    container: {backgroundColor: "#f8fafc", justifyContent: 'center', alignItems: 'center', flex:1},
    inputLinkGrupo: {borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, width:'90%', marginLeft:'5%' },
    botonCrearGrupo: {marginTop: 16,height: 48 ,borderRadius: 15, backgroundColor: 'black',alignItems:'center', justifyContent: 'center'}
})