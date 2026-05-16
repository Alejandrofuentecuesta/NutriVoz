import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParsedEntry } from '../lib/openai';

const C = { white: '#FFFFFF', bg: '#F2F3F7', primary: '#3B5BDB', green: '#2DC653', text: '#1A1A2E', muted: '#6B7280', border: '#F0F0F5' };

type Props = {
  visible: boolean; transcript: string; entry: ParsedEntry | null;
  onConfirm: (e: ParsedEntry) => void; onDiscard: () => void;
};

export function ConfirmModal({ visible, transcript, entry, onConfirm, onDiscard }: Props) {
  const [local, setLocal] = useState<ParsedEntry | null>(null);
  React.useEffect(() => { setLocal(entry); }, [entry]);
  if (!local) return null;

  const upFood = (k: string, v: string) => {
    if (local.type !== 'food') return;
    setLocal({ ...local, data: { ...local.data, [k]: ['description','meal_type'].includes(k) ? v : parseFloat(v)||0 } });
  };
  const upEx = (k: string, v: string) => {
    if (local.type !== 'exercise') return;
    setLocal({ ...local, data: { ...local.data, [k]: ['description','exercise_type'].includes(k) ? v : parseFloat(v)||0 } });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>¿Es correcto?</Text>

          <View style={s.transcriptBox}>
            <Ionicons name="mic-outline" size={14} color={C.muted} />
            <Text style={s.transcriptTxt} numberOfLines={2}>"{transcript}"</Text>
          </View>

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
                <Text style={s.warningTxt}>No se pudo reconocer la entrada. Inténtalo de nuevo con más detalle.</Text>
              </View>
            )}
          </ScrollView>

          <View style={s.btns}>
            <TouchableOpacity style={s.btnDiscard} onPress={onDiscard}>
              <Text style={s.btnDiscardTxt}>Descartar</Text>
            </TouchableOpacity>
            {local.type !== 'unknown' && (
              <TouchableOpacity style={s.btnConfirm} onPress={() => onConfirm(local)}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={s.btnConfirmTxt}>Guardar</Text>
              </TouchableOpacity>
            )}
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
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:         { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: '88%' },
  handle:        { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:         { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 12 },
  transcriptBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.bg, borderRadius: 12, padding: 10, marginBottom: 14 },
  transcriptTxt: { color: C.muted, fontSize: 13, fontStyle: 'italic', flex: 1 },
  row:           { flexDirection: 'row', marginHorizontal: -4 },
  field:         { marginBottom: 10 },
  fieldLbl:      { color: C.muted, fontSize: 11, marginBottom: 4, fontWeight: '600' },
  input:         { backgroundColor: C.bg, color: C.text, borderRadius: 10, padding: 10, fontSize: 14 },
  warningBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginTop: 4 },
  warningTxt:    { color: '#92400E', fontSize: 12, flex: 1 },
  btns:          { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnDiscard:    { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  btnDiscardTxt: { color: C.muted, fontWeight: '600' },
  btnConfirm:    { flex: 2, padding: 14, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnConfirmTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
