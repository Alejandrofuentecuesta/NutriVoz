import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodEntry, ExerciseEntry, updateFoodEntry, updateExerciseEntry } from '../lib/database';

const C = { white: '#FFFFFF', bg: '#F2F3F7', primary: '#3B5BDB', text: '#1A1A2E', muted: '#6B7280', border: '#F0F0F5', red: '#EF4444' };

type EditTarget =
  | { kind: 'food'; entry: FoodEntry }
  | { kind: 'exercise'; entry: ExerciseEntry };

type Props = {
  visible: boolean;
  target: EditTarget | null;
  onSaved: () => void;
  onDiscard: () => void;
};

export function EditEntryModal({ visible, target, onSaved, onDiscard }: Props) {
  const [food, setFood] = useState<FoodEntry | null>(null);
  const [exercise, setExercise] = useState<ExerciseEntry | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'food') { setFood({ ...target.entry }); setExercise(null); }
    else { setExercise({ ...target.entry }); setFood(null); }
  }, [target]);

  if (!target) return null;

  const upF = (k: keyof FoodEntry, v: string) => {
    setFood(prev => prev ? { ...prev, [k]: ['meal_type', 'description'].includes(k) ? v : parseFloat(v) || 0 } : prev);
  };
  const upE = (k: keyof ExerciseEntry, v: string) => {
    setExercise(prev => prev ? { ...prev, [k]: ['description', 'exercise_type'].includes(k) ? v : parseFloat(v) || 0 } : prev);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (food) await updateFoodEntry(food);
      else if (exercise) await updateExerciseEntry(exercise);
      onSaved();
    } catch {
      Alert.alert('Error', 'No se pudo guardar.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>Editar entrada</Text>
            <TouchableOpacity onPress={onDiscard}>
              <Ionicons name="close" size={22} color={C.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {food && (
              <>
                <Field label="Descripción" value={food.description} onChange={v => upF('description', v)} />
                <Field label="Tipo de comida" value={food.meal_type} onChange={v => upF('meal_type', v)} />
                <View style={s.row}>
                  <SmallField label="Calorías" value={String(food.calories)} onChange={v => upF('calories', v)} />
                  <SmallField label="Proteína (g)" value={String(food.protein)} onChange={v => upF('protein', v)} />
                </View>
                <View style={s.row}>
                  <SmallField label="Carbos (g)" value={String(food.carbs)} onChange={v => upF('carbs', v)} />
                  <SmallField label="Grasa (g)" value={String(food.fat)} onChange={v => upF('fat', v)} />
                </View>
              </>
            )}
            {exercise && (
              <>
                <Field label="Ejercicio" value={exercise.description} onChange={v => upE('description', v)} />
                <Field label="Tipo" value={exercise.exercise_type ?? ''} onChange={v => upE('exercise_type', v)} />
                <View style={s.row}>
                  <SmallField label="Duración (min)" value={String(exercise.duration_minutes ?? 0)} onChange={v => upE('duration_minutes', v)} />
                  <SmallField label="Kcal quemadas" value={String(exercise.calories_burned ?? 0)} onChange={v => upE('calories_burned', v)} />
                </View>
              </>
            )}
          </ScrollView>

          <View style={s.btns}>
            <TouchableOpacity style={s.btnCancel} onPress={onDiscard}>
              <Text style={s.btnCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnSave, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={s.btnSaveTxt}>Guardar cambios</Text>
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
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:       { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: '88%' },
  handle:      { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:       { fontSize: 20, fontWeight: '800', color: C.text },
  row:         { flexDirection: 'row', marginHorizontal: -4 },
  field:       { marginBottom: 10 },
  fieldLbl:    { color: C.muted, fontSize: 11, marginBottom: 4, fontWeight: '600' },
  input:       { backgroundColor: C.bg, color: C.text, borderRadius: 10, padding: 10, fontSize: 14 },
  btns:        { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnCancel:   { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  btnCancelTxt:{ color: C.muted, fontWeight: '600' },
  btnSave:     { flex: 2, padding: 14, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnSaveTxt:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});
