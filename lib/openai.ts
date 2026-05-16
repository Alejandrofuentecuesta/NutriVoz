import AsyncStorage from '@react-native-async-storage/async-storage';

async function getApiKey(): Promise<string> {
  const stored = await AsyncStorage.getItem('openai_api_key');
  const key = stored?.trim() || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
  if (!key) throw new Error('API key no configurada. Ve a Ajustes y añade tu key de OpenAI.');
  return key;
}

export type NutritionData = {
  description: string;
  meal_type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
};

export type ExerciseData = {
  description: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
};

export type ParsedEntry =
  | { type: 'food'; data: NutritionData }
  | { type: 'exercise'; data: ExerciseData }
  | { type: 'unknown'; raw: string };

// Step 1: Transcribe audio with Whisper
export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = await getApiKey();
  const formData = new FormData();

  // Read file and append
  formData.append('file', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', 'es');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper error: ${err}`);
  }

  const data = await response.json();
  return data.text as string;
}

// Step 2: Parse the transcript with GPT-4o
export async function parseTranscript(transcript: string): Promise<ParsedEntry> {
  const apiKey = await getApiKey();
  const systemPrompt = `Eres un asistente de nutrición y fitness. El usuario te dirá en lenguaje natural lo que ha comido o qué ejercicio ha hecho.

Tu tarea es extraer la información y responder SOLO con un JSON válido, sin texto adicional, sin markdown, sin backticks.

Si es una COMIDA, responde:
{
  "type": "food",
  "description": "descripción breve",
  "meal_type": "desayuno|almuerzo|comida|merienda|cena|snack",
  "calories": número,
  "protein": gramos,
  "carbs": gramos,
  "fat": gramos,
  "confidence": "high|medium|low"
}

Si es un EJERCICIO, responde:
{
  "type": "exercise",
  "description": "descripción breve",
  "exercise_type": "cardio|fuerza|flexibilidad|deporte|otro",
  "duration_minutes": número,
  "calories_burned": número estimado
}

Si no puedes determinar si es comida o ejercicio:
{
  "type": "unknown",
  "raw": "${transcript}"
}

Para las calorías y macros, usa valores medios realistas para España. Si el usuario menciona una marca o producto específico, estima basándote en productos similares. Sé preciso pero si hay incertidumbre, usa "confidence": "low".`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GPT-4o error: ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content as string;

  try {
    const parsed = JSON.parse(content.trim());
    if (parsed.type === 'food') {
      const { type: _t, ...fields } = parsed;
      return { type: 'food', data: fields } as ParsedEntry;
    } else if (parsed.type === 'exercise') {
      const { type: _t, ...fields } = parsed;
      return { type: 'exercise', data: fields } as ParsedEntry;
    }
    return { type: 'unknown', raw: transcript };
  } catch {
    return { type: 'unknown', raw: transcript };
  }
}

// Combined: transcribe + parse
export async function processVoiceEntry(audioUri: string): Promise<{ transcript: string; entry: ParsedEntry }> {
  const transcript = await transcribeAudio(audioUri);
  const entry = await parseTranscript(transcript);
  return { transcript, entry };
}

// Direct text input (no audio)
export async function processTextEntry(text: string): Promise<ParsedEntry> {
  return await parseTranscript(text);
}
