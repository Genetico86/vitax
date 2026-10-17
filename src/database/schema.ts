export const CREATE_TABLES_SQL = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_muscle TEXT NOT NULL,
    equipment_needed TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    difficulty_level TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS program_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    program_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    default_sets INTEGER NOT NULL DEFAULT 3,
    default_reps INTEGER NOT NULL DEFAULT 10,
    rest_time_seconds INTEGER NOT NULL DEFAULT 90,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    program_id TEXT,
    program_name TEXT,
    date TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    total_volume REAL NOT NULL DEFAULT 0,
    total_sets INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY NOT NULL,
    workout_session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    set_order INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT,
    FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
  );

  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS body_weights (
    id TEXT PRIMARY KEY NOT NULL,
    weight REAL NOT NULL,
    date TEXT NOT NULL,
    note TEXT,
    body_fat_percentage REAL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fitness_goals (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    target_value REAL NOT NULL,
    starting_value REAL NOT NULL,
    current_value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    target_date TEXT,
    exercise_id TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS running_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    distance_km REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    pace_seconds_per_km REAL NOT NULL,
    notes TEXT,
    calories INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exercise_favorites (
    exercise_id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(date DESC);
  CREATE INDEX IF NOT EXISTS idx_workout_sets_session ON workout_sets(workout_session_id, set_order ASC);
  CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(exercise_id);
  CREATE INDEX IF NOT EXISTS idx_workout_sets_ex_completed ON workout_sets(exercise_id, completed, workout_session_id, set_order DESC);
  CREATE INDEX IF NOT EXISTS idx_exercises_muscle_name ON exercises(target_muscle, name ASC);
  CREATE INDEX IF NOT EXISTS idx_programs_custom_name ON programs(is_custom DESC, name ASC);
  CREATE INDEX IF NOT EXISTS idx_program_exercises_prog ON program_exercises(program_id, order_index ASC);
  CREATE INDEX IF NOT EXISTS idx_body_weights_date ON body_weights(date DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fitness_goals_category ON fitness_goals(category, completed ASC, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_running_sessions_date ON running_sessions(date DESC, created_at DESC);
`;

