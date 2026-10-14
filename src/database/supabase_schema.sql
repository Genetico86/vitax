-- =========================================================================
-- VITAX - BASE DE DONNÉES CENTRALE PARTAGÉE & CLASSEMENTS (SUPABASE SQL)
-- =========================================================================
-- Exécutez ce script dans le SQL Editor de votre projet Supabase.
-- Il configure les tables partagées, index et politiques de sécurité RLS.
-- =========================================================================

-- 1. TABLE DES PROFILS DRESSEURS
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  friend_code TEXT NOT NULL UNIQUE,
  trainer_title TEXT DEFAULT 'Dresseur Rookie',
  avatar_pokemon_id TEXT DEFAULT 'pikachu',
  avatar_pokemon_emoji TEXT DEFAULT '⚡',
  current_league TEXT DEFAULT 'pierre',
  total_xp INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_friend_code ON public.profiles(friend_code);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 2. TABLE DES CLASSEMENTS HEBDOMADAIRES
CREATE TABLE IF NOT EXISTS public.weekly_leaderboards (
  id TEXT PRIMARY KEY, -- "2026-W42_user_id"
  week_id TEXT NOT NULL, -- ex: "2026-W42"
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  trainer_title TEXT,
  avatar_pokemon_emoji TEXT DEFAULT '⚡',
  current_league TEXT DEFAULT 'pierre',
  weekly_xp INTEGER DEFAULT 0,
  total_tonnage_kg INTEGER DEFAULT 0,
  cardio_minutes INTEGER DEFAULT 0,
  workouts_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboards_week_league ON public.weekly_leaderboards(week_id, current_league, weekly_xp DESC);

-- 3. TABLE DES AMIS (CERCLE RESTREINT)
CREATE TABLE IF NOT EXISTS public.friends (
  id TEXT PRIMARY KEY, -- "userId_friendId"
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);

-- 4. TABLE DU MARCHÉ D'ÉCHANGES POKÉMON
CREATE TABLE IF NOT EXISTS public.trades (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_code TEXT NOT NULL,
  offered_pokemon JSONB NOT NULL,
  requested_criteria_text TEXT,
  requested_species_id TEXT,
  friends_only BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'available', -- 'available' | 'completed' | 'cancelled'
  receiver_id TEXT,
  receiver_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status, created_at DESC);

-- 5. TABLE DES RAIDS CO-OP (TONNAGE CUMULÉ COLLECTIF)
CREATE TABLE IF NOT EXISTS public.raid_contributions (
  id TEXT PRIMARY KEY, -- "raidId_userId"
  raid_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_pokemon_emoji TEXT DEFAULT '⚡',
  contribution_value INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raid_contributions_raid ON public.raid_contributions(raid_id);

-- =========================================================================
-- POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- Accès transparent pour l'application sans configuration complexe
-- =========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raid_contributions ENABLE ROW LEVEL SECURITY;

-- Politiques ouvertes pour profiles
DROP POLICY IF EXISTS "Public select profiles" ON public.profiles;
CREATE POLICY "Public select profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public all profiles" ON public.profiles;
CREATE POLICY "Public all profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Politiques ouvertes pour weekly_leaderboards
DROP POLICY IF EXISTS "Public select leaderboards" ON public.weekly_leaderboards;
CREATE POLICY "Public select leaderboards" ON public.weekly_leaderboards FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public all leaderboards" ON public.weekly_leaderboards;
CREATE POLICY "Public all leaderboards" ON public.weekly_leaderboards FOR ALL USING (true) WITH CHECK (true);

-- Politiques ouvertes pour friends
DROP POLICY IF EXISTS "Public select friends" ON public.friends;
CREATE POLICY "Public select friends" ON public.friends FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public all friends" ON public.friends;
CREATE POLICY "Public all friends" ON public.friends FOR ALL USING (true) WITH CHECK (true);

-- Politiques ouvertes pour trades
DROP POLICY IF EXISTS "Public select trades" ON public.trades;
CREATE POLICY "Public select trades" ON public.trades FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public all trades" ON public.trades;
CREATE POLICY "Public all trades" ON public.trades FOR ALL USING (true) WITH CHECK (true);

-- Politiques ouvertes pour raid_contributions
DROP POLICY IF EXISTS "Public select raids" ON public.raid_contributions;
CREATE POLICY "Public select raids" ON public.raid_contributions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public all raids" ON public.raid_contributions;
CREATE POLICY "Public all raids" ON public.raid_contributions FOR ALL USING (true) WITH CHECK (true);
