import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getFoodEntriesByDate, getExerciseEntriesByDate,
  deleteFoodEntry, deleteExerciseEntry,
  getDatesWithData, FoodEntry, ExerciseEntry
} from '../lib/database';
import { todayISO, formatDate } from '../lib/utils';
import { EditEntryModal } from '../components/EditEntryModal';

const C = {
  bg: '#F2F3F7', white: '#FFFFFF', primary: '#3B5BDB',
  green: '#2DC653', orange: '#FF6B35', text: '#1A1A2E',
  muted: '#6B7280', border: '#F0F0F5', light: '#9CA3AF',
};

const MEAL_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  desayuno:  { icon: 'sunny',      color: '#F59E0B', bg: '#FEF3C7' },
  almuerzo:  { icon: 'cafe',       color: '#8B5CF6', bg: '#EDE9FE' },
  comida:    { icon: 'restaurant', color: '#10B981', bg: '#D1FAE5' },
  merienda:  { icon: 'leaf',       color: '#3B82F6', bg: '#DBEAFE' },
  cena:      { icon: 'moon',       color: '#6366F1', bg: '#E0E7FF' },
  snack:     { icon: 'nutrition',  color: '#EC4899', bg: '#FCE7F3' },
};
const EX_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  cardio:       { icon: 'walk',    color: '#10B981', bg: '#D1FAE5' },
  fuerza:       { icon: 'barbell', color: '#8B5CF6', bg: '#EDE9FE' },
  flexibilidad: { icon: 'body',    color: '#F59E0B', bg: '#FEF3C7' },
  deporte:      { icon: 'football',color: '#3B82F6', bg: '#DBEAFE' },
  otro:         { icon: 'fitness', color: '#EC4899', bg: '#FCE7F3' },
};

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES   = ['L','M','X','J','V','S','D'];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type EditTarget =
  | { kind: 'food'; entry: FoodEntry }
  | { kind: 'exercise'; entry: ExerciseEntry };

export default function CalendarScreen() {
  const today = todayISO();
  const now   = new Date();

  const [year, setYear]           = useState(now.getFullYear());
  const [month, setMonth]         = useState(now.getMonth());
  const [selected, setSelected]   = useState(today);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [foods, setFoods]         = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const loadActiveDates = useCallback(async () => {
    const dates = await getDatesWithData();
    setActiveDates(new Set(dates));
  }, []);

  const loadDay = useCallback(async (date: string) => {
    const [f, e] = await Promise.all([
      getFoodEntriesByDate(date),
      getExerciseEntriesByDate(date),
    ]);
    setFoods(f); setExercises(e);
  }, []);

  useFocusEffect(useCallback(() => {
    loadActiveDates();
    loadDay(selected);
  }, [loadActiveDates, loadDay, selected]));

  const selectDay = (date: string) => {
    setSelected(date);
    loadDay(date);
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const nowM = now.getMonth(), nowY = now.getFullYear();
    if (year === nowY && month === nowM) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset (0=Mon ... 6=Sun)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const totalCal  = foods.reduce((s, f) => s + f.calories, 0);
  const burned    = exercises.reduce((s, e) => s + (e.calories_burned ?? 0), 0);

  const del = (type: 'food' | 'exercise', id: number) =>
    Alert.alert('Eliminar', '¿Eliminar esta entrada?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => {
        type === 'food' ? await deleteFoodEntry(id) : await deleteExerciseEntry(id);
        loadDay(selected);
        loadActiveDates();
      }},
    ]);

  const isCurrentOrPast = (d: string) => d <= today;
  const canGoNext = !(year === now.getFullYear() && month === now.getMonth());

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.primary} />
          </TouchableOpacity>
          <Text style={s.title}>Calendario</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Calendar card */}
        <View style={s.card}>
          {/* Month nav */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={C.primary} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={[s.navBtn, !canGoNext && { opacity: 0.3 }]} disabled={!canGoNext}>
              <Ionicons name="chevron-forward" size={20} color={C.primary} />
            </TouchableOpacity>
          </View>

          {/* Day names */}
          <View style={s.dayNamesRow}>
            {DAY_NAMES.map(d => <Text key={d} style={s.dayName}>{d}</Text>)}
          </View>

          {/* Grid */}
          <View style={s.grid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`e-${idx}`} style={s.cell} />;
              const dateStr = isoDate(year, month, day);
              const isToday    = dateStr === today;
              const isSelected = dateStr === selected;
              const hasData    = activeDates.has(dateStr);
              const isFuture   = dateStr > today;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[s.cell, isSelected && s.cellSelected, isToday && !isSelected && s.cellToday, isFuture && { opacity: 0.3 }]}
                  onPress={() => !isFuture && selectDay(dateStr)}
                  disabled={isFuture}
                  activeOpacity={0.7}
                >
                  <Text style={[s.cellNum, isSelected && s.cellNumSelected, isToday && !isSelected && { color: C.primary }]}>
                    {day}
                  </Text>
                  {hasData && <View style={[s.dot, isSelected && s.dotSelected]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected day detail */}
        <View style={s.dayHeader}>
          <Text style={s.dayTitle}>{formatDate(selected)}</Text>
          {selected === today && <Text style={s.todayBadge}>Hoy</Text>}
        </View>

        {/* Summary row */}
        {(foods.length > 0 || exercises.length > 0) && (
          <View style={s.summaryRow}>
            {foods.length > 0 && (
              <View style={s.summaryChip}>
                <Ionicons name="restaurant-outline" size={13} color={C.green} />
                <Text style={s.summaryTxt}>{Math.round(totalCal)} kcal</Text>
              </View>
            )}
            {exercises.length > 0 && (
              <View style={[s.summaryChip, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="flame-outline" size={13} color={C.orange} />
                <Text style={[s.summaryTxt, { color: C.orange }]}>−{Math.round(burned)} kcal</Text>
              </View>
            )}
          </View>
        )}

        {/* Foods */}
        {foods.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Comidas · {foods.length} entrada{foods.length !== 1 ? 's' : ''}</Text>
            <Text style={s.entryHint}>Toca para editar · Mantén para borrar</Text>
            {foods.map(f => {
              const cfg = MEAL_CFG[f.meal_type] ?? MEAL_CFG.snack;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={s.entryRow}
                  onPress={() => setEditTarget({ kind: 'food', entry: f })}
                  onLongPress={() => del('food', f.id!)}
                >
                  <View style={[s.entryIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryName}>{f.meal_type.charAt(0).toUpperCase() + f.meal_type.slice(1)}</Text>
                    <Text style={s.entryDesc} numberOfLines={1}>{f.description}</Text>
                  </View>
                  <View style={s.macroCol}>
                    <Text style={s.entryKcal}>{Math.round(f.calories)} kcal</Text>
                    <Text style={s.entryMacro}>{Math.round(f.protein)}P · {Math.round(f.carbs)}C · {Math.round(f.fat)}G</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Exercises */}
        {exercises.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Ejercicio</Text>
            <Text style={s.entryHint}>Toca para editar · Mantén para borrar</Text>
            {exercises.map(e => {
              const cfg = EX_CFG[e.exercise_type ?? 'otro'] ?? EX_CFG.otro;
              return (
                <TouchableOpacity
                  key={e.id}
                  style={s.entryRow}
                  onPress={() => setEditTarget({ kind: 'exercise', entry: e })}
                  onLongPress={() => del('exercise', e.id!)}
                >
                  <View style={[s.entryIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryName}>{e.description}</Text>
                    <Text style={s.entryDesc}>{e.duration_minutes} min</Text>
                  </View>
                  <Text style={[s.entryKcal, { color: C.orange }]}>−{Math.round(e.calories_burned ?? 0)} kcal</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {foods.length === 0 && exercises.length === 0 && isCurrentOrPast(selected) && (
          <View style={s.emptyCard}>
            <Ionicons name="calendar-outline" size={36} color={C.light} />
            <Text style={s.emptyTxt}>Sin registros este día</Text>
            {selected === today && (
              <TouchableOpacity style={s.goRegisterBtn} onPress={() => router.push('/register')}>
                <Ionicons name="mic-outline" size={14} color={C.primary} />
                <Text style={s.goRegisterTxt}>Añadir ahora</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <EditEntryModal
        visible={editTarget !== null}
        target={editTarget}
        onSaved={() => { setEditTarget(null); loadDay(selected); loadActiveDates(); }}
        onDiscard={() => setEditTarget(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flex: 1, paddingHorizontal: 16 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 16 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  title:        { fontSize: 22, fontWeight: '800', color: C.text },
  card:         { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  monthNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:       { padding: 6 },
  monthTitle:   { fontSize: 16, fontWeight: '800', color: C.text },
  dayNamesRow:  { flexDirection: 'row', marginBottom: 4 },
  dayName:      { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.muted },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cell:         { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  cellSelected: { backgroundColor: C.primary, borderRadius: 10 },
  cellToday:    { borderRadius: 10, borderWidth: 1.5, borderColor: C.primary },
  cellNum:      { fontSize: 13, fontWeight: '600', color: C.text },
  cellNumSelected:{ color: '#fff', fontWeight: '800' },
  dot:          { width: 4, height: 4, borderRadius: 2, backgroundColor: C.primary, marginTop: 1 },
  dotSelected:  { backgroundColor: 'rgba(255,255,255,0.8)' },
  dayHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  dayTitle:     { fontSize: 16, fontWeight: '700', color: C.text },
  todayBadge:   { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  summaryRow:   { flexDirection: 'row', gap: 8, marginBottom: 10 },
  summaryChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  summaryTxt:   { fontSize: 13, fontWeight: '700', color: C.green },
  entryHint:    { fontSize: 9, color: C.light, marginBottom: 6 },
  entryRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  entryIcon:    { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  entryName:    { fontSize: 11, fontWeight: '600', color: C.text },
  entryDesc:    { fontSize: 10, color: C.muted, marginTop: 1 },
  macroCol:     { alignItems: 'flex-end' },
  entryKcal:    { fontSize: 11, fontWeight: '700', color: C.primary },
  entryMacro:   { fontSize: 9, color: C.muted, marginTop: 1 },
  emptyCard:    { backgroundColor: C.white, borderRadius: 18, padding: 32, alignItems: 'center', gap: 10, marginBottom: 12 },
  emptyTxt:     { fontSize: 14, color: C.light },
  goRegisterBtn:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  goRegisterTxt:{ fontSize: 13, color: C.primary, fontWeight: '600' },
});

