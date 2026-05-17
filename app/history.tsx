import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWeeklySummary } from '../lib/database';
import { formatDate } from '../lib/utils';

const C = {
  bg: '#F2F3F7', white: '#FFFFFF', primary: '#3B5BDB',
  green: '#2DC653', orange: '#FF6B35', blue: '#4DABF7',
  text: '#1A1A2E', muted: '#6B7280', border: '#F0F0F5',
};

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function HistoryScreen() {
  const [weekly, setWeekly] = useState<{ date: string; calories: number; calories_burned: number }[]>([]);

  useFocusEffect(useCallback(() => {
    getWeeklySummary().then(setWeekly);
  }, []));

  const today = new Date().toISOString().split('T')[0];

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const found = weekly.find(w => w.date === dateStr);
    const dayOfWeek = d.getDay();
    return {
      date: dateStr,
      label: DAY_NAMES[(dayOfWeek + 6) % 7],
      calories: found?.calories ?? 0,
      burned: found?.calories_burned ?? 0,
    };
  });

  const maxCal = Math.max(...days.map(d => d.calories), 1);
  const totalWeek = days.reduce((s, d) => s + d.calories, 0);
  const activeDays = days.filter(d => d.calories > 0).length;
  const avg = activeDays > 0 ? Math.round(totalWeek / activeDays) : 0;
  const totalBurned = days.reduce((s, d) => s + d.burned, 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <View>
            <Text style={s.title}>Historial</Text>
            <Text style={s.subtitle}>Últimos 7 días</Text>
          </View>
          <TouchableOpacity style={s.calBtn} onPress={() => router.push('/calendar')}>
            <Ionicons name="calendar-outline" size={16} color={C.primary} />
            <Text style={s.calBtnTxt}>Calendario</Text>
          </TouchableOpacity>
        </View>

        {/* Summary stats */}
        <View style={s.statsRow}>
          {[
            { label: 'Esta semana', val: Math.round(totalWeek).toLocaleString('es'), unit: 'kcal', color: C.primary, bg: '#EEF2FF' },
            { label: 'Media diaria', val: avg.toLocaleString('es'), unit: 'kcal', color: C.green, bg: '#F0FDF4' },
            { label: 'Días activos', val: String(activeDays), unit: 'días', color: C.orange, bg: '#FFF7ED' },
          ].map(item => (
            <View key={item.label} style={[s.statCard, { backgroundColor: item.bg }]}>
              <Text style={[s.statNum, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statUnit}>{item.unit}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Bar chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Calorías ingeridas</Text>
          <View style={s.chartArea}>
            {days.map(day => {
              const isToday = day.date === today;
              const h = (day.calories / maxCal) * 100;
              return (
                <View key={day.date} style={s.barCol}>
                  {day.calories > 0 && (
                    <Text style={[s.barVal, isToday && { color: C.primary }]}>
                      {Math.round(day.calories / 100) * 100}
                    </Text>
                  )}
                  <View style={s.barTrack}>
                    <View style={[
                      s.barFill,
                      { height: `${Math.max(h, day.calories > 0 ? 5 : 0)}%` },
                      isToday ? { backgroundColor: C.primary } : { backgroundColor: '#C7D2FE' },
                    ]} />
                  </View>
                  <Text style={[s.barLbl, isToday && { color: C.primary, fontWeight: '700' }]}>{day.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Burned calories */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🔥 Calorías quemadas</Text>
          {days.filter(d => d.burned > 0).length === 0 ? (
            <Text style={s.empty}>No hay ejercicio registrado esta semana</Text>
          ) : (
            <>
              {days.filter(d => d.burned > 0).map(d => (
                <View key={d.date} style={s.burnRow}>
                  <View style={s.burnIcon}>
                    <Text style={{ fontSize: 14 }}>🏃</Text>
                  </View>
                  <Text style={s.burnDate}>{formatDate(d.date)}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={s.burnTrack}>
                      <View style={[s.burnFill, { width: `${Math.min((d.burned / totalBurned) * 100, 100)}%` }]} />
                    </View>
                  </View>
                  <Text style={s.burnVal}>{Math.round(d.burned)} kcal</Text>
                </View>
              ))}
              <View style={s.burnTotalRow}>
                <Text style={s.burnTotalLbl}>Total</Text>
                <Text style={s.burnTotalVal}>{Math.round(totalBurned).toLocaleString('es')} kcal</Text>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  scroll:      { flex: 1, paddingHorizontal: 16 },
  titleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, marginBottom: 20 },
  title:       { fontSize: 32, fontWeight: '800', color: C.text },
  subtitle:    { fontSize: 13, color: C.muted, marginTop: 4 },
  calBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 2 },
  calBtnTxt:   { fontSize: 12, color: C.primary, fontWeight: '700' },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard:    { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statNum:     { fontSize: 20, fontWeight: '800' },
  statUnit:    { fontSize: 10, color: C.muted },
  statLabel:   { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  card:        { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  chartArea:   { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 },
  barCol:      { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barVal:      { fontSize: 9, color: C.muted, marginBottom: 3 },
  barTrack:    { flex: 1, width: '100%', backgroundColor: C.border, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:     { width: '100%', borderRadius: 6 },
  barLbl:      { fontSize: 12, color: C.muted, marginTop: 6 },
  empty:       { color: C.muted, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  burnRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  burnIcon:    { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  burnDate:    { fontSize: 13, color: C.muted, width: 64 },
  burnTrack:   { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  burnFill:    { height: '100%', backgroundColor: C.orange, borderRadius: 3 },
  burnVal:     { fontSize: 13, fontWeight: '700', color: C.orange, width: 70, textAlign: 'right' },
  burnTotalRow:{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  burnTotalLbl:{ fontSize: 13, fontWeight: '600', color: C.text },
  burnTotalVal:{ fontSize: 13, fontWeight: '800', color: C.text },
});
