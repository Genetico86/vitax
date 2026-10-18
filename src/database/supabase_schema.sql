-- =========================================================================
-- VITAX - BASE DE DONNÉES CENTRALE PARTAGÉE & SYNCHRONISATION CLOUD SUPABASE
-- =========================================================================
-- Exécutez ce script dans le SQL Editor de votre projet Supabase.
-- Il configure les tables, le chiffrement des mots de passe (pgcrypto / PBKDF2),
-- les fonctions RPC d'authentification (SECURITY DEFINER) et le Row Level Security (RLS).
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLE DES PROFILS UTILISATEURS / ATHLÈTES (CONDENSATS HACHÉS UNIQUEMENT)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT,
  password_hash TEXT,
  friend_code TEXT NOT NULL UNIQUE,
  trainer_title TEXT DEFAULT 'Athlète Débutant',
  avatar_pokemon_id TEXT DEFAULT 'athlete',
  avatar_pokemon_emoji TEXT DEFAULT '⚡',
  current_league TEXT DEFAULT 'pierre',
  total_xp INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assurer que les colonnes password_hash et avatar_url existent
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Migration automatique des anciens mots de passe en clair vers pgcrypto (bcrypt) et purge du clair
UPDATE public.profiles
SET
  password_hash = CASE
    WHEN password LIKE 'pbkdf2_sha256$%' OR password LIKE '$2%' THEN password
    ELSE crypt(password, gen_salt('bf'))
  END,
  password = NULL
WHERE password IS NOT NULL AND password_hash IS NULL;

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
-- FONCTIONS D'AUTHENTIFICATION SÉCURISÉE & CONTEXTE UTILISATEUR RLS
-- =========================================================================

-- Extrait l'identifiant d'athlète authentifié depuis le JWT Supabase Auth ou l'en-tête x-client-info
CREATE OR REPLACE FUNCTION public.current_vitax_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_client_info TEXT;
  v_extracted_uid TEXT;
  v_jwt_uid TEXT;
BEGIN
  BEGIN
    v_jwt_uid := current_setting('request.jwt.claims', true)::json->'user_metadata'->>'vitax_user_id';
  EXCEPTION WHEN OTHERS THEN
    v_jwt_uid := NULL;
  END;

  IF v_jwt_uid IS NOT NULL AND v_jwt_uid <> '' THEN
    RETURN v_jwt_uid;
  END IF;

  BEGIN
    v_client_info := current_setting('request.headers', true)::json->>'x-client-info';
    IF v_client_info IS NOT NULL THEN
      v_extracted_uid := substring(v_client_info FROM 'uid=([A-Za-z0-9_-]{1,64})');
      IF v_extracted_uid IS NOT NULL AND v_extracted_uid <> '' THEN
        RETURN v_extracted_uid;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN auth.uid()::text;
END;
$$;

-- Inscription sécurisée côté serveur (SECURITY DEFINER : hache le secret PBKDF2 avec bcrypt pgcrypto)
CREATE OR REPLACE FUNCTION public.register_trainer_secure(
  p_id TEXT,
  p_username TEXT,
  p_password_hash TEXT,
  p_friend_code TEXT,
  p_trainer_title TEXT DEFAULT 'Athlète Vitax',
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(TRIM(username)) = LOWER(TRIM(p_username))
  ) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  INSERT INTO public.profiles (
    id,
    username,
    password,
    password_hash,
    friend_code,
    trainer_title,
    avatar_pokemon_id,
    avatar_pokemon_emoji,
    current_league,
    total_xp,
    total_workouts,
    avatar_url,
    created_at,
    updated_at
  ) VALUES (
    p_id,
    TRIM(p_username),
    NULL,
    crypt(p_password_hash, gen_salt('bf')),
    p_friend_code,
    COALESCE(p_trainer_title, 'Athlète Vitax'),
    'athlete',
    '⚡',
    'pierre',
    0,
    0,
    p_avatar_url,
    NOW(),
    NOW()
  );
END;
$$;

-- Authentification sécurisée côté serveur (vérifie le hash sans jamais exposer password/password_hash au client)
CREATE OR REPLACE FUNCTION public.authenticate_trainer_secure(
  p_username TEXT,
  p_password_hash TEXT,
  p_legacy_plaintext TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  username TEXT,
  friend_code TEXT,
  trainer_title TEXT,
  avatar_pokemon_id TEXT,
  avatar_pokemon_emoji TEXT,
  current_league TEXT,
  total_xp INTEGER,
  total_workouts INTEGER,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
  v_secret TEXT;
  v_valid BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_row
  FROM public.profiles p
  WHERE LOWER(TRIM(p.username)) = LOWER(TRIM(p_username))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_secret := COALESCE(v_row.password_hash, v_row.password);

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'PASSWORD_RESET_REQUIRED';
  END IF;

  IF v_secret LIKE '$2%' THEN
    v_valid := (v_secret = crypt(p_password_hash, v_secret))
      OR (p_legacy_plaintext IS NOT NULL AND v_secret = crypt(p_legacy_plaintext, v_secret));
  ELSIF v_secret LIKE 'pbkdf2_sha256$%' THEN
    v_valid := (v_secret = p_password_hash);
  ELSE
    v_valid := (p_legacy_plaintext IS NOT NULL AND v_secret = p_legacy_plaintext)
      OR (v_secret = p_password_hash);
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  -- Mise à niveau transparente vers bcrypt(pbkdf2_sha256) et suppression du clair
  IF v_row.password IS NOT NULL OR v_row.password_hash IS NULL OR NOT (v_row.password_hash LIKE '$2%') THEN
    UPDATE public.profiles
    SET
      password_hash = crypt(p_password_hash, gen_salt('bf')),
      password = NULL,
      updated_at = NOW()
    WHERE public.profiles.id = v_row.id;
  END IF;

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.username,
    v_row.friend_code,
    v_row.trainer_title,
    v_row.avatar_pokemon_id,
    v_row.avatar_pokemon_emoji,
    v_row.current_league,
    v_row.total_xp,
    v_row.total_workouts,
    v_row.avatar_url,
    v_row.created_at;
END;
$$;

-- =========================================================================
-- SÉCURITÉ ROW LEVEL SECURITY (RLS) & CONTRÔLE D'ACCÈS GRANULAIRE
-- =========================================================================

-- 1. ACTIVER LE ROW LEVEL SECURITY SUR LES 14 TABLES VITAX
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.body_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fitness_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.running_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.raid_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friend_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friend_challenges ENABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER LES ANCIENNES POLITIQUES UNIVERSELLES PERMISSIVES
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
    END IF;
  END LOOP;
END $$;

-- 3. POLITIQUES RLS PAR TABLE
-- 3.1 Profiles : lecture publique des colonnes non sensibles (classement/amis), modification restreinte au propriétaire
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_owner" ON public.profiles;
CREATE POLICY "profiles_insert_owner" ON public.profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (id = public.current_vitax_user_id());

DROP POLICY IF EXISTS "profiles_update_owner" ON public.profiles;
CREATE POLICY "profiles_update_owner" ON public.profiles
  FOR UPDATE TO anon, authenticated
  USING (id = public.current_vitax_user_id())
  WITH CHECK (id = public.current_vitax_user_id());

DROP POLICY IF EXISTS "profiles_delete_owner" ON public.profiles;
CREATE POLICY "profiles_delete_owner" ON public.profiles
  FOR DELETE TO anon, authenticated
  USING (id = public.current_vitax_user_id());

-- 3.2 Tables personnelles / santé (strictement isolées par user_id = current_vitax_user_id())
DO $$
DECLARE
  t text;
  user_tables text[] := ARRAY[
    'workout_sessions',
    'workout_sets',
    'user_favorites',
    'body_weights',
    'fitness_goals',
    'running_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%I_owner_isolation" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_owner_isolation" ON public.%I FOR ALL TO anon, authenticated USING (user_id = public.current_vitax_user_id()) WITH CHECK (user_id = public.current_vitax_user_id())',
      t, t
    );
  END LOOP;
END $$;

-- 3.3 Table trades (stockage système cloud backup par sender_id)
DROP POLICY IF EXISTS "trades_owner_isolation" ON public.trades;
CREATE POLICY "trades_owner_isolation" ON public.trades
  FOR ALL TO anon, authenticated
  USING (sender_id = public.current_vitax_user_id())
  WITH CHECK (sender_id = public.current_vitax_user_id());

-- 3.4 Classements hebdomadaires & Raids Co-op : lecture communautaire, écriture limitée à ses propres entrées
DROP POLICY IF EXISTS "leaderboards_select_all" ON public.weekly_leaderboards;
CREATE POLICY "leaderboards_select_all" ON public.weekly_leaderboards
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "leaderboards_write_owner" ON public.weekly_leaderboards;
CREATE POLICY "leaderboards_write_owner" ON public.weekly_leaderboards
  FOR ALL TO anon, authenticated
  USING (user_id = public.current_vitax_user_id())
  WITH CHECK (user_id = public.current_vitax_user_id());

DROP POLICY IF EXISTS "raids_select_all" ON public.raid_contributions;
CREATE POLICY "raids_select_all" ON public.raid_contributions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "raids_write_owner" ON public.raid_contributions;
CREATE POLICY "raids_write_owner" ON public.raid_contributions
  FOR ALL TO anon, authenticated
  USING (user_id = public.current_vitax_user_id())
  WITH CHECK (user_id = public.current_vitax_user_id());

-- 3.5 Amis, Demandes d'amis et Cadeaux : accessibles uniquement aux deux parties (user/sender ou friend/receiver)
DROP POLICY IF EXISTS "friends_participants_access" ON public.friends;
CREATE POLICY "friends_participants_access" ON public.friends
  FOR ALL TO anon, authenticated
  USING (user_id = public.current_vitax_user_id() OR friend_id = public.current_vitax_user_id())
  WITH CHECK (user_id = public.current_vitax_user_id() OR friend_id = public.current_vitax_user_id());

DROP POLICY IF EXISTS "friend_requests_participants_access" ON public.friend_requests;
CREATE POLICY "friend_requests_participants_access" ON public.friend_requests
  FOR ALL TO anon, authenticated
  USING (sender_id = public.current_vitax_user_id() OR receiver_id = public.current_vitax_user_id())
  WITH CHECK (sender_id = public.current_vitax_user_id() OR receiver_id = public.current_vitax_user_id());

DROP POLICY IF EXISTS "friend_gifts_participants_access" ON public.friend_gifts;
CREATE POLICY "friend_gifts_participants_access" ON public.friend_gifts
  FOR ALL TO anon, authenticated
  USING (sender_id = public.current_vitax_user_id() OR receiver_id = public.current_vitax_user_id())
  WITH CHECK (sender_id = public.current_vitax_user_id() OR receiver_id = public.current_vitax_user_id());

-- 3.6 Défis entre amis
DROP POLICY IF EXISTS "friend_challenges_select_all" ON public.friend_challenges;
CREATE POLICY "friend_challenges_select_all" ON public.friend_challenges
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "friend_challenges_insert_creator" ON public.friend_challenges;
CREATE POLICY "friend_challenges_insert_creator" ON public.friend_challenges
  FOR INSERT TO anon, authenticated
  WITH CHECK (creator_id = public.current_vitax_user_id());

DROP POLICY IF EXISTS "friend_challenges_update_authenticated" ON public.friend_challenges;
CREATE POLICY "friend_challenges_update_authenticated" ON public.friend_challenges
  FOR UPDATE TO anon, authenticated
  USING (public.current_vitax_user_id() IS NOT NULL)
  WITH CHECK (public.current_vitax_user_id() IS NOT NULL);

-- 3.7 Tables relationnelles dédiées remplaçant le détournement de public.trades (Fiche 1.5)
CREATE TABLE IF NOT EXISTS public.deleted_entities (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.active_workouts (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  draft JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_bonuses (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bonus_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.custom_catalog (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  custom_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_programs JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_program_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deleted_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_catalog ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  extra_tables text[] := ARRAY[
    'deleted_entities',
    'active_workouts',
    'daily_bonuses',
    'user_settings',
    'custom_catalog'
  ];
BEGIN
  FOREACH t IN ARRAY extra_tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%I_owner_isolation" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_owner_isolation" ON public.%I FOR ALL TO anon, authenticated USING (user_id = public.current_vitax_user_id()) WITH CHECK (user_id = public.current_vitax_user_id())',
      t, t
    );
  END LOOP;
END $$;

-- 4. PRIVILÈGES DE COLONNES SUR PROFILES (INTERDIT LA LECTURE DE PASSWORD / PASSWORD_HASH AUX CLIENTS)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id,
  username,
  friend_code,
  trainer_title,
  avatar_pokemon_id,
  avatar_pokemon_emoji,
  current_league,
  total_xp,
  total_workouts,
  avatar_url,
  created_at,
  updated_at
) ON public.profiles TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_vitax_user_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_trainer_secure(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_trainer_secure(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

