import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('nutrivoz.db');
    await initDB(db);
  }
  return db;
}

async function initDB(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight_kg REAL NOT NULL,
      photo_uri TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS food_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      description TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      raw_transcript TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      duration_minutes INTEGER,
      calories_burned REAL,
      exercise_type TEXT,
      raw_transcript TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calories REAL DEFAULT 2000,
      protein REAL DEFAULT 150,
      carbs REAL DEFAULT 200,
      fat REAL DEFAULT 65
    );

    INSERT OR IGNORE INTO daily_goals (id, calories, protein, carbs, fat)
    VALUES (1, 2000, 150, 200, 65);
  `);
  // Migrate: add photo_uri column if it doesn't exist yet (safe on existing installs)
  try {
    await db.execAsync(`ALTER TABLE weight_entries ADD COLUMN photo_uri TEXT`);
  } catch {
    // Column already exists — ignore
  }
}

export type FoodEntry = {
  id?: number;
  date: string;
  meal_type: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  raw_transcript?: string;
};

export type ExerciseEntry = {
  id?: number;
  date: string;
  description: string;
  duration_minutes?: number;
  calories_burned?: number;
  exercise_type?: string;
  raw_transcript?: string;
};

export type DailyGoals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export async function insertFoodEntry(entry: FoodEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO food_entries (date, meal_type, description, calories, protein, carbs, fat, raw_transcript)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.date, entry.meal_type, entry.description, entry.calories, entry.protein, entry.carbs, entry.fat, entry.raw_transcript ?? null]
  );
}

export async function insertExerciseEntry(entry: ExerciseEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO exercise_entries (date, description, duration_minutes, calories_burned, exercise_type, raw_transcript)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entry.date, entry.description, entry.duration_minutes ?? null, entry.calories_burned ?? null, entry.exercise_type ?? null, entry.raw_transcript ?? null]
  );
}

export async function getFoodEntriesByDate(date: string): Promise<FoodEntry[]> {
  const db = await getDB();
  return await db.getAllAsync<FoodEntry>(
    `SELECT * FROM food_entries WHERE date = ? ORDER BY created_at ASC`,
    [date]
  );
}

export async function getExerciseEntriesByDate(date: string): Promise<ExerciseEntry[]> {
  const db = await getDB();
  return await db.getAllAsync<ExerciseEntry>(
    `SELECT * FROM exercise_entries WHERE date = ? ORDER BY created_at ASC`,
    [date]
  );
}

export async function deleteFoodEntry(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM food_entries WHERE id = ?`, [id]);
}

export async function deleteExerciseEntry(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM exercise_entries WHERE id = ?`, [id]);
}

export async function updateFoodEntry(entry: FoodEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE food_entries SET meal_type=?, description=?, calories=?, protein=?, carbs=?, fat=? WHERE id=?`,
    [entry.meal_type, entry.description, entry.calories, entry.protein, entry.carbs, entry.fat, entry.id!]
  );
}

export async function updateExerciseEntry(entry: ExerciseEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE exercise_entries SET description=?, duration_minutes=?, calories_burned=?, exercise_type=? WHERE id=?`,
    [entry.description, entry.duration_minutes ?? null, entry.calories_burned ?? null, entry.exercise_type ?? null, entry.id!]
  );
}

export async function getDailyGoals(): Promise<DailyGoals> {
  const db = await getDB();
  const row = await db.getFirstAsync<DailyGoals>(`SELECT calories, protein, carbs, fat FROM daily_goals WHERE id = 1`);
  return row ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 };
}

export async function updateDailyGoals(goals: DailyGoals): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE daily_goals SET calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = 1`,
    [goals.calories, goals.protein, goals.carbs, goals.fat]
  );
}

export async function getWeeklySummary(): Promise<{ date: string; calories: number; calories_burned: number }[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ date: string; calories: number; calories_burned: number }>(`
    SELECT
      d.date,
      COALESCE(f.calories, 0) as calories,
      COALESCE(e.calories_burned, 0) as calories_burned
    FROM (
      SELECT date FROM food_entries WHERE date >= date('now', '-6 days')
      UNION
      SELECT date FROM exercise_entries WHERE date >= date('now', '-6 days')
    ) d
    LEFT JOIN (
      SELECT date, SUM(calories) as calories FROM food_entries GROUP BY date
    ) f ON d.date = f.date
    LEFT JOIN (
      SELECT date, SUM(calories_burned) as calories_burned FROM exercise_entries GROUP BY date
    ) e ON d.date = e.date
    ORDER BY d.date ASC
  `);
  return rows;
}

export type WeightEntry = {
  id?: number;
  date: string;
  weight_kg: number;
  photo_uri?: string | null;
};

export async function insertWeightEntry(entry: WeightEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO weight_entries (date, weight_kg, photo_uri) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, photo_uri = COALESCE(excluded.photo_uri, weight_entries.photo_uri)`,
    [entry.date, entry.weight_kg, entry.photo_uri ?? null]
  );
}

export async function updateWeightPhoto(date: string, photo_uri: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`UPDATE weight_entries SET photo_uri = ? WHERE date = ?`, [photo_uri, date]);
}

export async function getDatesWithData(): Promise<string[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT date FROM food_entries
     UNION SELECT DISTINCT date FROM exercise_entries
     ORDER BY date DESC`
  );
  return rows.map(r => r.date);
}

export async function exportAllData(): Promise<object> {
  const db = await getDB();
  const [foods, exercises, weights, goals] = await Promise.all([
    db.getAllAsync(`SELECT * FROM food_entries ORDER BY date, created_at`),
    db.getAllAsync(`SELECT * FROM exercise_entries ORDER BY date, created_at`),
    db.getAllAsync(`SELECT date, weight_kg FROM weight_entries ORDER BY date`),
    db.getFirstAsync(`SELECT calories, protein, carbs, fat FROM daily_goals WHERE id = 1`),
  ]);
  return {
    exported_at: new Date().toISOString(),
    version: 1,
    daily_goals: goals,
    food_entries: foods,
    exercise_entries: exercises,
    weight_entries: weights,
  };
}

export async function getWeightEntries(days: number = 30): Promise<WeightEntry[]> {
  const db = await getDB();
  return await db.getAllAsync<WeightEntry>(
    `SELECT * FROM weight_entries WHERE date >= date('now', '-' || ? || ' days') ORDER BY date ASC`,
    [days]
  );
}

export async function getTodayWeight(date: string): Promise<WeightEntry | null> {
  const db = await getDB();
  return await db.getFirstAsync<WeightEntry>(
    `SELECT * FROM weight_entries WHERE date = ?`,
    [date]
  ) ?? null;
}

export async function getStreak(): Promise<number> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT date FROM food_entries ORDER BY date DESC`
  );
  if (rows.length === 0) return 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();
  // Allow streak starting from today or yesterday (if today not yet logged)
  const startFrom = rows[0].date === today ? today : yesterday;
  let streak = 0;
  let check = startFrom;
  for (const row of rows) {
    if (row.date === check) {
      streak++;
      const d = new Date(check);
      d.setDate(d.getDate() - 1);
      check = d.toISOString().split('T')[0];
    } else break;
  }
  return streak;
}
