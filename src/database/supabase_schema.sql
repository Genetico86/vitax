-- =========================================================================
-- VITAX - BASE DE DONNÉES CENTRALE PARTAGÉE & SYNCHRONISATION CLOUD SUPABASE
-- =========================================================================
-- Exécutez ce script dans le SQL Editor de votre projet Supabase.
-- Il configure les profils, les séances, les séries, les favoris, les poids,
-- les classements et autorise la synchronisation 24h/24 sans blocage.
-- =========================================================================

-- 1. TABLE DES PROFILS UTILISATEURS / ATHLÈTES (MOTS DE PASSE VISIBLES EN CLAIR POUR L'ADMIN)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT,
  friend_code TEXT NOT NULL UNIQUE,
  trainer_title TEXT DEFAULT 'Athlète Débutant',
  avatar_pokemon_id TEXT DEFAULT 'pikachu',
  avatar_pokemon_emoji TEXT DEFAULT '⚡',
  current_league TEXT DEFAULT 'pierre',
  total_xp INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assurer que la colonne password et avatar_url existent si la table a déjà été créée
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- UNICITÉ STRICTE DES PSEUDOS (insensible à la casse : impossible d'avoir des doublons 'Matthieu' et 'matthieu')
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique_lower ON public.profiles (LOWER(TRIM(username)));
CREATE INDEX IF NOT EXISTS idx_profiles_friend_code ON public.profiles(friend_code);

-- 2. TABLE DES SÉANCES D'ENTRAÎNEMENT (HISTORIQUE SYNCHRONISÉ)
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id TEXT,
  program_name TEXT NOT NULL,
  date TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  notes TEXT,
  total_volume REAL DEFAULT 0,
  total_sets INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON public.workout_sessions(user_id, date DESC);

-- 3. TABLE DES SÉRIES D'EXERCICES DÉTAILLÉES
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id TEXT PRIMARY KEY,
  workout_session_id TEXT NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  set_order INTEGER NOT NULL,
  weight REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_session ON public.workout_sets(workout_session_id, set_order ASC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON public.workout_sets(exercise_id);

-- 4. TABLE DES EXERCICES FAVORIS PAR UTILISATEUR
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id TEXT PRIMARY KEY, -- "userId_exerciseId"
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);

-- 5. TABLE DU SUIVI DU POIDS (ALIGNÉE AVEC SQLITE)
CREATE TABLE IF NOT EXISTS public.body_weights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  notes TEXT,
  body_fat_percentage REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.body_weights ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.body_weights ADD COLUMN IF NOT EXISTS body_fat_percentage REAL;

CREATE INDEX IF NOT EXISTS idx_body_weights_user ON public.body_weights(user_id, date DESC);

-- 6. TABLE DES OBJECTIFS FITNESS (ALIGNÉE AVEC SQLITE)
CREATE TABLE IF NOT EXISTS public.fitness_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  category TEXT,
  type TEXT NOT NULL,
  target_value REAL NOT NULL,
  starting_value REAL DEFAULT 0,
  current_value REAL DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  target_date TEXT,
  deadline TEXT,
  exercise_id TEXT,
  completed INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fitness_goals ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.fitness_goals ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.fitness_goals ADD COLUMN IF NOT EXISTS starting_value REAL DEFAULT 0;
ALTER TABLE public.fitness_goals ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kg';
ALTER TABLE public.fitness_goals ADD COLUMN IF NOT EXISTS target_date TEXT;
ALTER TABLE public.fitness_goals ADD COLUMN IF NOT EXISTS exercise_id TEXT;
ALTER TABLE public.fitness_goals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fitness_goals_user ON public.fitness_goals(user_id);

-- 6b. TABLE DES SESSIONS DE COURSE & MARCHE (CARDIO)
CREATE TABLE IF NOT EXISTS public.running_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  distance_km REAL NOT NULL,
  duration_seconds INTEGER NOT NULL,
  pace_seconds_per_km REAL NOT NULL,
  notes TEXT,
  calories INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_running_sessions_user_date ON public.running_sessions(user_id, date DESC);

-- Suppression de l'ancienne table pokemon_eggs si elle existait
DROP TABLE IF EXISTS public.pokemon_eggs CASCADE;

-- 7. TABLE DES CLASSEMENTS HEBDOMADAIRES
CREATE TABLE IF NOT EXISTS public.weekly_leaderboards (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  trainer_title TEXT,
  avatar_pokemon_emoji TEXT DEFAULT '⚡',
  current_league TEXT DEFAULT 'pierre',
  weekly_xp INTEGER DEFAULT 0,
  total_tonnage_kg INTEGER DEFAULT 0,
  cardio_minutes INTEGER DEFAULT 0,
  workouts_count INTEGER DEFAULT 0,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assurer que la colonne avatar_url existe si la table a déjà été créée
ALTER TABLE public.weekly_leaderboards ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_leaderboards_week_league ON public.weekly_leaderboards(week_id, current_league, weekly_xp DESC);

-- 8. TABLE DES AMIS
CREATE TABLE IF NOT EXISTS public.friends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);

-- 9. TABLE DE STOCKAGE SYSTÈME CLOUD BACKUP (RÉGLAGES, CATALOGUE PERSO, BROUILLONS)
CREATE TABLE IF NOT EXISTS public.trades (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_code TEXT NOT NULL,
  offered_pokemon JSONB NOT NULL,
  requested_criteria_text TEXT,
  requested_species_id TEXT,
  friends_only BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'cloud_backup',
  receiver_id TEXT,
  receiver_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Purger les anciennes offres d'échanges Pokémon et inventaires d'œufs
DELETE FROM public.trades WHERE status != 'cloud_backup' OR id LIKE 'pokemon_inventory_%';

CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status, created_at DESC);

-- 10. TABLE DES DÉFIS D'ÉQUIPE CO-OP
CREATE TABLE IF NOT EXISTS public.raid_contributions (
  id TEXT PRIMARY KEY,
  raid_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_pokemon_emoji TEXT DEFAULT '⚡',
  contribution_value INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raid_contributions_raid ON public.raid_contributions(raid_id);

-- 11. TABLE DES DEMANDES D'INVITATIONS D'AMIS
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_code TEXT NOT NULL,
  sender_avatar TEXT DEFAULT '⚡',
  sender_title TEXT,
  receiver_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);

-- 12. TABLE DES CADEAUX DE MOTIVATION ENTRE AMIS
CREATE TABLE IF NOT EXISTS public.friend_gifts (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT DEFAULT '⚡',
  receiver_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_name TEXT NOT NULL,
  receiver_code TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  target_xp_gain INTEGER NOT NULL DEFAULT 500,
  start_xp INTEGER NOT NULL DEFAULT 0,
  current_progress_xp INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'unlocked', 'claimed'
  personal_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unlocked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_friend_gifts_receiver ON public.friend_gifts(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_gifts_sender ON public.friend_gifts(sender_id);

-- 13. TABLE DES DÉFIS ENTRE AMIS
CREATE TABLE IF NOT EXISTS public.friend_challenges (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL,
  creator_avatar TEXT DEFAULT '⚡',
  target_friend_code TEXT NOT NULL DEFAULT 'all',
  target_friend_name TEXT,
  challenge_type TEXT DEFAULT 'exercise',
  title TEXT NOT NULL,
  exercise_id TEXT,
  exercise_name TEXT,
  program_id TEXT,
  program_name TEXT,
  target_weight REAL,
  target_reps INTEGER,
  target_duration_seconds INTEGER,
  target_volume_kg REAL,
  instructions TEXT,
  reward_xp INTEGER DEFAULT 150,
  status TEXT DEFAULT 'active',
  winner_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_challenges_target ON public.friend_challenges(target_friend_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_creator ON public.friend_challenges(creator_id);

-- =========================================================================
-- SÉCURITÉ & PERMISSIONS POUR LA SYNCHRONISATION DE TOUS LES APPAREILS
-- =========================================================================

-- 1. DÉSACTIVER LE ROW LEVEL SECURITY SUR TOUTES LES TABLES VITAX
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_favorites DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.body_weights DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fitness_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.running_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_leaderboards DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friends DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.raid_contributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friend_gifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friend_challenges DISABLE ROW LEVEL SECURITY;

-- 2. AJOUTER DES POLITIQUES PERMISSIVES UNIVERSELLES
-- (Garantit que même si Supabase réactive automatiquement le RLS,
-- l'application client avec clé anon ne sera JAMAIS bloquée en lecture ou écriture)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles',
    'workout_sessions',
    'workout_sets',
    'user_favorites',
    'body_weights',
    'fitness_goals',
    'running_sessions',
    'weekly_leaderboards',
    'friends',
    'trades',
    'raid_contributions',
    'friend_requests',
    'friend_gifts',
    'friend_challenges'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "vitax_universal_access" ON public.%I', t);
      EXECUTE format('CREATE POLICY "vitax_universal_access" ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- 3. PERMISSIONS GLOBALES POUR LES RÔLES CLIENTS (ANON, AUTHENTICATED)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;


