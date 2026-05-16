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
  notes?: string;
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

  formData.append('file', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', 'es');
  formData.append('prompt', 'Registro de comidas y ejercicio. Pueden mencionarse varias comidas, ingredientes, cantidades, marcas de alimentos o recetas completas.');

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

// Step 2: Parse the transcript with GPT-4o — returns ARRAY of entries
export async function parseTranscript(transcript: string): Promise<ParsedEntry[]> {
  const apiKey = await getApiKey();
  const systemPrompt = `Eres un asistente de nutrición y fitness. El usuario te dirá en lenguaje natural lo que ha comido (puede ser varias comidas del día, una receta completa con ingredientes, o un ejercicio).

Tu tarea es extraer TODAS las entradas mencionadas y responder SOLO con un array JSON válido, sin texto adicional, sin markdown, sin backticks.

Cada elemento del array debe ser uno de estos formatos:

Si es una COMIDA o RECETA:
{
  "type": "food",
  "description": "descripción breve del plato",
  "meal_type": "desayuno|almuerzo|comida|merienda|cena|snack",
  "calories": número,
  "protein": gramos,
  "carbs": gramos,
  "fat": gramos,
  "confidence": "high|medium|low",
  "notes": "explicación del cálculo si es una receta o estimación compleja (opcional)"
}

Si es un EJERCICIO:
{
  "type": "exercise",
  "description": "descripción breve",
  "exercise_type": "cardio|fuerza|flexibilidad|deporte|otro",
  "duration_minutes": número,
  "calories_burned": número estimado
}

Reglas importantes:
- Si el usuario menciona varias comidas distintas (ej: "desayuné X, luego comí Y, y de cena Z"), crea UNA entrada por cada comida.
- Si el usuario describe una RECETA con ingredientes (ej: "hice una tortilla con 3 huevos, 100g de patata y aceite"), crea UNA sola entrada con el total de la receta y explica el cálculo en "notes".
- Si el usuario mezcla comidas y ejercicio, incluye todos en el array.
- Si no puedes determinar nada, devuelve: [{"type": "unknown", "raw": "TEXTO_ORIGINAL"}]
- Usa valores medios realistas para España.
- El campo "notes" es opcional, úsalo cuando calcules macros de recetas o cuando la estimación sea compleja.`;

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
      max_tokens: 1200,
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
    const arr: any[] = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((item): ParsedEntry => {
      if (item.type === 'food') {
        const { type: _t, ...fields } = item;
        return { type: 'food', data: fields as NutritionData };
      } else if (item.type === 'exercise') {
        const { type: _t, ...fields } = item;
        return { type: 'exercise', data: fields as ExerciseData };
      }
      return { type: 'unknown', raw: transcript };
    });
  } catch {
    return [{ type: 'unknown', raw: transcript }];
  }
}

// Combined: transcribe + parse — returns array
export async function processVoiceEntry(audioUri: string): Promise<{ transcript: string; entries: ParsedEntry[] }> {
  const transcript = await transcribeAudio(audioUri);
  const entries = await parseTranscript(transcript);
  return { transcript, entries };
}

// Direct text input (no audio) — returns array
export async function processTextEntry(text: string): Promise<ParsedEntry[]> {
  return await parseTranscript(text);
}

// Legacy single-entry helpers (kept for getSuggestion usage)
export async function parseSingleTranscript(transcript: string): Promise<ParsedEntry> {
  const entries = await parseTranscript(transcript);
  return entries[0] ?? { type: 'unknown', raw: transcript };
}

export type MacroSummary = {
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  goals: { calories: number; protein: number; carbs: number; fat: number };
  burned: number;
};

export async function getSuggestion(summary: MacroSummary): Promise<string> {
  const apiKey = await getApiKey();
  const { consumed, goals, burned } = summary;
  const remaining = {
    calories: Math.max(goals.calories - consumed.calories + burned, 0),
    protein:  Math.max(goals.protein  - consumed.protein,  0),
    carbs:    Math.max(goals.carbs    - consumed.carbs,    0),
    fat:      Math.max(goals.fat      - consumed.fat,      0),
  };

  const prompt = `El usuario lleva hoy:
- Consumidas: ${Math.round(consumed.calories)} kcal, ${Math.round(consumed.protein)}g proteína, ${Math.round(consumed.carbs)}g carbos, ${Math.round(consumed.fat)}g grasa
- Objetivo diario: ${goals.calories} kcal, ${goals.protein}g proteína, ${goals.carbs}g carbos, ${goals.fat}g grasa
- Calorías quemadas por ejercicio: ${Math.round(burned)} kcal
- Restante: ~${Math.round(remaining.calories)} kcal, ${Math.round(remaining.protein)}g proteína, ${Math.round(remaining.carbs)}g carbos, ${Math.round(remaining.fat)}g grasa

Sugiere 1-2 comidas o snacks concretos y realistas para completar los objetivos del día. Sé específico (nombre del plato, cantidad aproximada). Máximo 3 frases, en español, sin introducción.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un nutricionista experto que da sugerencias de comida concisas y realistas para España.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GPT-4o error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}
