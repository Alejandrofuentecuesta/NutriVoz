import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecordingState } from '../lib/useVoiceRecorder';

type Props = { state: RecordingState; onPressIn: () => void; onPressOut: () => void };

export function VoiceButton({ state, onPressIn, onPressOut }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else { pulse.stopAnimation(); Animated.spring(pulse, { toValue: 1, useNativeDriver: true }).start(); }
  }, [state]);

  return (
    <Animated.View style={[s.wrap, { transform: [{ scale }] }]}>
      {state === 'recording' && (
        <Animated.View style={[s.ring, { transform: [{ scale: pulse }] }]} />
      )}
      <TouchableOpacity
        style={[s.btn, state === 'recording' && s.btnRec, state === 'processing' && s.btnProc]}
        onPressIn={() => { Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start(); onPressIn(); }}
        onPressOut={() => { Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start(); onPressOut(); }}
        disabled={state === 'processing'}
        activeOpacity={1}
      >
        {state === 'processing'
          ? <ActivityIndicator color="#fff" size="large" />
          : <Ionicons name={state === 'recording' ? 'stop' : 'mic'} size={38} color="#fff" />
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap:    { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  ring:    { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 2.5, borderColor: '#A5B4FC', opacity: 0.7 },
  btn:     { width: 76, height: 76, borderRadius: 38, backgroundColor: '#3B5BDB', alignItems: 'center', justifyContent: 'center', shadowColor: '#3B5BDB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  btnRec:  { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  btnProc: { backgroundColor: '#F59E0B', shadowColor: '#F59E0B' },
});
