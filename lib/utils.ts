export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function mealTypeLabel(type: string): string {
  const map: Record<string, string> = {
    desayuno: '🌅 Desayuno',
    almuerzo: '🥐 Almuerzo',
    comida: '🍽️ Comida',
    merienda: '🫖 Merienda',
    cena: '🌙 Cena',
    snack: '🍎 Snack',
  };
  return map[type] ?? type;
}

export function exerciseTypeLabel(type: string): string {
  const map: Record<string, string> = {
    cardio: '🏃 Cardio',
    fuerza: '💪 Fuerza',
    flexibilidad: '🧘 Flexibilidad',
    deporte: '⚽ Deporte',
    otro: '🏋️ Ejercicio',
  };
  return map[type] ?? type;
}

export function macroColor(macro: 'protein' | 'carbs' | 'fat'): string {
  return { protein: '#4ade80', carbs: '#60a5fa', fat: '#f97316' }[macro];
}
