import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

export type RecordingState = 'idle' | 'recording' | 'processing';

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Necesitas dar permiso al micrófono en ajustes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState('recording');
    } catch (e) {
      setError('Error al iniciar la grabación.');
      console.error(e);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;
    try {
      setState('processing');
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      return uri ?? null;
    } catch (e) {
      setError('Error al detener la grabación.');
      setState('idle');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { state, error, startRecording, stopRecording, reset };
}
