import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getDailyGoals, updateDailyGoals, DailyGoals, exportAllData, importAllData } from '../lib/database';
import { GPT_MODEL_GROUPS, GptModelId, DEFAULT_MODEL } from '../lib/openai';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const C = {
  bg: '#F2F3F7', white: '#FFFFFF', primary: '#3B5BDB',
  green: '#2DC653', text: '#1A1A2E', muted: '#6B7280', border: '#F0F0F5',
  orange: '#FF6B35',
};

export default function SettingsScreen() {
  const [apiKey, setApiKey]       = useState('');
  const [model, setModel]         = useState<GptModelId>(DEFAULT_MODEL);
  const [goals, setGoals]         = useState<DailyGoals>({ calories: 2000, protein: 150, carbs: 200, fat: 65 });
  const [saved, setSaved]         = useState(false);
  const [showKey, setShowKey]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  useFocusEffect(useCallback(() => {
    getDailyGoals().then(setGoals);
    AsyncStorage.getItem('openai_api_key').then(k => { if (k) setApiKey(k); });
    AsyncStorage.getItem('openai_model').then(m => { if (m) setModel(m as GptModelId); });
  }, []));

  const save = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem('openai_api_key', apiKey.trim()),
        AsyncStorage.setItem('openai_model', model),
        updateDailyGoals(goals),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los ajustes.');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const date = new Date().toISOString().split('T')[0];
      const path = FileSystem.cacheDirectory + `nutrivoz_backup_${date}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Guardar backup NutriVoz' });
      } else {
        Alert.alert('Exportado', `Backup guardado en: ${path}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo exportar.');
    } finally { setExporting(false); }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const backup = JSON.parse(content);

      if (!backup.version || !backup.exported_at) {
        Alert.alert('Archivo inválido', 'El archivo no parece ser un backup de NutriVoz.');
        return;
      }

      Alert.alert(
        'Importar datos',
        `Backup del ${backup.exported_at.split('T')[0]}.\n\nSe añadirán los registros al historial actual (sin borrar los existentes). ¿Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Importar', onPress: async () => {
              try {
                const { foods, exercises, weights } = await importAllData(backup);
                Alert.alert('✅ Importado', `${foods} comidas, ${exercises} ejercicios, ${weights} pesos restaurados.`);
              } catch (e: any) {
                Alert.alert('Error', e.message ?? 'No se pudo importar el backup.');
              }
            }
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo leer el archivo.');
    } finally { setImporting(false); }
  };

  const updateGoal = (key: keyof DailyGoals, val: string) => {
    setGoals(g => ({ ...g, [key]: parseFloat(val) || 0 }));
  };

  const GOAL_FIELDS: { key: keyof DailyGoals; label: string; icon: string; color: string; bg: string }[] = [
    { key: 'calories', label: 'Calorías',    icon: 'flame',   color: '#FF6B35', bg: '#FFF7ED' },
    { key: 'protein',  label: 'Proteína (g)', icon: 'barbell', color: '#8B5CF6', bg: '#EDE9FE' },
    { key: 'carbs',    label: 'Carbos (g)',   icon: 'leaf',    color: '#3B82F6', bg: '#DBEAFE' },
    { key: 'fat',      label: 'Grasas (g)',   icon: 'water',   color: '#F59E0B', bg: '#FEF3C7' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Text style={s.title}>Ajustes</Text>

          {/* API Key */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.pill, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="key-outline" size={12} color="#8B5CF6" />
                <Text style={[s.pillTxt, { color: '#8B5CF6' }]}>OpenAI API Key</Text>
              </View>
            </View>
            <Text style={s.hint}>
              Necesitas una key de platform.openai.com para la transcripción (Whisper) y análisis de macros.
            </Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="sk-proj-..."
                placeholderTextColor="#D1D5DB"
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowKey(v => !v)}>
                <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
              </TouchableOpacity>
            </View>
            <View style={s.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
              <Text style={s.infoTxt}>Tu key se guarda solo en este dispositivo, nunca se envía a ningún servidor nuestro.</Text>
            </View>
          </View>

          {/* Model selector — grouped */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.pill, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="sparkles-outline" size={12} color="#3B82F6" />
                <Text style={[s.pillTxt, { color: '#3B82F6' }]}>Modelo de IA</Text>
              </View>
            </View>
            <Text style={s.hint}>Elige el modelo para analizar tus comidas y dar sugerencias. Los modelos más nuevos son más potentes pero también más caros.</Text>
            {GPT_MODEL_GROUPS.map(group => (
              <View key={group.group}>
                <Text style={s.groupLabel}>{group.group}</Text>
                {group.models.map(m => {
                  const active = model === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.modelRow, active && s.modelRowActive]}
                      onPress={() => setModel(m.id as GptModelId)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.modelRadio, active && s.modelRadioActive]}>
                        {active && <View style={s.modelRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.modelName, active && { color: C.primary }]}>{m.label}</Text>
                        <Text style={s.modelDesc}>{m.desc}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={18} color={C.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Goals */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.pill, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="trophy-outline" size={12} color="#3B82F6" />
                <Text style={[s.pillTxt, { color: '#3B82F6' }]}>Objetivos diarios</Text>
              </View>
            </View>
            <View style={s.goalsGrid}>
              {GOAL_FIELDS.map(f => (
                <View key={f.key} style={s.goalCard}>
                  <View style={[s.goalIcon, { backgroundColor: f.bg }]}>
                    <Ionicons name={f.icon as any} size={16} color={f.color} />
                  </View>
                  <Text style={s.goalLabel}>{f.label}</Text>
                  <TextInput
                    style={s.goalInput}
                    value={String(goals[f.key])}
                    onChangeText={v => updateGoal(f.key, v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Backup & Restore */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.pill, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="cloud-download-outline" size={12} color="#10B981" />
                <Text style={[s.pillTxt, { color: '#10B981' }]}>Datos y backup</Text>
              </View>
            </View>
            <View style={s.warningBox}>
              <Ionicons name="warning-outline" size={14} color="#92400E" />
              <Text style={s.warningTxt}>
                Los datos se guardan localmente. Si desinstales la app los perderás. Exporta el backup regularmente y guárdalo en Google Drive o similar para poder recuperarlos.
              </Text>
            </View>
            <TouchableOpacity
              style={[s.exportBtn, exporting && { opacity: 0.6 }]}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="download-outline" size={18} color="#fff" /><Text style={s.exportBtnTxt}>Exportar mis datos (JSON)</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.importBtn, importing && { opacity: 0.6 }]}
              onPress={handleImport}
              disabled={importing}
            >
              {importing
                ? <ActivityIndicator color={C.primary} size="small" />
                : <><Ionicons name="cloud-upload-outline" size={18} color={C.primary} /><Text style={s.importBtnTxt}>Restaurar desde backup</Text></>
              }
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.pill, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="information-circle-outline" size={12} color="#10B981" />
                <Text style={[s.pillTxt, { color: '#10B981' }]}>Sobre NutriVoz</Text>
              </View>
            </View>
            {[
              { icon: 'mic-outline',           color: '#8B5CF6', bg: '#EDE9FE', txt: 'Whisper API convierte tu voz en texto con alta precisión en español.' },
              { icon: 'sparkles-outline',      color: '#3B82F6', bg: '#DBEAFE', txt: 'GPT extrae calorías y macros de forma inteligente.' },
              { icon: 'phone-portrait-outline',color: '#10B981', bg: '#D1FAE5', txt: 'Todo se guarda localmente. Sin servidores ni cuentas.' },
              { icon: 'cash-outline',          color: '#F59E0B', bg: '#FEF3C7', txt: 'Coste estimado: ~0.01€ por registro de voz (varía según modelo).' },
            ].map((item, i) => (
              <View key={i} style={s.aboutRow}>
                <View style={[s.aboutIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={s.aboutTxt}>{item.txt}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[s.saveBtn, saved && s.saveBtnOk]} onPress={save}>
            {saved
              ? <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={s.saveBtnTxt}>¡Guardado!</Text></>
              : <Text style={s.saveBtnTxt}>Guardar cambios</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  scroll:         { flex: 1, paddingHorizontal: 16 },
  title:          { fontSize: 32, fontWeight: '800', color: C.text, paddingTop: 16, marginBottom: 20 },
  card:           { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:     { marginBottom: 12 },
  pill:           { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillTxt:        { fontSize: 12, fontWeight: '600' },
  hint:           { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 12 },
  inputRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  input:          { backgroundColor: C.bg, borderRadius: 12, padding: 12, fontSize: 14, color: C.text },
  eyeBtn:         { padding: 10 },
  infoBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10 },
  infoTxt:        { fontSize: 12, color: '#166534', flex: 1, lineHeight: 16 },
  groupLabel:     { fontSize: 11, fontWeight: '700', color: C.muted, marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  modelRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 6 },
  modelRowActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  modelRadio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  modelRadioActive:{ borderColor: C.primary },
  modelRadioDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  modelName:      { fontSize: 14, fontWeight: '700', color: C.text },
  modelDesc:      { fontSize: 11, color: C.muted, marginTop: 1 },
  goalsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard:       { width: '47%', backgroundColor: C.bg, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6 },
  goalIcon:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalLabel:      { fontSize: 11, color: C.muted, textAlign: 'center' },
  goalInput:      { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' },
  warningBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginBottom: 12 },
  warningTxt:     { color: '#92400E', fontSize: 12, flex: 1, lineHeight: 17 },
  exportBtn:      { backgroundColor: '#10B981', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  exportBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  importBtn:      { backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.primary },
  importBtnTxt:   { color: C.primary, fontWeight: '700', fontSize: 15 },
  aboutRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  aboutIcon:      { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aboutTxt:       { fontSize: 13, color: C.muted, flex: 1, lineHeight: 18 },
  saveBtn:        { backgroundColor: C.primary, borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  saveBtnOk:      { backgroundColor: C.green },
  saveBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: 16 },
});
