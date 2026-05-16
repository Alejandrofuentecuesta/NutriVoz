import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParsedEntry } from '../lib/openai';

const C = { white: '#FFFFFF', bg: '#F2F3F7', primary: '#3B5BDB', green: '#2DC653', text: '#1A1A2E', muted: '#6B7280', border: '#F0F0F5' };

type Props = {
  visible: boolean;
  transcript: string;
  entries: ParsedEntry[];
  onConfirmAll: (entries: ParsedEntry[]) => void;
  onDiscard: () => void;
};

export function ConfirmModal({ visible, transcript, entries, onConfirmAll, onDiscard }: Props) {
  const [locals, setLocals] = useState<ParsedEntry[]>([]);
  const [current, setCurrent] = useState(0);

  React.useEffect(() => {
    setLocals(entries.map(e => ({ ...e })));
    setCurrent(0);
  }, [entries]);

  if (locals.length === 0) return null;

  const safeIdx = Math.min(current, locals.length - 1);
  const local = locals[safeIdx];
  if (!local) return null;
  const total = locals.length;

  const upFood = (k: string, v: string) => {
    if (local.type !== 'food') return;
    const updated = { ...local, data: { ...local.data, [k]: ['description', 'meal_type', 'notes'].includes(k) ? v : parseFloat(v) || 0 } };
    setLocals(prev => prev.map((e, i) => i === safeIdx ? updated : e));
  };

  const upEx = (k: string, v: string) => {
    if (local.type !== 'exercise') return;
    const updated = { ...local, data: { ...local.data, [k]: ['description', 'exercise_type'].includes(k) ? v : parseFloat(v) || 0 } };
    setLocals(prev => prev.map((e, i) => i === safeIdx ? updated : e));
  };

  const removeEntry = () => {
    const next = locals.filter((_, i) => i !== safeIdx);
    if (next.length === 0) { onDiscard(); return; }
    setLocals(next);
    setCurrent(Math.min(current, next.length - 1));
  };

  const isLast = current === total - 1;
  const validEntries = locals.filter(e => e.type !== 'unknown');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header with pagination */}
          <View style={s.headerRow}>
            <Text style={s.title}>¿Es correcto?</Text>
            {total > 1 && (
              <View style={s.pagination}>
                <TouchableOpacity onPress={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                  <Ionicons name="chevron-back" size={20} color={current === 0 ? C.border : C.primary} />
                </TouchableOpacity>
                <Text style={s.pageNum}>{current + 1} / {total}</Text>
                <TouchableOpacity onPress={() => setCurrent(c => Math.min(total - 1, c + 1))} disabled={isLast}>
                  <Ionicons name="chevron-forward" size={20} color={isLast ? C.border : C.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Transcript */}
          <View style={s.transcriptBox}>
            <Ionicons name="mic-outline" size={14} color={C.muted} />
            <Text style={s.transcriptTxt} numberOfLines={2}>"{transcript}"</Text>
          </View>

          {/* Multi-entry pills */}
          {total > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll}>
              {locals.map((e, i) => {
                const label = e.type === 'food' ? e.data.description : e.type === 'exercise' ? e.data.description : '?';
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.entryPill, i === current && s.entryPillActive]}
                    onPress={() => setCurrent(i)}
                  >
                    <Text style={[s.entryPillTxt, i === current && s.entryPillTxtActive]} numberOfLines={1}>
                      {e.type === 'food' ? '🍽' : e.type === 'exercise' ? '🏃' : '?'} {label.length > 16 ? label.slice(0, 16) + '…' : label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
            {local.type === 'food' && (
              <>
                <Field label="Descripción" value={local.data.description} onChange={v => upFood('description', v)} />
                <Field label="Tipo de comida" value={local.data.meal_type} onChange={v => upFood('meal_type', v)} />
                <View style={s.row}>
                  <SmallField label="Calorías" value={String(local.data.calories)} onChange={v => upFood('calories', v)} />
                  <SmallField label="Proteína (g)" value={String(local.data.protein)} onChange={v => upFood('protein', v)} />
                </View>
                <View style={s.row}>
                  <SmallField label="Carbos (g)" value={String(local.data.carbs)} onChange={v => upFood('carbs', v)} />
                  <SmallField label="Grasa (g)" value={String(local.data.fat)} onChange={v => upFood('fat', v)} />
                </View>
                {local.data.notes ? (
                  <View style={s.notesBox}>
                    <Ionicons name="calculator-outline" size={14} color="#1E40AF" />
                    <Text style={s.notesTxt}>{local.data.notes}</Text>
                  </View>
                ) : null}
                {local.data.confidence === 'low' && (
                  <View style={s.warningBox}>
                    <Ionicons name="warning-outline" size={14} color="#92400E" />
                    <Text style={s.warningTxt}>Estimación poco precisa — revisa los valores antes de guardar</Text>
                  </View>
                )}
              </>
            )}
            {local.type === 'exercise' && (
              <>
                <Field label="Ejercicio" value={local.data.description} onChange={v => upEx('description', v)} />
                <View style={s.row}>
                  <SmallField label="Duración (min)" value={String(local.data.duration_minutes)} onChange={v => upEx('duration_minutes', v)} />
                  <SmallField label="Kcal quemadas" value={String(local.data.calories_burned)} onChange={v => upEx('calories_burned', v)} />
                </View>
              </>
            )}
            {local.type === 'unknown' && (
              <View style={s.warningBox}>
                <Ionicons name="help-circle-outline" size={16} color="#92400E" />
                <Text style={s.warningTxt}>No se pudo reconocer esta entrada. Inténtalo de nuevo con más detalle.</Text>
              </View>
            )}
          </ScrollView>

          {/* Buttons */}
          <View style={s.btns}>
            <TouchableOpacity style={s.btnDiscard} onPress={total > 1 ? removeEntry : onDiscard}>
              <Ionicons name={total > 1 ? 'trash-outline' : 'close-outline'} size={16} color={C.muted} />
              <Text style={s.btnDiscardTxt}>{total > 1 ? 'Quitar' : 'Descartar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnConfirm, validEntries.length === 0 && { opacity: 0.4 }]}
              onPress={() => onConfirmAll(validEntries)}
              disabled={validEntries.length === 0}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={s.btnConfirmTxt}>
                {total > 1 ? `Guardar ${validEntries.length} entrada${validEntries.length !== 1 ? 's' : ''}` : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLbl}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} placeholderTextColor="#D1D5DB" />
    </View>
  );
}

function SmallField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={[s.field, { flex: 1, marginHorizontal: 4 }]}>
      <Text style={s.fieldLbl}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} keyboardType="numeric" placeholderTextColor="#D1D5DB" />
    </View>
  );
}

const s = StyleSheet.create({
  overlay:          { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:            { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: '92%' },
  handle:           { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:            { fontSize: 20, fontWeight: '800', color: C.text },
  pagination:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageNum:          { fontSize: 13, fontWeight: '600', color: C.muted },
  transcriptBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.bg, borderRadius: 12, padding: 10, marginBottom: 10 },
  transcriptTxt:    { color: C.muted, fontSize: 13, fontStyle: 'italic', flex: 1 },
  pillsScroll:      { marginBottom: 10, flexGrow: 0 },
  entryPill:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.bg, marginRight: 8, borderWidth: 1, borderColor: C.border },
  entryPillActive:  { backgroundColor: C.primary, borderColor: C.primary },
  entryPillTxt:     { fontSize: 12, color: C.muted, fontWeight: '600' },
  entryPillTxtActive: { color: '#fff' },
  row:              { flexDirection: 'row', marginHorizontal: -4 },
  field:            { marginBottom: 10 },
  fieldLbl:         { color: C.muted, fontSize: 11, marginBottom: 4, fontWeight: '600' },
  input:            { backgroundColor: C.bg, color: C.text, borderRadius: 10, padding: 10, fontSize: 14 },
  notesBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#DBEAFE', borderRadius: 10, padding: 10, marginTop: 4, marginBottom: 6 },
  notesTxt:         { color: '#1E40AF', fontSize: 12, flex: 1, lineHeight: 17 },
  warningBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginTop: 4 },
  warningTxt:       { color: '#92400E', fontSize: 12, flex: 1 },
  btns:             { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnDiscard:       { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnDiscardTxt:    { color: C.muted, fontWeight: '600' },
  btnConfirm:       { flex: 2, padding: 14, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnConfirmTxt:    { color: '#fff', fontWeight: '700', fontSize: 15 },
});
