import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, useWindowDimensions, Image, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Circle as SvgCircle, Line, Text as SvgText } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { insertWeightEntry, updateWeightPhoto, clearWeightPhoto, getWeightEntries, WeightEntry } from '../lib/database';
import { todayISO, formatDate } from '../lib/utils';

const C = {
  bg: '#F2F3F7', white: '#FFFFFF', primary: '#3B5BDB',
  text: '#1A1A2E', muted: '#6B7280', border: '#F0F0F5',
  green: '#2DC653', light: '#9CA3AF',
};

const CHART_H = 160;
const PAD = { top: 16, bottom: 28, left: 32, right: 12 };

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const { width: SCREEN_W } = useWindowDimensions();
  const CHART_W = SCREEN_W - 64;
  if (entries.length < 2) return (
    <View style={ch.empty}>
      <Ionicons name="analytics-outline" size={32} color={C.light} />
      <Text style={ch.emptyTxt}>Registra al menos 2 días para ver la gráfica</Text>
    </View>
  );

  const weights = entries.map(e => e.weight_kg);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const range = maxW - minW || 1;
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const toX = (i: number) => PAD.left + (i / (entries.length - 1)) * innerW;
  const toY = (w: number) => PAD.top + (1 - (w - minW) / range) * innerH;
  const points = entries.map((e, i) => `${toX(i)},${toY(e.weight_kg)}`).join(' ');
  const labelIdxs = [0, Math.floor((entries.length - 1) / 2), entries.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {[0, 0.5, 1].map(t => {
        const y = PAD.top + t * innerH;
        const w = minW + (1 - t) * range;
        return (
          <React.Fragment key={t}>
            <Line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke={C.border} strokeWidth={1} />
            <SvgText x={PAD.left - 4} y={y + 4} fontSize={9} fill={C.muted} textAnchor="end">{w.toFixed(1)}</SvgText>
          </React.Fragment>
        );
      })}
      <Polyline points={points} fill="none" stroke={C.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {entries.map((e, i) => (
        <SvgCircle key={i} cx={toX(i)} cy={toY(e.weight_kg)} r={4} fill={C.primary} stroke={C.white} strokeWidth={2} />
      ))}
      {labelIdxs.map(i => (
        <SvgText key={i} x={toX(i)} y={CHART_H - 6} fontSize={9} fill={C.muted} textAnchor="middle">
          {formatDate(entries[i].date).slice(0, 5)}
        </SvgText>
      ))}
    </Svg>
  );
}

async function savePhotoLocally(uri: string, date: string): Promise<string> {
  const dir = FileSystem.documentDirectory + 'weight_photos/';
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = dir + `weight_${date}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export default function WeightScreen() {
  const [entries, setEntries]   = useState<WeightEntry[]>([]);
  const [input, setInput]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    const data = await getWeightEntries(30);
    setEntries(data);
    const todayEntry = data.find(e => e.date === today);
    if (todayEntry) setInput(String(todayEntry.weight_kg));
  }, [today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    const kg = parseFloat(input.replace(',', '.'));
    if (!kg || kg < 20 || kg > 500) {
      Alert.alert('Valor inválido', 'Introduce un peso válido en kg.');
      return;
    }
    setSaving(true);
    try {
      await insertWeightEntry({ date: today, weight_kg: kg });
      await load();
      Alert.alert('✅ Guardado', `Peso registrado: ${kg} kg`);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el peso.');
    } finally { setSaving(false); }
  };

  const pickPhoto = async (date: string) => {
    setAddingPhoto(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitas dar acceso a la galería en ajustes.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]) return;
      const localUri = await savePhotoLocally(result.assets[0].uri, date);
      await updateWeightPhoto(date, localUri);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la foto.');
    } finally { setAddingPhoto(false); }
  };

  const takePhoto = async (date: string) => {
    setAddingPhoto(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitas dar acceso a la cámara en ajustes.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]) return;
      const localUri = await savePhotoLocally(result.assets[0].uri, date);
      await updateWeightPhoto(date, localUri);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la foto.');
    } finally { setAddingPhoto(false); }
  };

  const deletePhoto = async (date: string, photoUri: string) => {
    try {
      await FileSystem.deleteAsync(photoUri, { idempotent: true });
      await clearWeightPhoto(date);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo borrar la foto.');
    }
  };

  const promptPhoto = (date: string, hasPhoto?: boolean) => {
    const buttons: any[] = [
      { text: 'Cámara',  onPress: () => takePhoto(date) },
      { text: 'Galería', onPress: () => pickPhoto(date) },
    ];
    if (hasPhoto) {
      buttons.push({
        text: 'Borrar foto', style: 'destructive',
        onPress: () => {
          const entry = entries.find(e => e.date === date);
          if (entry?.photo_uri) deletePhoto(date, entry.photo_uri);
        },
      });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Foto de progreso', hasPhoto ? 'Reemplaza o borra la foto:' : 'Elige cómo añadir la foto:', buttons);
  };

  const latest   = entries.length > 0 ? entries[entries.length - 1] : null;
  const prev     = entries.length > 1 ? entries[entries.length - 2] : null;
  const diff     = latest && prev ? (latest.weight_kg - prev.weight_kg) : null;
  const todayEntry = entries.find(e => e.date === today);

  return (
    <SafeAreaView style={s.safe}>
      {/* Fullscreen photo viewer */}
      <Modal visible={fullPhoto !== null} transparent animationType="fade" onRequestClose={() => setFullPhoto(null)}>
        <TouchableOpacity style={s.fullBg} activeOpacity={1} onPress={() => setFullPhoto(null)}>
          {fullPhoto && <Image source={{ uri: fullPhoto }} style={s.fullImg} resizeMode="contain" />}
          <View style={s.fullClose}><Ionicons name="close" size={28} color="#fff" /></View>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.primary} />
          </TouchableOpacity>
          <Text style={s.title}>Peso corporal</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Register today */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.pill, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="scale-outline" size={12} color={C.primary} />
              <Text style={[s.pillTxt, { color: C.primary }]}>Registro de hoy</Text>
            </View>
          </View>
          <View style={s.inputRow}>
            <TextInput
              style={s.weightInput}
              value={input}
              onChangeText={setInput}
              placeholder="75.5"
              placeholderTextColor="#D1D5DB"
              keyboardType="decimal-pad"
            />
            <Text style={s.kgLabel}>kg</Text>
            <TouchableOpacity
              style={[s.saveBtn, (!input.trim() || saving) && { opacity: 0.4 }]}
              onPress={save}
              disabled={!input.trim() || saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnTxt}>Guardar</Text>}
            </TouchableOpacity>
          </View>

          {/* Photo for today */}
          <View style={s.photoRow}>
            {todayEntry?.photo_uri ? (
              <TouchableOpacity onPress={() => setFullPhoto(todayEntry.photo_uri!)} style={s.photoThumbWrap}>
                <Image source={{ uri: todayEntry.photo_uri }} style={s.photoThumb} />
                <TouchableOpacity style={s.photoEditBadge} onPress={() => promptPhoto(today, true)}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.addPhotoBtn, addingPhoto && { opacity: 0.5 }]}
                onPress={() => promptPhoto(today)}
                disabled={addingPhoto}
              >
                {addingPhoto
                  ? <ActivityIndicator size="small" color={C.primary} />
                  : <><Ionicons name="camera-outline" size={16} color={C.primary} /><Text style={s.addPhotoBtnTxt}>Añadir foto de progreso</Text></>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats */}
        {latest && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Último registro</Text>
              <Text style={s.statVal}>{latest.weight_kg} kg</Text>
              <Text style={s.statDate}>{formatDate(latest.date)}</Text>
            </View>
            {diff !== null && (
              <View style={s.statCard}>
                <Text style={s.statLabel}>Variación</Text>
                <Text style={[s.statVal, { color: diff <= 0 ? C.green : '#EF4444' }]}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
                </Text>
                <Text style={s.statDate}>vs día anterior</Text>
              </View>
            )}
            {entries.length >= 2 && (
              <View style={s.statCard}>
                <Text style={s.statLabel}>Rango 30d</Text>
                <Text style={s.statVal}>
                  {Math.min(...entries.map(e => e.weight_kg)).toFixed(1)}–{Math.max(...entries.map(e => e.weight_kg)).toFixed(1)}
                </Text>
                <Text style={s.statDate}>kg</Text>
              </View>
            )}
          </View>
        )}

        {/* Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Evolución (últimos 30 días)</Text>
          <WeightChart entries={entries} />
        </View>

        {/* History list with photo thumbnails */}
        {entries.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Historial</Text>
            {[...entries].reverse().slice(0, 14).map(e => (
              <View key={e.date} style={s.histRow}>
                {e.photo_uri ? (
                  <TouchableOpacity onPress={() => setFullPhoto(e.photo_uri!)} onLongPress={() => promptPhoto(e.date, true)}>
                    <Image source={{ uri: e.photo_uri }} style={s.histThumb} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.histPhotoBtn} onPress={() => promptPhoto(e.date, false)}>
                    <Ionicons name="camera-outline" size={14} color={C.light} />
                  </TouchableOpacity>
                )}
                <Text style={s.histDate}>{formatDate(e.date)}</Text>
                <Text style={[s.histWeight, e.date === today && { color: C.primary, fontWeight: '800' }]}>
                  {e.weight_kg} kg
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1, paddingHorizontal: 16 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 16 },
  backBtn:       { width: 36, height: 36, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  title:         { fontSize: 22, fontWeight: '800', color: C.text },
  card:          { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:    { marginBottom: 12 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
  pill:          { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillTxt:       { fontSize: 12, fontWeight: '600' },
  inputRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weightInput:   { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12, fontSize: 28, fontWeight: '800', color: C.text, textAlign: 'center' },
  kgLabel:       { fontSize: 16, fontWeight: '600', color: C.muted },
  saveBtn:       { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  saveBtnTxt:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  photoRow:      { marginTop: 12 },
  photoThumbWrap:{ position: 'relative', alignSelf: 'flex-start' },
  photoThumb:    { width: 72, height: 72, borderRadius: 12 },
  photoEditBadge:{ position: 'absolute', bottom: 4, right: 4, backgroundColor: C.primary, borderRadius: 10, padding: 3 },
  addPhotoBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  addPhotoBtnTxt:{ fontSize: 13, color: C.primary, fontWeight: '600' },
  statsRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:      { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  statLabel:     { fontSize: 10, color: C.muted, marginBottom: 4 },
  statVal:       { fontSize: 18, fontWeight: '800', color: C.text },
  statDate:      { fontSize: 10, color: C.light, marginTop: 2 },
  histRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  histThumb:     { width: 36, height: 36, borderRadius: 8 },
  histPhotoBtn:  { width: 36, height: 36, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  histDate:      { flex: 1, fontSize: 13, color: C.muted },
  histWeight:    { fontSize: 13, fontWeight: '700', color: C.text },
  fullBg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullImg:       { width: '100%', height: '85%' },
  fullClose:     { position: 'absolute', top: 52, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6 },
});

const ch = StyleSheet.create({
  empty:    { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyTxt: { fontSize: 13, color: C.light, textAlign: 'center' },
});
