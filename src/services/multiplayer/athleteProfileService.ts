import { getDatabase } from '../../database/db';
import {
  LeaderboardEntry,
  AthleteShowcase,
  AthleteTopExercise,
  AthletePersonalRecord,
  AthleteRecentWorkout,
  LeagueTier,
} from '../../types/social';
import { computeLevelInfoForXp } from '../gamificationService';
import { getOrCreateTrainerProfile } from './profileService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { VITAX_COMMUNITY_ATHLETES } from './leagueService';

/**
 * Profils vitrine types pour les athlètes de la communauté Vitax
 */
const COMMUNITY_SHOWCASES: Record<
  string,
  {
    topExercises: AthleteTopExercise[];
    personalRecords: AthletePersonalRecord[];
    recentWorkouts: AthleteRecentWorkout[];
  }
> = {
  vtx_alexandre_pl: {
    topExercises: [
      { id: 'ex_squat', name: 'Squat Barre Libre', targetMuscle: 'Quadriceps', totalSets: 142, maxWeightKg: 200, totalVolumeKg: 95400 },
      { id: 'ex_bench', name: 'Développé Couché Barre', targetMuscle: 'Pectoraux', totalSets: 128, maxWeightKg: 140, totalVolumeKg: 68200 },
      { id: 'ex_deadlift', name: 'Soulevé de Terre Traditionnel', targetMuscle: 'Ischios & Dos', totalSets: 96, maxWeightKg: 240, totalVolumeKg: 82000 },
      { id: 'ex_ohp', name: 'Développé Militaire Barre', targetMuscle: 'Épaules', totalSets: 74, maxWeightKg: 85, totalVolumeKg: 26500 },
    ],
    personalRecords: [
      { id: 'pr_dl', exerciseName: 'Soulevé de Terre', targetMuscle: 'Ischios & Dos', bestWeightKg: 240, reps: 1, estimatedOneRepMaxKg: 240, achievedAt: 'Il y a 5 jours' },
      { id: 'pr_sq', exerciseName: 'Squat Barre Libre', targetMuscle: 'Quadriceps', bestWeightKg: 200, reps: 3, estimatedOneRepMaxKg: 216, achievedAt: 'Il y a 1 semaine' },
      { id: 'pr_bp', exerciseName: 'Développé Couché', targetMuscle: 'Pectoraux', bestWeightKg: 140, reps: 5, estimatedOneRepMaxKg: 163, achievedAt: 'Il y a 2 semaines' },
      { id: 'pr_ohp', exerciseName: 'Développé Militaire', targetMuscle: 'Épaules', bestWeightKg: 85, reps: 6, estimatedOneRepMaxKg: 102, achievedAt: 'Il y a 3 semaines' },
    ],
    recentWorkouts: [
      { id: 'w_al1', programName: 'Powerlifting • Squat & Ischios', date: 'Hier', durationMinutes: 72, totalVolumeKg: 11400, totalSets: 18 },
      { id: 'w_al2', programName: 'Force Pectoraux & Triceps', date: 'Il y a 3 jours', durationMinutes: 65, totalVolumeKg: 8900, totalSets: 16 },
      { id: 'w_al3', programName: 'Heavy Deadlift & Dos Épais', date: 'Il y a 5 jours', durationMinutes: 80, totalVolumeKg: 13200, totalSets: 20 },
    ],
  },
  vtx_sarah_fit: {
    topExercises: [
      { id: 'ex_hip_thrust', name: 'Hip Thrust Barre', targetMuscle: 'Fessiers', totalSets: 115, maxWeightKg: 130, totalVolumeKg: 54600 },
      { id: 'ex_bulgarian', name: 'Squat Bulgare Haltères', targetMuscle: 'Quadriceps & Fessiers', totalSets: 92, maxWeightKg: 26, totalVolumeKg: 21400 },
      { id: 'ex_lat_pull', name: 'Tirage Vertical Poitrine', targetMuscle: 'Dos', totalSets: 88, maxWeightKg: 60, totalVolumeKg: 24800 },
      { id: 'ex_leg_press', name: 'Presse à Cuisses Inclinée', targetMuscle: 'Quadriceps', totalSets: 76, maxWeightKg: 180, totalVolumeKg: 42000 },
    ],
    personalRecords: [
      { id: 'pr_ht', exerciseName: 'Hip Thrust Barre', targetMuscle: 'Fessiers', bestWeightKg: 130, reps: 10, estimatedOneRepMaxKg: 173, achievedAt: 'Il y a 3 jours' },
      { id: 'pr_lp', exerciseName: 'Presse à Cuisses', targetMuscle: 'Quadriceps', bestWeightKg: 180, reps: 12, estimatedOneRepMaxKg: 252, achievedAt: 'Il y a 1 semaine' },
      { id: 'pr_pulldown', exerciseName: 'Tirage Vertical', targetMuscle: 'Dos', bestWeightKg: 60, reps: 10, estimatedOneRepMaxKg: 80, achievedAt: 'Il y a 2 semaines' },
      { id: 'pr_fentes', exerciseName: 'Fentes Marchées Haltères', targetMuscle: 'Jambes', bestWeightKg: 22, reps: 12, estimatedOneRepMaxKg: 30, achievedAt: 'Il y a 2 semaines' },
    ],
    recentWorkouts: [
      { id: 'w_s1', programName: 'Fessiers Galbés & Ischios Focus', date: 'Aujourd’hui', durationMinutes: 58, totalVolumeKg: 6800, totalSets: 18 },
      { id: 'w_s2', programName: 'Haut du Corps & Gainage Athlétique', date: 'Il y a 2 jours', durationMinutes: 52, totalVolumeKg: 4900, totalSets: 16 },
      { id: 'w_s3', programName: 'Circuit Full Body & Cardio Burn', date: 'Il y a 4 jours', durationMinutes: 62, totalVolumeKg: 5150, totalSets: 20 },
    ],
  },
  vtx_kador557: {
    topExercises: [
      { id: 'ex_bench', name: 'Développé Couché Haltères', targetMuscle: 'Pectoraux', totalSets: 110, maxWeightKg: 46, totalVolumeKg: 41200 },
      { id: 'ex_rowing', name: 'Rowing Barre Buste Penché', targetMuscle: 'Dos', totalSets: 94, maxWeightKg: 110, totalVolumeKg: 48900 },
      { id: 'ex_squat', name: 'Squat Barre Guidée', targetMuscle: 'Quadriceps', totalSets: 82, maxWeightKg: 160, totalVolumeKg: 58000 },
      { id: 'ex_curls', name: 'Curl Haltères Incliné', targetMuscle: 'Biceps', totalSets: 75, maxWeightKg: 22, totalVolumeKg: 16500 },
    ],
    personalRecords: [
      { id: 'pr_bench', exerciseName: 'Développé Couché Haltères', targetMuscle: 'Pectoraux', bestWeightKg: 46, reps: 8, estimatedOneRepMaxKg: 58, achievedAt: 'Il y a 4 jours' },
      { id: 'pr_rowing', exerciseName: 'Rowing Barre', targetMuscle: 'Dos', bestWeightKg: 110, reps: 6, estimatedOneRepMaxKg: 132, achievedAt: 'Il y a 1 semaine' },
      { id: 'pr_squat', exerciseName: 'Squat Guidé', targetMuscle: 'Quadriceps', bestWeightKg: 160, reps: 5, estimatedOneRepMaxKg: 186, achievedAt: 'Il y a 2 semaines' },
    ],
    recentWorkouts: [
      { id: 'w_k1', programName: 'Pectoraux Lourds & Biceps', date: 'Hier', durationMinutes: 64, totalVolumeKg: 8200, totalSets: 19 },
      { id: 'w_k2', programName: 'Dos & Arrière d’Épaule', date: 'Il y a 3 jours', durationMinutes: 68, totalVolumeKg: 9100, totalSets: 18 },
    ],
  },
  vtx_thomas_force: {
    topExercises: [
      { id: 'ex_pullup', name: 'Tractions Lestées', targetMuscle: 'Dos & Biceps', totalSets: 85, maxWeightKg: 32, totalVolumeKg: 28500 },
      { id: 'ex_dips', name: 'Dips Lestés', targetMuscle: 'Pectoraux & Triceps', totalSets: 78, maxWeightKg: 40, totalVolumeKg: 34100 },
      { id: 'ex_db_press', name: 'Développé Incliné Haltères', targetMuscle: 'Pectoraux', totalSets: 70, maxWeightKg: 38, totalVolumeKg: 26800 },
    ],
    personalRecords: [
      { id: 'pr_dips', exerciseName: 'Dips Lestés', targetMuscle: 'Pectoraux', bestWeightKg: 40, reps: 6, estimatedOneRepMaxKg: 48, achievedAt: 'Il y a 3 jours' },
      { id: 'pr_pullup', exerciseName: 'Tractions Lestées', targetMuscle: 'Dos', bestWeightKg: 32, reps: 5, estimatedOneRepMaxKg: 37, achievedAt: 'Il y a 6 jours' },
    ],
    recentWorkouts: [
      { id: 'w_t1', programName: 'Force Push/Pull Lesté', date: 'Il y a 2 jours', durationMinutes: 55, totalVolumeKg: 6400, totalSets: 16 },
    ],
  },
};

/**
 * Formate une date relative en français ("Aujourd'hui", "Hier", "Il y a X jours")
 */
function formatRelativeDate(isoDateString?: string | null): string {
  if (!isoDateString) return 'Récemment';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return 'Récemment';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Aujourd’hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return 'Récemment';
  }
}

/**
 * Récupère le showcase complet pour l'utilisateur courant directement depuis SQLite
 */
async function getCurrentUserLocalShowcase(
  profile: any,
  entry?: LeaderboardEntry
): Promise<AthleteShowcase> {
  const db = await getDatabase();

  // 1. Top Exercices les plus pratiqués (groupés par exercice)
  let topExercises: AthleteTopExercise[] = [];
  try {
    const exRows = await db.getAllAsync<{
      id: string;
      name: string;
      target_muscle: string;
      total_sets: number;
      max_weight: number;
      total_volume: number;
    }>(`
      SELECT 
        ws.exercise_id AS id,
        COALESCE(e.name, 'Exercice') AS name,
        COALESCE(e.target_muscle, 'Général') AS target_muscle,
        COUNT(ws.id) AS total_sets,
        MAX(ws.weight) AS max_weight,
        SUM(ws.weight * ws.reps) AS total_volume
      FROM workout_sets ws
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      WHERE (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)
      GROUP BY ws.exercise_id
      ORDER BY total_sets DESC, total_volume DESC
      LIMIT 6
    `);

    if (exRows && exRows.length > 0) {
      topExercises = exRows.map((r) => ({
        id: r.id,
        name: r.name,
        targetMuscle: r.target_muscle,
        totalSets: r.total_sets || 0,
        maxWeightKg: Math.round(r.max_weight || 0),
        totalVolumeKg: Math.round(r.total_volume || 0),
      }));
    }
  } catch (err) {
    console.warn('Erreur lecture top exercices locaux:', err);
  }

  // 2. Records Personnels (PRs)
  let personalRecords: AthletePersonalRecord[] = [];
  try {
    const prRows = await db.getAllAsync<{
      id: string;
      exercise_name: string;
      target_muscle: string;
      best_weight: number;
      reps: number;
      created_at: string;
    }>(`
      SELECT 
        ws.id,
        COALESCE(e.name, 'Exercice') AS exercise_name,
        COALESCE(e.target_muscle, 'Général') AS target_muscle,
        ws.weight AS best_weight,
        ws.reps,
        ws.created_at
      FROM workout_sets ws
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      WHERE (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)
        AND ws.weight > 0
      ORDER BY ws.weight DESC
      LIMIT 12
    `);

    // Dédoublonner par nom d'exercice pour ne garder que le meilleur PR par mouvement
    const seenExercises = new Set<string>();
    for (const pr of prRows || []) {
      const key = pr.exercise_name.toLowerCase().trim();
      if (!seenExercises.has(key)) {
        seenExercises.add(key);
        const repsSafe = Math.max(1, pr.reps || 1);
        const est1rm = Math.round(pr.best_weight * (1 + repsSafe / 30));
        personalRecords.push({
          id: pr.id,
          exerciseName: pr.exercise_name,
          targetMuscle: pr.target_muscle,
          bestWeightKg: pr.best_weight,
          reps: repsSafe,
          estimatedOneRepMaxKg: Math.max(pr.best_weight, est1rm),
          achievedAt: formatRelativeDate(pr.created_at),
        });
        if (personalRecords.length >= 6) break;
      }
    }
  } catch (err) {
    console.warn('Erreur lecture records personnels locaux:', err);
  }

  // 3. Historique d'entraînement (Dernières séances)
  let recentWorkouts: AthleteRecentWorkout[] = [];
  try {
    const wRows = await db.getAllAsync<{
      id: string;
      date: string;
      program_name: string;
      duration_seconds: number;
      total_volume: number;
      total_sets: number;
    }>(`
      SELECT 
        id,
        date,
        program_name,
        duration_seconds,
        total_volume,
        total_sets
      FROM workout_sessions
      WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)
      ORDER BY date DESC
      LIMIT 8
    `);

    if (wRows && wRows.length > 0) {
      recentWorkouts = wRows.map((w) => ({
        id: w.id,
        date: formatRelativeDate(w.date),
        programName: w.program_name || 'Séance libre',
        durationMinutes: Math.round((w.duration_seconds || 0) / 60) || 45,
        totalVolumeKg: Math.round(w.total_volume || 0),
        totalSets: w.total_sets || 0,
      }));
    }
  } catch (err) {
    console.warn('Erreur lecture historique séances locales:', err);
  }

  const effectiveXp = Math.max(profile.totalXp || 0, entry?.totalXp || 0);
  const rankInfo = computeLevelInfoForXp(effectiveXp);

  return {
    userId: profile.id,
    username: profile.username || 'Vous',
    friendCode: profile.friendCode,
    trainerTitle: profile.trainerTitle || rankInfo.badgeName,
    avatarUrl: profile.avatarUrl,
    avatarPokemonEmoji: profile.avatarPokemonEmoji || '⚡',
    currentLeague: (profile.currentLeague || 'pierre') as LeagueTier,
    totalXp: effectiveXp,
    weeklyXp: entry?.weeklyXp || 0,
    workoutsCount: Math.max(profile.totalWorkouts || 0, entry?.workoutsCount || recentWorkouts.length),
    totalTonnageKg: entry?.totalTonnageKg || topExercises.reduce((sum, e) => sum + e.totalVolumeKg, 0),
    isCurrentUser: true,
    isFriend: false,
    athleteRank: {
      level: rankInfo.level,
      badgeName: rankInfo.badgeName,
      emoji: rankInfo.badgeEmoji,
      category: rankInfo.category,
    },
    topExercises,
    personalRecords,
    recentWorkouts,
  };
}

/**
 * Construit un showcase dynamique et réaliste pour les athlètes distants non encore renseignés
 */
function generateFallbackShowcaseForAthlete(
  entry: LeaderboardEntry
): {
  topExercises: AthleteTopExercise[];
  personalRecords: AthletePersonalRecord[];
  recentWorkouts: AthleteRecentWorkout[];
} {
  const isFemale =
    entry.username.toLowerCase().includes('anne') ||
    entry.username.toLowerCase().includes('camille') ||
    entry.username.toLowerCase().includes('julie') ||
    entry.username.toLowerCase().includes('sophie') ||
    entry.username.toLowerCase().includes('emma') ||
    entry.username.toLowerCase().includes('florence') ||
    entry.avatarPokemonEmoji === '🏃‍♀️' ||
    entry.avatarPokemonEmoji === '🧘‍♀️';

  if (isFemale) {
    const scale = Math.max(0.6, Math.min(1.4, (entry.totalXp || 1000) / 2500));
    return {
      topExercises: [
        { id: 'fb_ht', name: 'Hip Thrust Barre', targetMuscle: 'Fessiers', totalSets: Math.round(48 * scale), maxWeightKg: Math.round(90 * scale), totalVolumeKg: Math.round(18000 * scale) },
        { id: 'fb_sq', name: 'Squat Gobelet Haltère', targetMuscle: 'Quadriceps', totalSets: Math.round(36 * scale), maxWeightKg: Math.round(28 * scale), totalVolumeKg: Math.round(9500 * scale) },
        { id: 'fb_tp', name: 'Tirage Vertical Poitrine', targetMuscle: 'Dos', totalSets: Math.round(32 * scale), maxWeightKg: Math.round(45 * scale), totalVolumeKg: Math.round(8200 * scale) },
        { id: 'fb_fn', name: 'Fentes Marchées Haltères', targetMuscle: 'Jambes', totalSets: Math.round(26 * scale), maxWeightKg: Math.round(18 * scale), totalVolumeKg: Math.round(5400 * scale) },
      ],
      personalRecords: [
        { id: 'pr_fb1', exerciseName: 'Hip Thrust Barre', targetMuscle: 'Fessiers', bestWeightKg: Math.round(90 * scale), reps: 10, estimatedOneRepMaxKg: Math.round(120 * scale), achievedAt: 'Il y a 3 jours' },
        { id: 'pr_fb2', exerciseName: 'Tirage Vertical Poitrine', targetMuscle: 'Dos', bestWeightKg: Math.round(45 * scale), reps: 10, estimatedOneRepMaxKg: Math.round(60 * scale), achievedAt: 'Il y a 1 semaine' },
        { id: 'pr_fb3', exerciseName: 'Squat Gobelet Haltère', targetMuscle: 'Quadriceps', bestWeightKg: Math.round(28 * scale), reps: 12, estimatedOneRepMaxKg: Math.round(39 * scale), achievedAt: 'Il y a 2 semaines' },
      ],
      recentWorkouts: [
        { id: 'rw1', programName: 'Bas du Corps • Fessiers & Ischios', date: 'Il y a 2 jours', durationMinutes: 52, totalVolumeKg: Math.round(3800 * scale), totalSets: 16 },
        { id: 'rw2', programName: 'Haut du Corps & Tonicité', date: 'Il y a 4 jours', durationMinutes: 48, totalVolumeKg: Math.round(2900 * scale), totalSets: 14 },
      ],
    };
  }

  // Profil général masculin
  const scale = Math.max(0.6, Math.min(1.6, (entry.totalXp || 1200) / 3000));
  return {
    topExercises: [
      { id: 'fb_bp', name: 'Développé Couché Barre', targetMuscle: 'Pectoraux', totalSets: Math.round(46 * scale), maxWeightKg: Math.round(85 * scale), totalVolumeKg: Math.round(18500 * scale) },
      { id: 'fb_sq', name: 'Squat Barre Libre', targetMuscle: 'Quadriceps', totalSets: Math.round(38 * scale), maxWeightKg: Math.round(110 * scale), totalVolumeKg: Math.round(21000 * scale) },
      { id: 'fb_rw', name: 'Tirage Buste Penché Halteres', targetMuscle: 'Dos', totalSets: Math.round(34 * scale), maxWeightKg: Math.round(32 * scale), totalVolumeKg: Math.round(12000 * scale) },
      { id: 'fb_dp', name: 'Développé Militaire Haltères', targetMuscle: 'Épaules', totalSets: Math.round(28 * scale), maxWeightKg: Math.round(24 * scale), totalVolumeKg: Math.round(7500 * scale) },
    ],
    personalRecords: [
      { id: 'pr_fb1', exerciseName: 'Squat Barre Libre', targetMuscle: 'Quadriceps', bestWeightKg: Math.round(110 * scale), reps: 5, estimatedOneRepMaxKg: Math.round(128 * scale), achievedAt: 'Il y a 4 jours' },
      { id: 'pr_fb2', exerciseName: 'Développé Couché Barre', targetMuscle: 'Pectoraux', bestWeightKg: Math.round(85 * scale), reps: 6, estimatedOneRepMaxKg: Math.round(102 * scale), achievedAt: 'Il y a 1 semaine' },
      { id: 'pr_fb3', exerciseName: 'Tirage Haltères', targetMuscle: 'Dos', bestWeightKg: Math.round(32 * scale), reps: 8, estimatedOneRepMaxKg: Math.round(40 * scale), achievedAt: 'Il y a 2 semaines' },
    ],
    recentWorkouts: [
      { id: 'rw1', programName: 'Push • Pectoraux & Épaules', date: 'Il y a 2 jours', durationMinutes: 58, totalVolumeKg: Math.round(4800 * scale), totalSets: 17 },
      { id: 'rw2', programName: 'Legs & Abdos', date: 'Il y a 5 jours', durationMinutes: 62, totalVolumeKg: Math.round(6200 * scale), totalSets: 18 },
    ],
  };
}

/**
 * Récupère le profil vitrine complet d'un athlète (local ou distant)
 */
export async function getAthleteShowcase(
  athlete: LeaderboardEntry | string,
  isCurrentUserOverride?: boolean
): Promise<AthleteShowcase> {
  const profile = await getOrCreateTrainerProfile();
  const userId = typeof athlete === 'string' ? athlete : athlete.userId;
  const isMe = isCurrentUserOverride ?? (userId === profile.id);

  // 1. Profil de l'utilisateur actuel
  if (isMe) {
    const entry = typeof athlete === 'object' ? athlete : undefined;
    return getCurrentUserLocalShowcase(profile, entry);
  }

  // 2. Profil d'un athlète de la communauté Vitax (Coach IA / Bot)
  if (COMMUNITY_SHOWCASES[userId]) {
    const commData = COMMUNITY_SHOWCASES[userId];
    const botAthlete = VITAX_COMMUNITY_ATHLETES.find((b) => b.userId === userId);
    const entry =
      typeof athlete === 'object'
        ? athlete
        : {
            rank: 0,
            userId,
            username: botAthlete?.username || 'Athlète',
            friendCode: botAthlete?.friendCode,
            trainerTitle: botAthlete?.trainerTitle || 'Athlète Vitax',
            avatarPokemonEmoji: botAthlete?.avatarPokemonEmoji || '⚡',
            currentLeague: (botAthlete?.currentLeague || 'pierre') as LeagueTier,
            weeklyXp: botAthlete?.weeklyXp || 200,
            totalXp: botAthlete?.totalXp || 2500,
            totalTonnageKg: botAthlete?.totalTonnageKg || 15000,
            cardioMinutes: botAthlete?.cardioMinutes || 20,
            workoutsCount: botAthlete?.workoutsCount || 15,
            isCurrentUser: false,
            trend: 'same' as const,
          };

    const effectiveTotalXp = entry.totalXp || 2500;
    const rankInfo = computeLevelInfoForXp(effectiveTotalXp);

    return {
      userId,
      username: entry.username,
      friendCode: entry.friendCode,
      trainerTitle: entry.trainerTitle || rankInfo.badgeName,
      avatarUrl: entry.avatarUrl,
      avatarPokemonEmoji: entry.avatarPokemonEmoji || '⚡',
      currentLeague: (entry.currentLeague || 'pierre') as LeagueTier,
      totalXp: effectiveTotalXp,
      weeklyXp: entry.weeklyXp || 0,
      workoutsCount: entry.workoutsCount || commData.recentWorkouts.length,
      totalTonnageKg: entry.totalTonnageKg || commData.topExercises.reduce((s, e) => s + e.totalVolumeKg, 0),
      isCurrentUser: false,
      isFriend: entry.isFriend,
      athleteRank: {
        level: rankInfo.level,
        badgeName: rankInfo.badgeName,
        emoji: rankInfo.badgeEmoji,
        category: rankInfo.category,
      },
      topExercises: commData.topExercises,
      personalRecords: commData.personalRecords,
      recentWorkouts: commData.recentWorkouts,
    };
  }

  // 3. Profil réel Supabase (ex: Anne-So ou un ami)
  let cloudShowcase: any = null;
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, friend_code, trainer_title, avatar_url, avatar_pokemon_emoji, current_league, total_xp, total_workouts')
          .eq('id', userId)
          .maybeSingle();

        if (data) {
          // Tentative de récupération des séances publiques ou du showcase backup
          const { data: tradeBackup } = await supabase
            .from('trades')
            .select('offered_pokemon')
            .eq('id', `athlete_showcase_${userId}`)
            .maybeSingle();

          if (tradeBackup?.offered_pokemon) {
            cloudShowcase = tradeBackup.offered_pokemon;
          }
        }
      } catch (err) {
        console.warn('Erreur lecture cloud athlete showcase:', err);
      }
    }
  }

  const entry: LeaderboardEntry =
    typeof athlete === 'object'
      ? athlete
      : {
          rank: 0,
          userId,
          username: 'Athlète Vitax',
          trainerTitle: 'Athlète',
          avatarPokemonEmoji: '⚡',
          weeklyXp: 150,
          totalXp: 2000,
          totalTonnageKg: 10000,
          cardioMinutes: 0,
          workoutsCount: 10,
          isCurrentUser: false,
          trend: 'same',
        };

  const effectiveTotalXp = entry.totalXp || 2000;
  const rankInfo = computeLevelInfoForXp(effectiveTotalXp);

  const fallback = generateFallbackShowcaseForAthlete(entry);

  return {
    userId,
    username: entry.username,
    friendCode: entry.friendCode,
    trainerTitle: entry.trainerTitle || rankInfo.badgeName,
    avatarUrl: entry.avatarUrl,
    avatarPokemonEmoji: entry.avatarPokemonEmoji || '⚡',
    currentLeague: (entry.currentLeague || 'pierre') as LeagueTier,
    totalXp: effectiveTotalXp,
    weeklyXp: entry.weeklyXp || 0,
    workoutsCount: entry.workoutsCount || fallback.recentWorkouts.length,
    totalTonnageKg: entry.totalTonnageKg,
    isCurrentUser: false,
    isFriend: entry.isFriend,
    athleteRank: {
      level: rankInfo.level,
      badgeName: rankInfo.badgeName,
      emoji: rankInfo.badgeEmoji,
      category: rankInfo.category,
    },
    topExercises: cloudShowcase?.topExercises || fallback.topExercises,
    personalRecords: cloudShowcase?.personalRecords || fallback.personalRecords,
    recentWorkouts: cloudShowcase?.recentWorkouts || fallback.recentWorkouts,
  };
}
