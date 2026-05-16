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
      f.date,
      COALESCE(SUM(f.calories), 0) as calories,
      COALESCE(e.calories_burned, 0) as calories_burned
    FROM food_entries f
    LEFT JOIN (
      SELECT date, SUM(calories_burned) as calories_burned FROM exercise_entries GROUP BY date
    ) e ON f.date = e.date
    WHERE f.date >= date('now', '-6 days')
    GROUP BY f.date
    ORDER BY f.date ASC
  `);
  return rows;
}
