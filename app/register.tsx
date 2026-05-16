import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VoiceButton } from '../components/VoiceButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { useVoiceRecorder } from '../lib/useVoiceRecorder';
import { processVoiceEntry, processTextEntry, ParsedEntry } from '../lib/openai';
import { insertFoodEntry, insertExerciseEntry } from '../lib/database';
import { todayISO } from '../lib/utils';

const C = {
  bg: '#F2F3F7', white: '#FFFFFF', primary: '#3B5BDB',
  text: '#1A1A2E', muted: '#6B7280', border: '#F0F0F5',
};

const EXAMPLES = [
  { icon: 'sunny-outline',  text: '"He desayunado dos tostadas con tomate y aceite"' },
  { icon: 'restaurant-outline', text: '"Comida: arroz con pollo y ensalada variada"' },
  { icon: 'walk-outline',   text: '"He corrido 30 minutos esta mañana"' },
  { icon: 'moon-outline',   text: '"Cena: salmón al horno con verduras"' },
];

export default function RegisterScreen() {
  const { state, error, startRecording, stopRecording, reset } = useVoiceRecorder();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pending, setPending] = useState<ParsedEntry | null>(null);

  const handleStop = async () => {
    const uri = await stopRecording();
    if (!uri) return;
    try {
      const { transcript, entry } = await processVoiceEntry(uri);
      setTranscript(transcript); setPending(entry); setModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo procesar el audio.');
    } finally { reset(); }
  };

  const handleText = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const entry = await processTextEntry(text.trim());
      setTranscript(text.trim()); setPending(entry); setModalVisible(true); setText('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Error al procesar.');
    } finally { setLoading(false); }
  };

  const handleConfirm = async (entry: ParsedEntry) => {
    const today = todayISO();
    try {
      if (entry.type === 'food') await insertFoodEntry({ ...entry.data, date: today, raw_transcript: transcript });
      else if (entry.type === 'exercise') await insertExerciseEntry({ ...entry.data, date: today, raw_transcript: transcript });
      setModalVisible(false); setPending(null);
      Alert.alert('✅ Guardado', 'Entrada registrada correctamente.');
    } catch { Alert.alert('Error', 'No se pudo guardar.'); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Text style={s.title}>Registro</Text>
          <Text style={s.subtitle}>Habla o escribe lo que has comido o el ejercicio que has hecho</Text>

          {/* Voice card */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.pill, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="mic" size={12} color="#8B5CF6" />
                <Text style={[s.pillTxt, { color: '#8B5CF6' }]}>Por voz</Text>
              </View>
            </View>

            <View style={s.micArea}>
              <Text style={s.micHint}>
                {state === 'idle' && 'Mantén pulsado el botón para hablar'}
                {state === 'recording' && '🔴 Grabando... suelta para parar'}
                {state === 'processing' && 'Procesando tu voz...'}
              </Text>
              <VoiceButton state={state} onPressIn={startRecording} onPressOut={handleStop} />
              {state === 'processing' && (
                <View style={s.processingRow}>
                  <ActivityIndicator color={C.primary} size="small" />
                  <Text style={s.processingTxt}>Transcribiendo con Whisper...</Text>
                </View>
              )}
            </View>

            {error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            )}
          </View>

          {/* Examples */}
          <View style={s.card}>
            <Text style={s.cardTitle}>💡 Ejemplos de lo que puedes decir</Text>
            {EXAMPLES.map((ex, i) => (
              <View key={i} style={s.exRow}>
                <View style={s.exIcon}>
                  <Ionicons name={ex.icon as any} size={16} color={C.primary} />
                </View>
                <Text style={s.exTxt}>{ex.text}</Text>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divTxt}>o escribe</Text>
            <View style={s.divLine} />
          </View>

          {/* Text input card */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.pill, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="create-outline" size={12} color="#3B82F6" />
                <Text style={[s.pillTxt, { color: '#3B82F6' }]}>Texto libre</Text>
              </View>
            </View>
            <TextInput
              style={s.input}
              value={text}
              onChangeText={setText}
              placeholder="Ej: comida con arroz, pollo a la plancha y ensalada..."
              placeholderTextColor="#D1D5DB"
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[s.btn, (!text.trim() || loading) && s.btnOff]}
              onPress={handleText}
              disabled={!text.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="sparkles-outline" size={16} color="#fff" />
                    <Text style={s.btnTxt}>Analizar con IA</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={modalVisible}
        transcript={transcript}
        entry={pending}
        onConfirm={handleConfirm}
        onDiscard={() => { setModalVisible(false); setPending(null); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flex: 1, paddingHorizontal: 16 },
  title:        { fontSize: 32, fontWeight: '800', color: C.text, paddingTop: 16, marginBottom: 4 },
  subtitle:     { fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 18 },
  card:         { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:   { marginBottom: 14 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillTxt:      { fontSize: 12, fontWeight: '600' },
  micArea:      { alignItems: 'center', paddingVertical: 8, gap: 16 },
  micHint:      { fontSize: 14, color: C.muted, textAlign: 'center' },
  processingRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  processingTxt:{ fontSize: 13, color: C.muted },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginTop: 8 },
  errorTxt:     { color: '#EF4444', fontSize: 13 },
  exRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  exIcon:       { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  exTxt:        { fontSize: 12, color: C.muted, flex: 1, fontStyle: 'italic' },
  divider:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4, marginBottom: 12 },
  divLine:      { flex: 1, height: 1, backgroundColor: C.border },
  divTxt:       { fontSize: 13, color: C.muted },
  input:        { color: C.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 12, lineHeight: 20 },
  btn:          { backgroundColor: C.primary, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnOff:       { opacity: 0.4 },
  btnTxt:       { color: '#fff', fontWeight: '700', fontSize: 15 },
});
