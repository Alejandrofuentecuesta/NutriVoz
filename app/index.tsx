import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import {
  getFoodEntriesByDate, getExerciseEntriesByDate, getDailyGoals,
  deleteFoodEntry, deleteExerciseEntry, getStreak,
  getTodayWeight,
  FoodEntry, ExerciseEntry, DailyGoals
} from '../lib/database';
import { todayISO } from '../lib/utils';
import { EditEntryModal } from '../components/EditEntryModal';
import { getSuggestion } from '../lib/openai';

const C = {
  bg: '#F2F3F7',
  white: '#FFFFFF',
  primary: '#3B5BDB',
  green: '#2DC653',
  orange: '#FF6B35',
  blue: '#4DABF7',
  text: '#1A1A2E',
  muted: '#6B7280',
  light: '#9CA3AF',
  border: '#F0F0F5',
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

const RING_SIZE = 72;
const STROKE = 7;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function MacroRing({ val, goal, color, label }: { val: number; goal: number; color: string; label: string }) {
  const pct = Math.min(val / Math.max(goal, 1), 1);
  const dash = pct * CIRCUMFERENCE;
  const gap = CIRCUMFERENCE - dash;
  return (
    <View style={s.macroItem}>
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
          {/* Track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={C.border}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Progress — starts at top (−90°) */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <View style={s.ringInner}>
          <Text style={[s.ringVal, { color }]}>{Math.round(val)}g</Text>
          <Text style={s.ringPct}>{Math.round(pct * 100)}%</Text>
        </View>
      </View>
      <Text style={s.macroLbl}>{label}</Text>
      <Text style={s.macroGoal}>Obj: {goal}g</Text>
    </View>
  );
}

type EditTarget =
  | { kind: 'food'; entry: FoodEntry }
  | { kind: 'exercise'; entry: ExerciseEntry };

export default function HomeScreen() {
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [goals, setGoals] = useState<DailyGoals>({ calories: 2000, protein: 150, carbs: 200, fat: 65 });
  const [streak, setStreak] = useState(0);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [todayWeight, setTodayWeight] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const today = todayISO();

  const load = useCallback(async () => {
    const [f, e, g, str, tw] = await Promise.all([
      getFoodEntriesByDate(today),
      getExerciseEntriesByDate(today),
      getDailyGoals(),
      getStreak(),
      getTodayWeight(today),
    ]);
    setFoods(f); setExercises(e); setGoals(g); setStreak(str);
    setTodayWeight(tw?.weight_kg ?? null);
    setSuggestion(null);
  }, [today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalCal  = foods.reduce((s, f) => s + f.calories, 0);
  const totalProt = foods.reduce((s, f) => s + f.protein, 0);
  const totalCarb = foods.reduce((s, f) => s + f.carbs, 0);
  const totalFat  = foods.reduce((s, f) => s + f.fat, 0);
  const burned    = exercises.reduce((s, e) => s + (e.calories_burned ?? 0), 0);
  const remaining = Math.max(goals.calories - totalCal + burned, 0);
  const calPct    = Math.min(totalCal / goals.calories, 1);
  const burnPct   = Math.min(burned / goals.calories, 1);

  const fetchSuggestion = async () => {
    setLoadingSuggestion(true);
    try {
      const text = await getSuggestion({
        consumed: { calories: totalCal, protein: totalProt, carbs: totalCarb, fat: totalFat },
        goals,
        burned,
      });
      setSuggestion(text);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo obtener sugerencia.');
    } finally { setLoadingSuggestion(false); }
  };

  const del = (type: 'food' | 'exercise', id: number) =>
    Alert.alert('Eliminar', '¿Eliminar esta entrada?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => {
        type === 'food' ? await deleteFoodEntry(id) : await deleteExerciseEntry(id);
        load();
      }},
    ]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Hoy</Text>
            <Text style={s.subtitle}>Seguimiento por voz</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.weightPill} onPress={() => router.push('/weight')}>
              <Ionicons name="scale-outline" size={14} color={C.primary} />
              <Text style={s.weightPillTxt}>
                {todayWeight !== null ? `${todayWeight} kg` : 'Peso'}
              </Text>
            </TouchableOpacity>
            <View style={s.streak}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={s.streakNum}>{streak}</Text>
              <Text style={s.streakLbl}>Racha</Text>
            </View>
          </View>
        </View>

        {/* Voice CTA */}
        <TouchableOpacity style={s.cta} onPress={() => router.push('/register')} activeOpacity={0.88}>
          <View style={s.ctaIcon}><Ionicons name="mic" size={24} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Añadir por voz</Text>
            <Text style={s.ctaSub}>Di lo que has comido o el ejercicio que has hecho</Text>
          </View>
        </TouchableOpacity>

        {/* Calorie card */}
        <View style={s.card}>
          <View style={s.calRow}>
            {[
              { label: 'Consumidas', val: totalCal, color: C.green, icon: 'restaurant', iconBg: '#D1FAE5', iconColor: '#10B981' },
              { label: 'Quemadas',   val: burned,   color: C.orange, icon: 'flame',     iconBg: '#FFEDD5', iconColor: C.orange },
              { label: 'Restantes',  val: remaining, color: C.blue,  icon: 'speedometer',iconBg: '#DBEAFE', iconColor: C.blue },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                {i > 0 && <View style={s.calDiv} />}
                <View style={s.calItem}>
                  <View style={[s.calIconBox, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon as any} size={16} color={item.iconColor} />
                  </View>
                  <Text style={s.calLabel}>{item.label}</Text>
                  <Text style={[s.calNum, { color: item.color }]}>
                    {Math.round(item.val).toLocaleString('es')}
                  </Text>
                  <Text style={s.calUnit}>kcal</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <View style={s.progTrack}>
            <View style={[s.progFill, { flex: calPct, backgroundColor: C.green }]} />
            <View style={[s.progFill, { flex: burnPct, backgroundColor: C.orange }]} />
            <View style={{ flex: Math.max(1 - calPct - burnPct, 0) }} />
          </View>
          <View style={s.progFooter}>
            <Text style={s.progLbl}>Objetivo diario: {goals.calories.toLocaleString('es')} kcal</Text>
            <TouchableOpacity onPress={() => router.push('/settings')}>
              <Ionicons name="pencil-outline" size={14} color={C.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Macros */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Macronutrientes</Text>
            <TouchableOpacity style={s.linkRow} onPress={() => router.push('/history')}>
              <Text style={s.linkTxt}>Más detalles</Text>
              <Ionicons name="chevron-forward" size={13} color={C.primary} />
            </TouchableOpacity>
          </View>
          <View style={s.macroGrid}>
            <MacroRing val={totalProt} goal={goals.protein} color={C.green}  label="Proteínas" />
            <MacroRing val={totalCarb} goal={goals.carbs}   color={C.blue}   label="Carbohidratos" />
            <MacroRing val={totalFat}  goal={goals.fat}     color={C.orange} label="Grasas" />
          </View>
        </View>

        {/* AI Suggestion */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Sugerencia IA</Text>
            <TouchableOpacity
              style={s.suggestBtn}
              onPress={fetchSuggestion}
              disabled={loadingSuggestion}
            >
              {loadingSuggestion
                ? <ActivityIndicator size="small" color={C.primary} />
                : <><Ionicons name="sparkles-outline" size={14} color={C.primary} /><Text style={s.suggestBtnTxt}>Sugerir</Text></>
              }
            </TouchableOpacity>
          </View>
          {suggestion
            ? <Text style={s.suggestionTxt}>{suggestion}</Text>
            : <Text style={s.suggestionHint}>Pulsa "Sugerir" para que la IA te recomiende qué comer para completar tus macros de hoy.</Text>
          }
        </View>

        {/* Foods + Exercise */}
        <View style={s.splitRow}>
          <View style={[s.card, { flex: 1, marginRight: 5 }]}>
            <Text style={s.cardTitle}>Comidas de hoy</Text>
            <Text style={s.entryHint}>Toca para editar · Mantén para borrar</Text>
            {foods.length === 0 && <Text style={s.empty}>Sin registros</Text>}
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
                  <Text style={s.entryKcal}>{Math.round(f.calories)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[s.card, { flex: 1, marginLeft: 5 }]}>
            <View style={s.rowBetween}>
              <Text style={s.cardTitle}>Ejercicio</Text>
              <TouchableOpacity style={s.linkRow} onPress={() => router.push('/history')}>
                <Text style={s.linkTxt}>Ver todas</Text>
                <Ionicons name="chevron-forward" size={13} color={C.primary} />
              </TouchableOpacity>
            </View>
            <Text style={s.entryHint}>Toca para editar · Mantén para borrar</Text>
            {exercises.length === 0 && <Text style={s.empty}>Sin registros</Text>}
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
                  <Text style={[s.entryKcal, { color: C.orange }]}>-{Math.round(e.calories_burned ?? 0)}</Text>
                </TouchableOpacity>
              );
            })}
            {burned > 0 && (
              <View style={s.burnTotal}>
                <Text style={s.burnLbl}>Total quemadas</Text>
                <Text style={s.burnVal}>{Math.round(burned)} kcal 🔥</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <EditEntryModal
        visible={editTarget !== null}
        target={editTarget}
        onSaved={() => { setEditTarget(null); load(); }}
        onDiscard={() => setEditTarget(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  scroll:         { flex: 1, paddingHorizontal: 16 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 16, paddingBottom: 16 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:          { fontSize: 32, fontWeight: '800', color: C.text },
  subtitle:       { fontSize: 13, color: C.muted, marginTop: 2 },
  weightPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  weightPillTxt:  { fontSize: 12, fontWeight: '700', color: C.primary },
  streak:         { alignItems: 'center', backgroundColor: C.white, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  streakNum:      { fontSize: 18, fontWeight: '800', color: C.text },
  streakLbl:      { fontSize: 10, color: C.muted },
  suggestBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  suggestBtnTxt:  { fontSize: 12, color: C.primary, fontWeight: '600' },
  suggestionTxt:  { fontSize: 13, color: C.text, lineHeight: 19 },
  suggestionHint: { fontSize: 12, color: C.light, lineHeight: 17 },
  cta:        { backgroundColor: C.primary, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  ctaIcon:    { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle:   { color: '#fff', fontSize: 17, fontWeight: '700' },
  ctaSub:     { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, lineHeight: 16 },
  card:       { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  calRow:     { flexDirection: 'row', marginBottom: 14 },
  calItem:    { flex: 1, alignItems: 'center', gap: 2 },
  calIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  calLabel:   { fontSize: 10, color: C.muted },
  calNum:     { fontSize: 22, fontWeight: '800' },
  calUnit:    { fontSize: 10, color: C.muted },
  calDiv:     { width: 1, backgroundColor: C.border, marginVertical: 6 },
  progTrack:  { height: 8, backgroundColor: C.border, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', marginBottom: 8 },
  progFill:   { borderRadius: 4 },
  progFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progLbl:    { fontSize: 12, color: C.muted },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  linkRow:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkTxt:    { fontSize: 12, color: C.primary },
  macroGrid:  { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 },
  macroItem:  { alignItems: 'center', gap: 4 },
  ringInner:  { alignItems: 'center' },
  ringVal:    { fontSize: 13, fontWeight: '800' },
  ringPct:    { fontSize: 10, color: C.muted },
  macroLbl:   { fontSize: 11, fontWeight: '600', color: C.text },
  macroGoal:  { fontSize: 10, color: C.muted },
  splitRow:   { flexDirection: 'row' },
  entryHint:  { fontSize: 9, color: C.light, marginBottom: 6 },
  entryRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  entryIcon:  { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  entryName:  { fontSize: 11, fontWeight: '600', color: C.text },
  entryDesc:  { fontSize: 10, color: C.muted, marginTop: 1 },
  entryKcal:  { fontSize: 11, fontWeight: '700', color: C.primary },
  empty:      { fontSize: 12, color: C.light, textAlign: 'center', paddingVertical: 10 },
  burnTotal:  { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  burnLbl:    { fontSize: 10, color: C.muted },
  burnVal:    { fontSize: 13, fontWeight: '700', color: C.text },
});
