// app/PagarTarjeta.tsx
// Requisitos: expo-linking, expo-web-browser, expo-print, expo-sharing
// Asegúrate de tener scheme en app.json: { "expo": { "scheme": "reparteplus" } }

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, Pressable, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, router } from 'expo-router';

// ====== PALETA LedgerTeal ======
const PRIMARY = '#0EA5A4';
const BG = '#F8FBFC';
const INK = '#0F172A';
const BORDER = '#E2E8F0';
const TEXT_MUTED = '#64748B';

// ====== CONFIG SANDBOX ======
// Cambia a 'CLP' cuando habilites CLP en tu cuenta Business sandbox
const CURRENCY: 'USD' | 'CLP' = 'USD';

// Usa email o merchantId (lo más robusto es merchantId; si no lo tienes, deja el email)
const USE_MERCHANT_ID = false;
const PAYPAL_SELLER_EMAIL = 'sb-igui540123012@business.example.com'; // tu Business sandbox (receptor)
const PAYPAL_MERCHANT_ID = ''; // opcional: el ID de merchant (empieza con "SB..." en sandbox)

export default function PagarTarjeta() {
  const { total } = useLocalSearchParams<{ total?: string }>();
  const [monto, setMonto] = useState<string>(total ?? '');
  const [descripcion, setDescripcion] = useState('Pago Reparte+');
  const [pagador, setPagador] = useState('Ignacio Ramos'); // Hacia (quien recibe)
  const [deudores, setDeudores] = useState('Luis; Sebastián'); // Desde (quienes deben)
  const [grupo, setGrupo] = useState('Asado Viernes');

  const formatAmount = (raw: string) => {
    const n = Number(raw);
    if (Number.isNaN(n) || n <= 0) return '';
    return CURRENCY === 'USD' ? n.toFixed(2) : String(Math.round(n)); // USD con decimales, CLP entero
  };

  // Deep links de retorno/cancelación
  const returnUrl = useMemo(
    () =>
      Linking.createURL('paypal/return', {
        queryParams: { status: 'success', amount: formatAmount(monto) || '0', currency: CURRENCY, grupo, pagador },
      }),
    [monto, grupo, pagador]
  );
  const cancelUrl = useMemo(
    () => Linking.createURL('paypal/cancel', { queryParams: { status: 'cancel' } }),
    []
  );

  // URL PayPal (webscr)
  const paypalUrl = useMemo(() => {
    const amount = formatAmount(monto);
    if (!amount) return '';

    const params = new URLSearchParams({
      cmd: '_xclick',
      currency_code: CURRENCY,
      item_name: descripcion || 'Pago Reparte+',
      amount,
      return: returnUrl,
      cancel_return: cancelUrl,
      custom: JSON.stringify({ grupo, pagador, deudores }),
      // Opcional: evita pedir dirección/envío
      no_shipping: '1',
      no_note: '1',
    });

    const businessValue = USE_MERCHANT_ID && PAYPAL_MERCHANT_ID
      ? PAYPAL_MERCHANT_ID
      : PAYPAL_SELLER_EMAIL;

    if (!businessValue) return '';
    params.set('business', businessValue);

    return `https://www.sandbox.paypal.com/cgi-bin/webscr?${params.toString()}`;
  }, [monto, descripcion, returnUrl, cancelUrl, grupo, pagador, deudores]);

  // Manejo del retorno por deep link
  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      const { queryParams, path } = Linking.parse(url);
      if (path?.startsWith('paypal/return') && queryParams?.status === 'success') {
        await generarComprobantePDF({
          grupo,
          pagador,
          deudores,
          descripcion,
          monto: String(queryParams.amount || formatAmount(monto) || '0'),
          currency: String(queryParams.currency || CURRENCY),
          fecha: new Date().toLocaleString('es-CL'),
        });
        Alert.alert('Pago', 'Pago marcado como realizado. Se generó el comprobante.');
        router.back();
      } else if (path?.startsWith('paypal/cancel')) {
        Alert.alert('Pago', 'Pago cancelado por el usuario.');
      }
    });

    (async () => {
      const init = await Linking.getInitialURL();
      if (init) {
        const { queryParams, path } = Linking.parse(init);
        if (path?.startsWith('paypal/return') && queryParams?.status === 'success') {
          await generarComprobantePDF({
            grupo,
            pagador,
            deudores,
            descripcion,
            monto: String(queryParams.amount || formatAmount(monto) || '0'),
            currency: String(queryParams.currency || CURRENCY),
            fecha: new Date().toLocaleString('es-CL'),
          });
          Alert.alert('Pago', 'Pago marcado como realizado. Se generó el comprobante.');
          router.back();
        }
      }
    })();

    return () => sub.remove();
  }, [grupo, pagador, deudores, descripcion, monto]);

  const abrirPayPal = async () => {
    if (!paypalUrl) {
      Alert.alert('Configura el pago', 'Verifica el monto y el receptor Business (email o merchantId).');
      return;
    }
    await WebBrowser.openBrowserAsync(paypalUrl); // Usa el navegador del sistema (recomendado por PayPal)
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Pago con tarjeta (PayPal Sandbox)</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Grupo</Text>
        <TextInput value={grupo} onChangeText={setGrupo} style={styles.input} placeholder="Nombre del grupo" />
        <Text style={styles.label}>Hacia (pagador / receptor)</Text>
        <TextInput value={pagador} onChangeText={setPagador} style={styles.input} placeholder="Persona que recibe" />
        <Text style={styles.label}>Desde (deudores)</Text>
        <TextInput value={deudores} onChangeText={setDeudores} style={styles.input} placeholder="Separar por ;" />
        <Text style={styles.label}>Descripción</Text>
        <TextInput value={descripcion} onChangeText={setDescripcion} style={styles.input} placeholder="Pago Reparte+" />
        <Text style={styles.label}>Monto total ({CURRENCY})</Text>
        <TextInput
          value={monto}
          onChangeText={setMonto}
          style={styles.input}
          keyboardType="numeric"
          placeholder={CURRENCY === 'USD' ? 'Ej: 12.50' : 'Ej: 25990'}
        />
        <Pressable onPress={abrirPayPal} style={styles.btn}>
          <Text style={styles.btnText}>Pagar con PayPal (Sandbox)</Text>
        </Pressable>
        {!!paypalUrl && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.helpTitle}>Link generado</Text>
            <Text style={styles.helpText} selectable>{paypalUrl}</Text>
          </View>
        )}
        <Text style={[styles.helpText, { marginTop: 16 }]}>
          Inicia sesión con tu cuenta <Text style={{ fontWeight: '700' }}>Personal sandbox</Text> para pagar. Si esto
          funciona en <Text style={{ fontWeight: '700' }}>USD</Text>, habilita luego <Text style={{ fontWeight: '700' }}>CLP</Text> en la cuenta Business y cambia CURRENCY a 'CLP'.
        </Text>
      </View>
    </ScrollView>
  );
}

async function generarComprobantePDF(props: {
  grupo: string; pagador: string; deudores: string; descripcion: string;
  monto: string; currency: string; fecha: string;
}) {
  const { grupo, pagador, deudores, descripcion, monto, currency, fecha } = props;
  const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; color: #0F172A; }
      .wrap { padding: 24px; }
      .title { color: #0EA5A4; font-size: 20px; margin-bottom: 8px; }
      .card { border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; }
      .row { display: flex; justify-content: space-between; margin: 8px 0; }
      .muted { color: #64748B; }
      .strong { font-weight: bold; }
      .footer { margin-top: 16px; font-size: 12px; color: #64748B; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="title">Comprobante de pago – Reparte+</div>
      <div class="card">
        <div class="row"><span class="muted">Fecha</span><span class="strong">${fecha}</span></div>
        <div class="row"><span class="muted">Grupo</span><span>${grupo}</span></div>
        <div class="row"><span class="muted">Descripción</span><span>${descripcion}</span></div>
        <div class="row"><span class="muted">Hacia (pagador)</span><span>${pagador}</span></div>
        <div class="row"><span class="muted">Desde (deudores)</span><span>${deudores}</span></div>
        <div class="row"><span class="muted">Monto</span><span class="strong">${currency} ${monto}</span></div>
      </div>
      <div class="footer">Pago procesado vía PayPal Sandbox. Este comprobante es referencial.</div>
    </div>
  </body>
  </html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { dialogTitle: 'Compartir comprobante' });
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  h1: { fontSize: 20, fontWeight: '700', color: INK, marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderColor: BORDER, borderWidth: 1 },
  label: { color: TEXT_MUTED, marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, backgroundColor: '#fff', color: INK },
  btn: { backgroundColor: PRIMARY, padding: 14, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  helpTitle: { fontWeight: '700', marginTop: 8, color: INK },
  helpText: { color: TEXT_MUTED, fontSize: 12 }
});
