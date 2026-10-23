import {
  hashPasswordPBKDF2,
  verifyPasswordSecure,
  isHashedPassword,
  constantTimeEqual,
  sanitizePostgrestIdentifier,
} from '../utils/cryptoSecurity';
import {
  convertWeightFromKg,
  convertWeightToKg,
  formatWeightWithUnit,
  isDurationExercise,
} from '../utils/exerciseUnits';
import {
  computeSetXp,
  getExerciseBiomechanicalProfile,
} from '../services/exerciseWeightingService';
import {
  generateOfflineWorkoutPlan,
  isGluteOrHamstringExercise,
  isUpperBodyFocus,
  isLowerBodyFocus,
  isAppropriateWarmupExercise,
} from '../services/aiWorkoutService';
import { computeWeeklyFitnessMetrics } from '../database/workoutRepository';
import {
  saveExerciseRating,
  getRatingSummaryForExercise,
  getAllUserFeedbackForDev,
  exportFeedbackSummaryText,
  exportFeedbackSummaryJson,
} from '../services/exerciseRatingService';
import { computeNextWorkoutNavigation } from '../utils/workoutNavigation';
import { calculateRunningSessionXp } from '../services/gamificationService';
import {
  createRunningSession,
  getRunningStats,
} from '../database/runningRepository';
import seedData from '../database/seedData.json';
import {
  EXERCISE_GUIDES_DATABASE,
  getExerciseGuide,
} from '../services/exerciseGuideService';
import { detectExerciseCategory } from '../components/common/exercise-animation/biomechanicalEngine';
import { MUSCLE_GROUPS_INFO } from '../constants/muscles';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runVitaxUnitTests(): Promise<{ passed: number; names: string[] }> {
  const names: string[] = [];

  // 1. Cryptographie PBKDF2-HMAC-SHA256 & Constant-Time Equal (Fiche 1.1)
  const hash1 = await hashPasswordPBKDF2('VitaxSecret2026!', 'athlete_test');
  assert(isHashedPassword(hash1), 'Le hash généré doit avoir le préfixe pbkdf2_sha256$');
  const validMatch = await verifyPasswordSecure('VitaxSecret2026!', 'athlete_test', hash1);
  assert(
    validMatch.valid === true && validMatch.needsMigration === false,
    'Le mot de passe valide doit être accepté par verifyPasswordSecure'
  );
  const invalidMatch = await verifyPasswordSecure('MauvaisMotDePasse', 'athlete_test', hash1);
  assert(invalidMatch.valid === false, 'Un mauvais mot de passe doit être rejeté par verifyPasswordSecure');
  const legacyMatch = await verifyPasswordSecure('AncienMdpClair', 'athlete_test', 'AncienMdpClair');
  assert(
    legacyMatch.valid === true && legacyMatch.needsMigration === true,
    'Un ancien mot de passe en clair doit déclencher needsMigration = true'
  );
  assert(constantTimeEqual('abc123XYZ', 'abc123XYZ') === true, 'constantTimeEqual doit retourner true pour chaînes identiques');
  assert(constantTimeEqual('abc123XYZ', 'abc123XY_') === false, 'constantTimeEqual doit retourner false pour chaînes différentes');
  names.push('cryptoSecurity: PBKDF2-HMAC-SHA256 & constantTimeEqual');

  // 2. Protection contre l'injection PostgREST .or() (Fiche 1.3)
  assert(sanitizePostgrestIdentifier('usr_123-abc') === 'usr_123-abc', 'Identifiant valide conservé');
  assert(
    sanitizePostgrestIdentifier('usr_1,receiver_id.neq.0') === null,
    'Injection PostgREST avec virgule et opérateur rejetée'
  );
  assert(sanitizePostgrestIdentifier('12345); DROP TABLE--') === null, 'Caractères spéciaux SQL/PostgREST rejetés');
  names.push('cryptoSecurity: sanitizePostgrestIdentifier anti-injection');

  // 3. Conversion d'unités KG <-> LBS & Exercices de durée (Fiche 2.4)
  assert(convertWeightFromKg(100, 'kg') === 100, '100 kg en unité kg = 100');
  assert(Math.abs(convertWeightFromKg(100, 'lbs') - 220.5) < 0.2, '100 kg en unité lbs ≈ 220.5 lbs');
  assert(Math.abs(convertWeightToKg(220.5, 'lbs') - 100) < 0.2, '220.5 lbs reconverti en kg ≈ 100 kg');
  assert(formatWeightWithUnit(80, 'kg').includes('80') && formatWeightWithUnit(80, 'kg').endsWith('kg'), 'Formatage 80 kg');
  assert(formatWeightWithUnit(100, 'lbs').endsWith('lbs'), 'Formatage en lbs');
  assert(
    isDurationExercise({ id: 'ex_treadmill', name: 'Tapis de course', equipment_needed: 'Tapis de course' }) === true,
    'Tapis de course détecté comme exercice de durée'
  );
  names.push('exerciseUnits: conversion KG/LBS & détection exercices de durée');

  // 4. Pondération biomécanique & Calcul unifié d'XP par série (Fiches 2.1 & 2.2)
  const squatProfile = getExerciseBiomechanicalProfile('Squat Barre', 'Quadriceps', 'Barre');
  const curlProfile = getExerciseBiomechanicalProfile('Curl Biceps', 'Biceps', 'Haltères');
  assert(
    squatProfile.difficultyCoef > curlProfile.difficultyCoef,
    'Un exercice polyarticulaire (Squat) a un coefficient de difficulté supérieur à une isolation (Curl)'
  );
  const squatSet = computeSetXp({
    exerciseName: 'Squat Barre',
    targetMuscle: 'Quadriceps',
    equipmentNeeded: 'Barre',
    weight: 100,
    reps: 10,
  });
  const curlSet = computeSetXp({
    exerciseName: 'Curl Biceps',
    targetMuscle: 'Biceps',
    equipmentNeeded: 'Haltères',
    weight: 20,
    reps: 10,
  });
  assert(
    squatSet.totalSetXp > curlSet.totalSetXp && squatSet.totalSetXp > 15,
    'computeSetXp valorise le tonnage et le multiplicateur biomécanique'
  );
  names.push('exerciseWeightingService: pondération biomécanique & XP par série');

  // 5. Moteur de Génération de Programmes IA & Respect du But Ciblé (Fiche 2.13)
  const exercises = ((seedData as any).exercises || (seedData as any).default?.exercises) as any[];

  // 5.1 Filtre d'exclusion spécifique Fessiers & Ischios
  const hipThrust = exercises.find((e: any) => e.id === 'ex_hip_thrust');
  const legExtension = exercises.find((e: any) => e.id === 'ex_leg_extension');
  const frontSquat = exercises.find((e: any) => e.id === 'ex_front_squat');
  assert(isGluteOrHamstringExercise(hipThrust) === true, 'Hip thrust qualifié Fessiers/Ischios');
  assert(isGluteOrHamstringExercise(legExtension) === false, 'Leg extension (quadriceps) exclu des Fessiers/Ischios');
  assert(isGluteOrHamstringExercise(frontSquat) === false, 'Front squat (quadriceps) exclu des Fessiers/Ischios');

  // 5.2 Cohérence échauffement haut/bas du corps
  const pushups = exercises.find((e: any) => e.id === 'ex_pushups');
  const airSquat = exercises.find((e: any) => e.id === 'ex_bodyweight_squat');
  assert(isAppropriateWarmupExercise(pushups, 'pecs_triceps') === true, 'Pompes adaptées en échauffement pecs/triceps');
  assert(isAppropriateWarmupExercise(airSquat, 'pecs_triceps') === false, 'Squat exclu de l’échauffement pecs/triceps');
  assert(isAppropriateWarmupExercise(airSquat, 'legs') === true, 'Squat adapté en échauffement jambes');
  assert(isUpperBodyFocus('pecs_triceps') === true, 'pecs_triceps est un focus haut du corps');
  assert(isLowerBodyFocus('glutes_hamstrings') === true, 'glutes_hamstrings est un focus bas du corps');

  // 5.3 Génération ciblée Pecs & Triceps (zéro jambes)
  const pecsPlan = await generateOfflineWorkoutPlan(
    {
      targetFocus: 'pecs_triceps',
      trainingType: 'hypertrophy',
      difficulty: 'Intermédiaire',
      durationMinutes: 45,
      availableEquipments: ['Barre', 'Haltères', 'Banc', 'Poulie / Machine', 'Sans matériel'],
    },
    exercises
  );
  const pecsExercises = pecsPlan.exercises;
  assert(pecsExercises.some((e) => e.target_muscle === 'Pectoraux'), 'Plan pecs_triceps contient des Pectoraux');
  assert(pecsExercises.some((e) => e.target_muscle === 'Triceps'), 'Plan pecs_triceps contient des Triceps');
  assert(!pecsExercises.some((e) => e.target_muscle === 'Jambes'), 'Plan pecs_triceps ne contient aucun exercice Jambes');

  // 5.4 Génération ciblée Dos & Biceps (garantie Biceps & zéro jambes)
  const backPlan = await generateOfflineWorkoutPlan(
    {
      targetFocus: 'dos_biceps',
      trainingType: 'hypertrophy',
      difficulty: 'Intermédiaire',
      durationMinutes: 45,
      availableEquipments: ['Barre', 'Haltères', 'Banc', 'Poulie / Machine', 'Sans matériel'],
    },
    exercises
  );
  assert(backPlan.exercises.some((e) => e.target_muscle === 'Dos'), 'Plan dos_biceps contient du Dos');
  assert(backPlan.exercises.some((e) => e.target_muscle === 'Biceps'), 'Plan dos_biceps contient bien des Biceps');
  assert(!backPlan.exercises.some((e) => e.target_muscle === 'Jambes'), 'Plan dos_biceps ne contient aucun exercice Jambes');

  // 5.5 Génération ciblée Fessiers & Ischios (zéro quad dominant)
  const glutesPlan = await generateOfflineWorkoutPlan(
    {
      targetFocus: 'glutes_hamstrings',
      trainingType: 'hypertrophy',
      difficulty: 'Intermédiaire',
      durationMinutes: 45,
      availableEquipments: ['Barre', 'Haltères', 'Banc', 'Poulie / Machine', 'Sans matériel'],
    },
    exercises
  );
  const mainGlutesExercises = glutesPlan.exercises.filter((e) => e.phase === 'compound' || e.phase === 'isolation');
  assert(
    mainGlutesExercises.every((e) => isGluteOrHamstringExercise(exercises.find((raw: any) => raw.id === e.exercise_id) || (e as any))),
    'Tous les exercices du plan fessiers_ischios ciblent la chaîne postérieure'
  );

  // 5.6 Génération ciblée Abdos & Gainage (100% core, zéro soulevé de terre lourd)
  const absPlan = await generateOfflineWorkoutPlan(
    {
      targetFocus: 'abs_core',
      trainingType: 'hypertrophy',
      difficulty: 'Intermédiaire',
      durationMinutes: 45,
      availableEquipments: ['Barre', 'Haltères', 'Banc', 'Poulie / Machine', 'Sans matériel'],
    },
    exercises
  );
  const mainAbsExercises = absPlan.exercises.filter((e) => e.phase === 'compound' || e.phase === 'isolation');
  assert(
    mainAbsExercises.every((e) => e.target_muscle === 'Abdominaux'),
    '100% des exercices du plan abs_core sont des abdominaux'
  );

  names.push('aiWorkoutService: ciblage anatomique strict & moteur de génération (11 focuses)');

  // 6. Régularité hebdomadaire & calcul des jours distincts d'exercice (Fiche 2.14)
  // Date de référence : Dimanche 18 Octobre 2026 (Semaine du Lundi 12/10 au Dimanche 18/10)
  const refDate = new Date('2026-10-18T15:00:00Z');

  // 6.1 Cas utilisateur réel : 8 séances réparties sur seulement 2 jours (Jeudi 15/10 et Vendredi 16/10)
  const sessionsMultiplePerDay = [
    { date: '2026-10-15T09:00:00Z' },
    { date: '2026-10-15T11:00:00Z' },
    { date: '2026-10-15T14:00:00Z' },
    { date: '2026-10-15T18:00:00Z' },
    { date: '2026-10-16T08:30:00Z' },
    { date: '2026-10-16T12:00:00Z' },
    { date: '2026-10-16T17:00:00Z' },
    { date: '2026-10-16T20:00:00Z' },
  ];
  const metricsMultiple = computeWeeklyFitnessMetrics(sessionsMultiplePerDay, [], refDate, 4);
  assert(
    metricsMultiple.distinctTrainedDaysCount === 2,
    `8 séances sur 2 jours doivent compter pour exactement 2 jours d'exercice (obtenu: ${metricsMultiple.distinctTrainedDaysCount})`
  );
  assert(
    metricsMultiple.totalWeekSessionsCount === 8,
    'totalWeekSessionsCount doit enregistrer les 8 séances complétées'
  );
  assert(
    metricsMultiple.fitnessScorePercent === 50,
    `Le score pour 2 jours sur 4 doit être de 50% (obtenu: ${metricsMultiple.fitnessScorePercent}%)`
  );
  assert(
    metricsMultiple.activeDays.filter(Boolean).length === 2,
    'La rangée visuelle des jours doit contenir exactement 2 jours cochés'
  );
  assert(
    metricsMultiple.activeDays[3] === true && metricsMultiple.activeDays[4] === true,
    'Les jours cochés doivent être le Jeudi (index 3) et Vendredi (index 4)'
  );

  // 6.2 Cas séance de course à pied extérieure comptabilisée comme journée active
  const runningSessions = [{ date: '2026-10-14T07:00:00Z' }]; // Mercredi
  const metricsWithRun = computeWeeklyFitnessMetrics(sessionsMultiplePerDay, runningSessions, refDate, 4);
  assert(
    metricsWithRun.distinctTrainedDaysCount === 3,
    'La course extérieure du mercredi doit ajouter 1 jour distinct (total: 3 jours)'
  );
  assert(
    metricsWithRun.activeDays[2] === true,
    'Le Mercredi (index 2) doit être marqué actif grâce au running'
  );
  assert(
    metricsWithRun.fitnessScorePercent === 75,
    '3 jours sur 4 doivent donner 75%'
  );

  // 6.3 Cas objectif atteint (4 jours distincts sur 4)
  const fullWeekSessions = [
    { date: '2026-10-12T10:00:00Z' }, // Lundi
    { date: '2026-10-13T10:00:00Z' }, // Mardi
    { date: '2026-10-15T10:00:00Z' }, // Jeudi
    { date: '2026-10-17T10:00:00Z' }, // Samedi
  ];
  const metricsFull = computeWeeklyFitnessMetrics(fullWeekSessions, [], refDate, 4);
  assert(metricsFull.distinctTrainedDaysCount === 4, '4 jours distincts complétés');
  assert(metricsFull.fitnessScorePercent === 100, 'Score de forme à 100%');
  assert(metricsFull.fitnessLabel === 'Forme maximale ! 🏆', 'Label forme maximale');

  names.push('workoutRepository: calcul de régularité hebdomadaire & jours distincts d’exercice (Fiche 2.14)');

  // 7. Système d'évaluation et feedback développeur sur les exercices
  const savedRating = await saveExerciseRating({
    exercise_id: 'ex_bench_press',
    exercise_name: 'Développé couché',
    rating: 5,
    criteria_animation: 5,
    criteria_clarity: 4,
    criteria_feeling: 5,
    difficulty_tag: 'perfect',
    comment: 'Excellente trajectoire biomécanique pour les pectoraux',
    user_name: 'Testeur Antigravity',
  });

  assert(savedRating.rating === 5, 'La note enregistrée doit être de 5 étoiles');
  assert(savedRating.criteria_animation === 5, 'Le critère animation doit être conservé');
  assert(Boolean(savedRating.comment && savedRating.comment.includes('biomécanique')), 'Le commentaire doit être enregistré');

  const ratingSummary = await getRatingSummaryForExercise('ex_bench_press');
  assert(ratingSummary.averageRating >= 4 && ratingSummary.averageRating <= 5, 'Moyenne valide calculée');
  assert(ratingSummary.userRating !== undefined, 'Avis utilisateur présent dans le résumé');
  assert(ratingSummary.userRating?.rating === 5, 'Note utilisateur de 5 étoiles vérifiée');

  const allDevFeedbacks = await getAllUserFeedbackForDev();
  assert(allDevFeedbacks.some((f) => f.exercise_id === 'ex_bench_press'), 'L’exercice noté doit apparaître dans les retours dev');

  const reportText = await exportFeedbackSummaryText();
  assert(reportText.includes('RAPPORT RETOURS DÉVELOPPEUR'), 'Le rapport texte doit contenir l’entête');

  const reportJson = await exportFeedbackSummaryJson();
  const parsedJson = JSON.parse(reportJson);
  assert(parsedJson.total_feedbacks >= 1, 'L’export JSON doit contenir au moins 1 avis');

  names.push('exerciseRatingService: notation d’exercices, critères détaillés & export feedback dev');

  // 8. Navigation de séance active : passage au suivant sans clôture prématurée
  const mockWorkoutExercises = [
    { sets: [{ completed: true }, { completed: true }] }, // Exercice 0 (Terminé)
    { sets: [{ completed: false }, { completed: false }] }, // Exercice 1 (Non fait)
    { sets: [{ completed: false }] }, // Exercice 2 (Non fait)
  ];

  // 8.1 Validation exercice 0 -> Doit orienter vers exercice 1 (et NON fermer la séance !)
  const navFromEx0 = computeNextWorkoutNavigation(mockWorkoutExercises, 0);
  assert(navFromEx0.nextIndex === 1, 'Validation ex 0 doit mener à l’exercice 1');
  assert(navFromEx0.actionType === 'next_exercise', 'Action doit être next_exercise');
  assert(navFromEx0.isAllWorkoutCompleted === false, 'Séance non terminée car ex 1 et 2 restent');
  assert(navFromEx0.buttonLabel.includes('suivant'), 'Le bouton doit proposer Exercice suivant');

  // 8.2 Exercice 1 terminé aussi -> Doit orienter vers exercice 2
  mockWorkoutExercises[1].sets.forEach((s) => (s.completed = true));
  const navFromEx1 = computeNextWorkoutNavigation(mockWorkoutExercises, 1);
  assert(navFromEx1.nextIndex === 2, 'Validation ex 1 doit mener à l’exercice 2');
  assert(navFromEx1.actionType === 'next_exercise', 'Action doit être next_exercise pour le dernier restant');

  // 8.3 Exercice 2 terminé -> TOUS les exercices sont finis -> Doit proposer de terminer la séance
  mockWorkoutExercises[2].sets[0].completed = true;
  const navFromEx2 = computeNextWorkoutNavigation(mockWorkoutExercises, 2);
  assert(navFromEx2.isAllWorkoutCompleted === true, 'Tous les exercices sont complétés');
  assert(navFromEx2.actionType === 'finish_workout', 'Action finale finish_workout');
  assert(navFromEx2.buttonLabel.includes('Terminer'), 'Propose de terminer la séance');

  // 8.4 Cas où l'utilisateur est sur le dernier exercice mais un exercice antérieur a été sauté
  const skippedWorkoutExercises = [
    { sets: [{ completed: true }] },
    { sets: [{ completed: false }] }, // Exercice 1 sauté
    { sets: [{ completed: true }] }, // Exercice 2 (en cours de validation)
  ];
  const navSkipped = computeNextWorkoutNavigation(skippedWorkoutExercises, 2);
  assert(navSkipped.nextIndex === 1, 'Doit réorienter vers l’exercice 1 restant');
  assert(navSkipped.actionType === 'previous_uncompleted', 'Action previous_uncompleted');

  names.push('workoutNavigation: transition intelligente vers l’exercice suivant sans clôture prématurée');

  // 9. Mécaniques d'expérience (XP) pour la course à pied et la marche
  // 9.1 Formule de course : 5 km en 30 min (1800s) -> 50 + 5*75 + 30*2 = 485 XP
  const runXp = calculateRunningSessionXp(5, 1800, false);
  assert(runXp === 485, `Course 5km/30min doit rapporter 485 XP (obtenu: ${runXp})`);

  // 9.2 Formule de marche : 5 km en 50 min (3000s) -> 35 + 5*45 + 50*1.5 = 335 XP
  const walkXp = calculateRunningSessionXp(5, 3000, true);
  assert(walkXp === 335, `Marche 5km/50min doit rapporter 335 XP (obtenu: ${walkXp})`);

  // 9.3 Cas limites : session vide vs session très courte avec seuils minimums
  assert(calculateRunningSessionXp(0, 0, false) === 0, 'Session sans durée ni distance = 0 XP');
  assert(calculateRunningSessionXp(0.1, 30, false) >= 35, 'Seuil minimum course respecté (min 35 XP)');
  assert(calculateRunningSessionXp(0.1, 30, true) >= 25, 'Seuil minimum marche respecté (min 25 XP)');

  // 9.4 Persistance d'une session course et calcul dans les stats
  const savedRun = await createRunningSession({
    distance_km: 6.2,
    duration_seconds: 2100, // 35 min -> 50 + 6.2*75 (465) + 35*2 (70) = 585 XP
    notes: 'Footing en forêt',
  });
  assert(savedRun.xp_earned !== undefined && savedRun.xp_earned > 0, 'La session de course doit avoir xp_earned');
  assert(savedRun.xp_earned === 585, `XP calculé pour 6.2km/35min doit être 585 (obtenu: ${savedRun.xp_earned})`);

  // 9.5 Persistance d'une session de marche détectée via le tag [Marche]
  const savedWalk = await createRunningSession({
    distance_km: 4.0,
    duration_seconds: 2400, // 40 min -> 35 + 4*45 (180) + 40*1.5 (60) = 275 XP
    notes: '[Marche] Balade active en soirée',
  });
  assert(savedWalk.xp_earned === 275, `XP calculé pour marche 4km/40min doit être 275 (obtenu: ${savedWalk.xp_earned})`);

  // 9.6 Agrégation totale de l'XP dans les statistiques de course/marche
  const runningStats = await getRunningStats();
  assert(runningStats.totalXpEarned !== undefined && runningStats.totalXpEarned >= 860, 'totalXpEarned calculé dans getRunningStats');

  names.push('runningRepository & gamification: formules XP course/marche, persistance et agrégation');

  // 10. Rangs d'athlète (16 tiers), recalibration des ligues et profil vitrine (Fiche XP & Arène)
  const { ATHLETE_RANK_TIERS: allTiers, computeLevelInfoForXp: getLevelInfo } = await import('../services/gamificationService');
  const { LEAGUE_CONFIGS: leagues } = await import('../services/multiplayer/profileService');
  const { getAthleteShowcase: getShowcase } = await import('../services/multiplayer/athleteProfileService');

  // 10.1 Validation des 16 Rangs d'Athlète
  assert(allTiers.length === 16, `Il doit y avoir exactement 16 Rangs d’Athlète (actuel: ${allTiers.length})`);
  assert(allTiers[0].minXp === 0 && allTiers[0].level === 1, 'Rang 1 débute à 0 XP');
  assert(allTiers[15].level === 16 && allTiers[15].minXp === 140000, 'Rang 16 (Légende Vitax) à 140 000 XP');

  // 10.2 Cohérence du profil de Matthieu (2 330 XP)
  const matthieuLevel = getLevelInfo(2330);
  assert(matthieuLevel.level === 3, `2 330 XP doit correspondre au Niveau 3 (obtenu: Niv. ${matthieuLevel.level})`);
  assert(matthieuLevel.badgeName === 'Athlète Régulier', 'Niveau 3 est Athlète Régulier');
  assert(matthieuLevel.minXp === 1800, 'Palier min Niveau 3 = 1 800 XP');
  assert(matthieuLevel.nextLevelXp === 3200, 'Palier suivant = 3 200 XP');
  assert(matthieuLevel.progressPercent === 38, `Progression calculée: 38% (obtenu: ${matthieuLevel.progressPercent}%)`);

  // 10.3 Recalibration des 5 Ligues
  assert(leagues.pierre.minXpRequirement === 0, 'Ligue Bronze débute à 0 XP');
  assert(leagues.cascade.minXpRequirement === 1500, 'Ligue Argent débute à 1 500 XP');
  assert(leagues.foudre.minXpRequirement === 5000, 'Ligue Or débute à 5 000 XP (et non plus 1 500 XP)');
  assert(leagues.volcan.minXpRequirement === 15000, 'Ligue Platine débute à 15 000 XP');
  assert(leagues.maitre.minXpRequirement === 35000, 'Ligue Diamant débute à 35 000 XP');

  // 10.4 Vérification du profil vitrine (Showcase) athlète
  const alexShowcase = await getShowcase('vtx_alexandre_pl');
  assert(alexShowcase.username === 'Alexandre', 'Showcase identifie Alexandre');
  assert(alexShowcase.topExercises.length >= 4, 'Au moins 4 exercices préférés répertoriés');
  assert(alexShowcase.personalRecords.length >= 4, 'Au moins 4 records personnels répertoriés');
  assert(alexShowcase.recentWorkouts.length >= 2, 'Historique d’entraînement présent');
  assert(alexShowcase.personalRecords[0].bestWeightKg >= 200, 'PR Powerlifting lourd vérifié');

  names.push('athleteRanks & leagues: 16 tiers d’athlète, recalibration des ligues et profil vitrine (PRs & Historique)');

  // 11. Authentification obligatoire & useAuthStore
  const { onAuthStateChanged, sanitizeUsername } = await import('../services/authService');
  const { useAuthStore } = await import('../stores/authStore');

  // 11.1 Nettoyage des pseudos athlètes
  assert(sanitizeUsername('  Matthieu  ') === 'matthieu', 'Sanitize nettoie les espaces et met en minuscules');
  assert(sanitizeUsername('Sarah-94!') === 'sarah-94_', 'Sanitize remplace les caractères spéciaux par _');

  // 11.2 Écouteur réactif onAuthStateChanged
  let listenerCalled: any = false;
  let receivedSession: any = null;
  const unsubscribe = onAuthStateChanged((sess) => {
    listenerCalled = true;
    receivedSession = sess;
  });

  const { notifyAuthStateChanged } = await import('../services/authService');
  notifyAuthStateChanged({
    userId: 'vtx_test',
    username: 'TestUser',
    friendCode: '12345',
    isLoggedIn: true,
    createdAt: new Date().toISOString(),
  });

  assert(Boolean(listenerCalled) === true, 'Le listener onAuthStateChanged a bien été notifié');
  assert(receivedSession?.username === 'TestUser', 'La session transmise est conforme');
  assert(useAuthStore.getState().isLoggedIn === true, 'Le store useAuthStore réagit instantanément au login');

  notifyAuthStateChanged(null);
  assert(useAuthStore.getState().isLoggedIn === false, 'Le store useAuthStore réagit instantanément au logout');

  unsubscribe();

  names.push('mandatoryAuth: verrouillage d’ouverture, réactivité useAuthStore et onAuthStateChanged');

  // 12. Classement Permanent vs Classement Hebdomadaire (Total XP vs Weekly XP)
  const { VITAX_COMMUNITY_ATHLETES: communityList } = await import('../services/multiplayer/leagueService');

  // Test de tri hebdomadaire
  const weeklySorted = [...communityList].sort((a, b) => {
    if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
    return (b.totalXp || 0) - (a.totalXp || 0);
  });
  assert(
    weeklySorted[0].weeklyXp >= weeklySorted[1].weeklyXp,
    'En classement hebdomadaire, le premier a une XP de la semaine supérieure ou égale au second'
  );

  // Test de tri permanent (Total d'EXP cumulée)
  const permanentSorted = [...communityList].sort((a, b) => {
    const aTotal = a.totalXp || 0;
    const bTotal = b.totalXp || 0;
    if (bTotal !== aTotal) return bTotal - aTotal;
    return (b.workoutsCount || 0) - (a.workoutsCount || 0);
  });
  assert(
    (permanentSorted[0].totalXp || 0) >= (permanentSorted[1].totalXp || 0),
    'En classement permanent, le premier a une XP totale supérieure ou égale au second'
  );
  assert(
    permanentSorted[0].username === 'Alexandre' && permanentSorted[0].totalXp === 5890,
    'Alexandre domine le classement permanent avec 5 890 XP totale'
  );
  assert(
    permanentSorted[1].username === 'kador557' && permanentSorted[1].totalXp === 5200,
    'kador557 est second au classement permanent avec 5 200 XP totale'
  );

  // Vérification de la compatibilité du calcul de niveau d'athlète sur le top permanent
  const alexLevel = getLevelInfo(permanentSorted[0].totalXp || 0);
  assert(
    alexLevel.level >= 5,
    `Le leader du panthéon permanent doit être au moins niveau 5 (obtenu: Niv. ${alexLevel.level})`
  );

  names.push('leaderboardTimeframe: classement permanent au Total d’EXP vs classement hebdo de ligue');

  // 13. Synchronisation Temps Réel du Classement & Invalidation de Cache
  const {
    invalidateWeeklyStatsCache,
    subscribeToLeaderboardUpdates,
    notifyLeaderboardUpdated,
  } = await import('../services/multiplayer/leagueService');
  const { invalidateGamificationCache } = await import('../services/gamificationService');

  // Test invalidation sans crash
  invalidateWeeklyStatsCache();
  invalidateGamificationCache();
  assert(true, 'invalidateWeeklyStatsCache et invalidateGamificationCache s’exécutent avec succès');

  // Test système de souscription temps réel
  let notifiedTimes = 0;
  const unsubscribeLeaderboard = subscribeToLeaderboardUpdates(() => {
    notifiedTimes += 1;
  });
  notifyLeaderboardUpdated();
  assert(notifiedTimes === 1, 'L’écouteur de leaderboard est notifié immédiatement lors d’un changement d’XP');
  notifyLeaderboardUpdated();
  assert(notifiedTimes === 2, 'L’écouteur reçoit les notifications successives');

  // Test de désinscription
  unsubscribeLeaderboard();
  notifyLeaderboardUpdated();
  assert(notifiedTimes === 2, 'Après désinscription, l’écouteur ne reçoit plus les événements');

  names.push('realtimeLeaderboardSync: invalidation de cache, broadcast local & écoute temps réel');

  // 14. Statistiques Physiologiques & Analyse de l'IMC (BMR, TDEE, OMS, FFMI)
  const {
    calculateBmi,
    analyzeBmi,
    calculateMetabolism,
    calculateFfmi,
    buildPhysiologicalProfile,
  } = await import('../utils/physiologyUtils');

  // Test de calcul d'IMC
  const bmiStandard = calculateBmi(75, 178);
  assert(bmiStandard === 23.7, `IMC standard attendu 23.7 (obtenu: ${bmiStandard})`);
  assert(calculateBmi(0, 178) === null, 'Poids invalide doit retourner null');
  assert(calculateBmi(75, 40) === null, 'Taille invalide doit retourner null');

  // Test d'analyse OMS & jauge
  const analysisNormal = analyzeBmi(75, 178);
  assert(analysisNormal !== null, 'L’analyse IMC doit être instanciée');
  assert(analysisNormal?.category === 'normal', '75kg pour 178cm doit être en Corpulence normale');
  assert(analysisNormal?.idealWeightMinKg === 58.6, 'Poids min idéal attendu 58.6 kg');
  assert(analysisNormal?.idealWeightMaxKg === 78.9, 'Poids max idéal attendu 78.9 kg');
  assert(analysisNormal?.deltaToHealthyKg === 0, 'Dans la fourchette santé, deltaToHealthyKg doit valoir 0');

  // Test paradoxe de l'athlète musclé (surpoids athlétique)
  const analysisOverweight = analyzeBmi(90, 178);
  assert(analysisOverweight?.category === 'overweight', '90kg pour 178cm doit être en surpoids');
  assert(Boolean(analysisOverweight?.athleticNote.includes('Paradoxe')), 'Doit mentionner le paradoxe de l’athlète musclé');
  assert((analysisOverweight?.deltaToHealthyKg || 0) > 0, 'Au-dessus de la fourchette, deltaToHealthyKg doit être positif');

  // Test métabolisme et TDEE
  const meta = calculateMetabolism(75, 178);
  assert(meta !== null, 'Le métabolisme doit être calculé');
  assert(meta?.bmrKcal === 1728, `BMR Mifflin attendu 1728 kcal (obtenu: ${meta?.bmrKcal})`);
  assert(meta?.tdeeKcal.moderateAthlete === 2506, `TDEE athlète modéré attendu 2506 kcal (obtenu: ${meta?.tdeeKcal.moderateAthlete})`);
  assert(meta?.targetsKcal.leanBulk === 2806, 'Prise de masse propre attendue à +300 kcal (2806)');
  assert(meta?.targetsKcal.fatLoss === 2156, 'Sèche progressive attendue à -350 kcal (2156)');
  assert(meta?.recommendedWaterLiters === 3.1, `Hydratation attendue 3.1 L (obtenu: ${meta?.recommendedWaterLiters})`);

  // Test métabolisme avec masse grasse (Katch-McArdle)
  const metaKatch = calculateMetabolism(75, 178, 12);
  assert(metaKatch?.formulaUsed === 'katch_mcardle', 'Formule Katch-McArdle doit être utilisée avec % gras');

  // Test FFMI (Indice de masse maigre)
  const ffmiResult = calculateFfmi(75, 178, 14);
  assert(ffmiResult !== null, 'FFMI doit être calculé');
  assert(ffmiResult?.fatMassKg === 10.5, 'Masse grasse attendue 10.5 kg');
  assert(ffmiResult?.leanMassKg === 64.5, 'Masse maigre attendue 64.5 kg');
  assert(ffmiResult?.normalizedFfmi === 20.5, `FFMI normalisé attendu 20.5 (obtenu: ${ffmiResult?.normalizedFfmi})`);
  assert(ffmiResult?.classification === 'Athlète musclé', `Classification attendue 'Athlète musclé' (obtenu: ${ffmiResult?.classification})`);

  // Profil physiologique consolidé
  const fullProfile = buildPhysiologicalProfile(75, 178, 14);
  assert(fullProfile !== null && fullProfile.bmi.bmi === 23.7 && fullProfile.ffmi?.normalizedFfmi === 20.5, 'Profil consolidé complet');

  names.push('physiologyUtils: calculs IMC, classification OMS, jauge, BMR, TDEE et FFMI');

  // 15. Sécurité du compte, gestion de l'e-mail & modification du mot de passe
  const {
    registerTrainer,
    updateTrainerEmail,
    updateTrainerPassword,
  } = await import('../services/authService');

  // Test inscription avec email
  const regResult = await registerTrainer('AthlèteSecurise', 'MonSuperPass123', 'athlete@vitax.app');
  assert(regResult.success === true, 'Inscription avec e-mail réussie');
  assert(regResult.profile?.email === 'athlete@vitax.app', 'L’e-mail est correctement stocké sur le profil');

  // Test validation d'e-mail invalide
  const invalidEmailRes = await updateTrainerEmail('not-an-email');
  assert(invalidEmailRes.success === false, 'Rejet d’un format e-mail invalide');

  // Test mise à jour avec e-mail valide
  const validEmailRes = await updateTrainerEmail('contact.nouveau@exemple.com');
  assert(validEmailRes.success === true, 'Mise à jour d’un e-mail valide réussie');

  // Test suppression de l'e-mail (dissociation)
  const clearEmailRes = await updateTrainerEmail(null);
  assert(clearEmailRes.success === true, 'Suppression de l’e-mail réussie');

  // Test modification de mot de passe (trop court)
  const shortPassRes = await updateTrainerPassword('MonSuperPass123', 'abc');
  assert(shortPassRes.success === false, 'Rejet d’un nouveau mot de passe de moins de 4 caractères');

  // Test modification de mot de passe (identique)
  const samePassRes = await updateTrainerPassword('MonSuperPass123', 'MonSuperPass123');
  assert(samePassRes.success === false, 'Rejet si le nouveau mot de passe est identique à l’ancien');

  // Test modification de mot de passe valide
  const validPassRes = await updateTrainerPassword('MonSuperPass123', 'NouveauPass2026!');
  assert(validPassRes.success === true, 'Modification de mot de passe valide réussie');

  names.push('athleteAccountSecurity & emailManagement: validation email, hachage PBKDF2 & modification sécurisée');

  // 16. Module de Récupération de Mot de Passe (Par e-mail OTP et par Clé de secours Code Ami)
  const {
    maskEmail,
    requestPasswordReset,
    resetPasswordWithCode,
    resetPasswordWithRescueCode,
  } = await import('../services/authService');

  // Test masquage d'email
  assert(maskEmail('alexandre@vitax.app') === 'a***e@vitax.app', 'Masquage d’email conforme');
  assert(maskEmail('al@vitax.app') === 'a***@vitax.app', 'Masquage d’email court conforme');

  // Inscription d'un athlète de test pour la récupération
  const testRecoveryUser = await registerTrainer('AthlèteRecup', 'AncienPass999', 'recup@vitax.app');
  assert(testRecoveryUser.success === true, 'Création du compte de test pour la récupération');

  // Test demande de réinitialisation avec identifiant inconnu
  const reqUnknown = await requestPasswordReset('utilisateur_inexistant_9999');
  assert(reqUnknown.success === false, 'Rejet d’un identifiant inconnu');

  // Test demande de réinitialisation avec identifiant valide
  const reqValid = await requestPasswordReset('AthlèteRecup');
  assert(reqValid.success === true && reqValid.hasEmail === true, 'Demande de code OTP réussie');
  assert(reqValid.maskedEmail === 'r***p@vitax.app', 'Email masqué correct');
  assert(Boolean(reqValid.code && reqValid.code.length === 6), 'Code OTP à 6 chiffres généré');

  // Test validation avec mauvais code
  const resetWrongCode = await resetPasswordWithCode('AthlèteRecup', '000000', 'ToutNouveauPass123!');
  assert(resetWrongCode.success === false, 'Rejet d’un mauvais code OTP');

  // Test validation avec le bon code
  const resetSuccess = await resetPasswordWithCode('AthlèteRecup', reqValid.code!, 'ToutNouveauPass123!');
  assert(resetSuccess.success === true, 'Réinitialisation par code OTP réussie');

  // Test récupération par Clé de secours (Code Ami)
  const friendCode = testRecoveryUser.profile!.friendCode;

  // Mauvais Code Ami
  const rescueWrongCode = await resetPasswordWithRescueCode('AthlèteRecup', '00000', 'PassRescue456!');
  assert(rescueWrongCode.success === false, 'Rejet d’un Code Ami incorrect');

  // Mauvais email de confirmation
  const rescueWrongEmail = await resetPasswordWithRescueCode('AthlèteRecup', friendCode, 'PassRescue456!', 'fake@autre.com');
  assert(rescueWrongEmail.success === false, 'Rejet si l’email ne correspond pas au compte');

  // Clé de secours valide
  const rescueValid = await resetPasswordWithRescueCode('AthlèteRecup', friendCode, 'PassRescue456!', 'recup@vitax.app');
  assert(rescueValid.success === true, 'Réinitialisation par Clé de secours (Code Ami) réussie');

  names.push('passwordRecoveryModule: masquage email, code OTP 15min & Clé de secours Code Ami');

  // 17. Calcul et suivi calorique biomécanique des entraînements
  const {
    getExerciseActiveMet,
    calculateExerciseCalories,
    calculateWorkoutCalories,
    formatWorkoutCalories,
  } = await import('../utils/workoutCalorieUtils');

  // A. Étalonnage des METs selon la nature de l'exercice
  assert(getExerciseActiveMet('Squat Barre', 'Quadriceps') === 8.0, 'Squat doit avoir un MET élevé de 8.0');
  assert(getExerciseActiveMet('Soulevé de terre', 'Dos') === 8.0, 'Deadlift doit avoir un MET élevé de 8.0');
  assert(getExerciseActiveMet('Développé couché barre', 'Pectoraux') === 6.5, 'Bench press doit avoir un MET de 6.5');
  assert(getExerciseActiveMet('Curl Biceps Haltères', 'Biceps') === 3.8, 'Isolation bras doit avoir un MET modéré de 3.8');
  assert(getExerciseActiveMet('Burpees', 'Cardio') === 9.5, 'Conditionnement cardio doit avoir un MET de 9.5');

  // B. Dépense d'un exercice spécifique
  const exSingleRes = calculateExerciseCalories({
    name: 'Squat Barre',
    targetMuscle: 'Quadriceps',
    sets: [
      { weight: 100, reps: 8, completed: true },
      { weight: 100, reps: 8, completed: true },
      { weight: 100, reps: 8, completed: true },
    ],
  }, 80);
  assert(exSingleRes.completedSets === 3, '3 séries complétées attendues');
  assert(exSingleRes.volumeKg === 2400, 'Volume de 2400 kg attendu');
  assert(exSingleRes.calories >= 25 && exSingleRes.calories <= 80, `Calories squat attendues ~25-80 (obtenu: ${exSingleRes.calories})`);

  // C. Séance complète Jambes lourdes 50 min (Squats + Presse + Fentes) pour 80kg
  const heavyLegWorkout = calculateWorkoutCalories({
    exercises: [
      {
        name: 'Squat Barre',
        targetMuscle: 'Quadriceps',
        sets: [
          { weight: 110, reps: 6, completed: true },
          { weight: 110, reps: 6, completed: true },
          { weight: 110, reps: 6, completed: true },
          { weight: 110, reps: 6, completed: true },
        ],
      },
      {
        name: 'Presse à cuisses',
        targetMuscle: 'Quadriceps',
        sets: [
          { weight: 180, reps: 10, completed: true },
          { weight: 180, reps: 10, completed: true },
          { weight: 180, reps: 10, completed: true },
        ],
      },
      {
        name: 'Fentes marchées haltères',
        targetMuscle: 'Jambes',
        sets: [
          { weight: 20, reps: 12, completed: true },
          { weight: 20, reps: 12, completed: true },
          { weight: 20, reps: 12, completed: true },
        ],
      },
    ],
    durationSeconds: 3000, // 50 min
    userWeightKg: 80,
  });
  assert(heavyLegWorkout.totalCalories >= 280 && heavyLegWorkout.totalCalories <= 520, `Séance jambes 50min attendue ~280-520 kcal (obtenu: ${heavyLegWorkout.totalCalories})`);
  assert(heavyLegWorkout.breakdown.length === 3, '3 exercices dans le bilan détaillé');

  // D. Séance légère Bras 30 min pour 70kg
  const lightArmWorkout = calculateWorkoutCalories({
    exercises: [
      {
        name: 'Curl Biceps Haltères',
        targetMuscle: 'Biceps',
        sets: [
          { weight: 12, reps: 10, completed: true },
          { weight: 12, reps: 10, completed: true },
          { weight: 12, reps: 10, completed: true },
        ],
      },
      {
        name: 'Extension Triceps Poulie',
        targetMuscle: 'Triceps',
        sets: [
          { weight: 25, reps: 12, completed: true },
          { weight: 25, reps: 12, completed: true },
          { weight: 25, reps: 12, completed: true },
        ],
      },
    ],
    durationSeconds: 1800, // 30 min
    userWeightKg: 70,
  });
  assert(lightArmWorkout.totalCalories >= 100 && lightArmWorkout.totalCalories <= 240, `Séance bras 30min attendue ~100-240 kcal (obtenu: ${lightArmWorkout.totalCalories})`);
  assert(heavyLegWorkout.totalCalories > lightArmWorkout.totalCalories, 'Une séance jambes lourdes doit dépenser nettement plus qu’une séance isolation bras');

  // E. Facteur corporel : un athlète de 95kg dépense plus qu’un athlète de 65kg sur la même séance
  const armHeavyLifter = calculateWorkoutCalories({
    exercises: lightArmWorkout.breakdown.map((b) => ({
      name: b.exerciseName,
      sets: Array(b.completedSets).fill({ weight: 15, reps: 10, completed: true }),
    })),
    durationSeconds: 1800,
    userWeightKg: 95,
  });
  assert(armHeavyLifter.totalCalories > lightArmWorkout.totalCalories, 'Le poids de l’athlète doit accroître la dépense calorique');
  assert(formatWorkoutCalories(350) === '~350 kcal', 'Formatage calorique standard');
  assert(formatWorkoutCalories(null) === '-- kcal', 'Formatage null');

  names.push('workoutCalorieUtils: estimation biomécanique des kcal selon exercices, tonnage, durée et poids');

  // 18. Cohérence du module de suivi poids & analyse scientifique des variations
  const {
    parseWeightGoalTitle,
    formatWeightGoalTitle,
    analyzeWeightProgression,
  } = await import('../utils/physiologyUtils');

  // A. Parsing et formatage des objectifs de poids
  const bulkGoalTitle = formatWeightGoalTitle(84, 'bulk');
  assert(bulkGoalTitle.includes('[prise_masse]'), 'Formatage de titre prise de masse attendu');
  const parsedBulk = parseWeightGoalTitle(bulkGoalTitle);
  assert(parsedBulk.goalType === 'bulk' && parsedBulk.targetWeight === 84, 'Parsing conforme de l’objectif prise de masse');

  const cutGoalTitle = formatWeightGoalTitle(74.5, 'loss');
  const parsedCut = parseWeightGoalTitle(cutGoalTitle);
  assert(parsedCut.goalType === 'loss' && parsedCut.targetWeight === 74.5, 'Parsing conforme de l’objectif sèche');

  // B. Prise de poids en période de sèche : l'application NE félicite PAS arbitrairement d'avoir gagné du muscle
  const weightGainInCut = analyzeWeightProgression({
    currentWeight: 81.2,
    startingWeight: 82.0,
    targetWeight: 75.0,
    previousWeight: 80.5, // Hausse de +0.7 kg
    explicitGoalType: 'loss',
  });
  assert(weightGainInCut.isAlignedWithGoal === false, 'Une prise de poids en sèche n’est pas alignée avec l’objectif');
  assert(weightGainInCut.deltaDirection === 'up', 'Direction haussière détectée');
  assert(weightGainInCut.deltaColor === '#F59E0B', 'Alerte ambre constructive');
  assert(!weightGainInCut.feedbackAdvice.toLowerCase().includes('bravo'), 'Ne doit pas féliciter');
  assert(!weightGainInCut.feedbackAdvice.toLowerCase().includes('gagné du muscle'), 'Ne doit JAMAIS affirmer arbitrairement que la hausse est du muscle');
  assert(weightGainInCut.feedbackAdvice.includes('rétention d’eau') || weightGainInCut.feedbackAdvice.includes('transit') || weightGainInCut.feedbackAdvice.includes('glycogène'), 'Doit expliquer les fluctuations physiologiques réelles');

  // C. Prise de poids contrôlée en prise de masse : progression alignée
  const weightGainInBulk = analyzeWeightProgression({
    currentWeight: 78.4,
    startingWeight: 77.0,
    targetWeight: 82.0,
    previousWeight: 78.1, // +0.3 kg (rythme idéal)
    explicitGoalType: 'bulk',
  });
  assert(weightGainInBulk.isAlignedWithGoal === true, 'Gain modéré en prise de masse est aligné');
  assert(weightGainInBulk.deltaColor === '#22C55E', 'Vert de progression');
  assert(weightGainInBulk.progressPercent > 0, 'Progression positive');

  // D. Prise de masse trop brutale (>1.2kg en une pesée) : alerte de modération du surplus
  const rapidGainInBulk = analyzeWeightProgression({
    currentWeight: 80.5,
    startingWeight: 77.0,
    targetWeight: 82.0,
    previousWeight: 78.8, // +1.7 kg rapide
    explicitGoalType: 'bulk',
  });
  assert(rapidGainInBulk.feedbackAdvice.includes('stockage adipeux') || rapidGainInBulk.feedbackAdvice.includes('lentement'), 'Alerte sur la prise adipeuse excessive si prise de poids trop rapide');

  // E. Analyse de composition corporelle avec % MG : distinction masse maigre / masse grasse
  const fatLossSuccess = analyzeWeightProgression({
    currentWeight: 78.0,
    previousWeight: 79.0,
    startingWeight: 82.0,
    targetWeight: 75.0,
    currentBodyFat: 13.0,
    previousBodyFat: 14.5,
    explicitGoalType: 'loss',
  });
  assert(Boolean(fatLossSuccess.compositionInsight && fatLossSuccess.compositionInsight.includes('masse grasse')), 'Doit expliciter la perte de masse grasse réelle');

  names.push('weightProgressionCoherence: analyse scientifique des variations, objectifs sèche/masse/maintien sans félicitations arbitraires');

  // 19. Intégrité des exercices, vérification stricte anti-doublons & précision biomécanique
  const allExercises = ((seedData as any).exercises || (seedData as any).default?.exercises) as any[];
  assert(allExercises.length === 134, `Le catalogue Vitax doit contenir exactement 134 exercices (trouvé: ${allExercises.length})`);

  // A. Unicité stricte des identifiants (aucun ID en double)
  const uniqueIds = new Set(allExercises.map((e) => e.id));
  assert(uniqueIds.size === allExercises.length, `Aucun doublon d’identifiant ne doit exister (${uniqueIds.size}/${allExercises.length})`);

  // B. Unicité stricte des noms d’exercices (aucun libellé en double)
  const uniqueNames = new Set(allExercises.map((e) => e.name.trim().toLowerCase()));
  assert(uniqueNames.size === allExercises.length, `Aucun nom d’exercice en doublon (${uniqueNames.size}/${allExercises.length})`);

  // C. Vérification de la désambiguïsation des paires d’exercices à haute similarité
  const standingCableRow = allExercises.find((e) => e.id === 'ex_cable_single_arm_row');
  assert(Boolean(standingCableRow && standingCableRow.name.includes('debout unilatéral')), 'ex_cable_single_arm_row doit être qualifié debout unilatéral');

  const seatedCableRowUni = allExercises.find((e) => e.id === 'ex_cable_seated_single_arm_row');
  assert(Boolean(seatedCableRowUni && seatedCableRowUni.name.includes('assis unilatéral')), 'ex_cable_seated_single_arm_row doit être qualifié assis unilatéral');

  const bodyweightCalf = allExercises.find((e) => e.id === 'ex_calf_raise');
  assert(Boolean(bodyweightCalf && bodyweightCalf.name.includes('poids du corps')), 'ex_calf_raise doit être qualifié au poids du corps');

  const barbellCalf = allExercises.find((e) => e.id === 'ex_barbell_calf_raise');
  assert(Boolean(barbellCalf && barbellCalf.name.includes('à la barre')), 'ex_barbell_calf_raise doit mentionner la barre');

  const straightArmBar = allExercises.find((e) => e.id === 'ex_straight_arm_pulldown');
  assert(Boolean(straightArmBar && straightArmBar.name.includes('à la barre')), 'ex_straight_arm_pulldown doit mentionner la barre droite');

  const ropePullover = allExercises.find((e) => e.id === 'ex_cable_rope_pullover');
  assert(Boolean(ropePullover && ropePullover.name.includes('à la corde')), 'ex_cable_rope_pullover doit mentionner la corde');

  const tricepBarPushdown = allExercises.find((e) => e.id === 'ex_tricep_pushdown');
  assert(Boolean(tricepBarPushdown && tricepBarPushdown.name.includes('barre droite')), 'ex_tricep_pushdown doit mentionner la barre droite');

  const tricepRopePushdown = allExercises.find((e) => e.id === 'ex_cable_rope_triceps_pushdown');
  assert(Boolean(tricepRopePushdown && tricepRopePushdown.name.includes('à la corde')), 'ex_cable_rope_triceps_pushdown doit mentionner la corde');

  const bicepBarCurl = allExercises.find((e) => e.id === 'ex_cable_bicep_curl');
  assert(Boolean(bicepBarCurl && bicepBarCurl.name.includes('barre droite')), 'ex_cable_bicep_curl doit mentionner la barre droite');

  const bicepEzCurl = allExercises.find((e) => e.id === 'ex_cable_ez_bar_curl');
  assert(Boolean(bicepEzCurl && bicepEzCurl.name.includes('barre EZ')), 'ex_cable_ez_bar_curl doit mentionner la barre EZ');

  const straightGluteKick = allExercises.find((e) => e.id === 'ex_cable_glute_kickback');
  assert(Boolean(straightGluteKick && straightGluteKick.name.includes('jambe tendue')), 'ex_cable_glute_kickback doit mentionner jambe tendue');

  const donkeyKick = allExercises.find((e) => e.id === 'ex_cable_donkey_kickback');
  assert(Boolean(donkeyKick && donkeyKick.name.includes('genou fléchi')), 'ex_cable_donkey_kickback doit mentionner genou fléchi');

  // D. Couverture 100% experte de la base des guides d’exécution (134/134)
  const expertGuideCount = Object.keys(EXERCISE_GUIDES_DATABASE).length;
  assert(expertGuideCount === 134, `La base experte des guides doit couvrir 134 exercices (trouvé: ${expertGuideCount})`);

  // E. Complétude et rigueur biomécanique pour chaque exercice du catalogue
  for (const ex of allExercises) {
    const guide = getExerciseGuide(ex);
    assert(guide.id === ex.id, `ID conforme pour ${ex.id}`);
    assert(guide.objectif.length >= 30, `Objectif détaillé pour ${ex.id}`);
    assert(guide.chargeAdaptee.length >= 30, `Charge adaptée détaillée pour ${ex.id}`);
    assert(guide.position.length >= 30, `Position détaillée pour ${ex.id}`);
    assert(guide.posture.length >= 30, `Posture détaillée pour ${ex.id}`);
    assert(guide.completude.length >= 30, `Complétude du geste détaillée pour ${ex.id}`);
    assert(['Faible', 'Modéré', 'Élevé', 'Très Élevé'].includes(guide.niveauRisque), `Niveau de risque valide pour ${ex.id}`);
    assert(guide.mentionRisque.length >= 20, `Alerte de risque substantielle pour ${ex.id}`);
    assert(Array.isArray(guide.pointsAttention) && guide.pointsAttention.length >= 3, `Au moins 3 points d’attention pour ${ex.id}`);
  }

  // F. Classification cinématique exacte (sans faux positifs)
  assert(detectExerciseCategory('ex_tricep_kickback', 'Triceps') === 'triceps_extension', 'Kickback triceps doit être classé en triceps_extension et non hip_thrust');
  assert(detectExerciseCategory('ex_incline_curl', 'Biceps') === 'biceps_curl', 'Curl incliné doit être classé en biceps_curl et non incline_press');
  assert(detectExerciseCategory('ex_cable_incline_curl', 'Biceps') === 'biceps_curl', 'Curl incliné poulie doit être classé en biceps_curl et non incline_press');
  assert(detectExerciseCategory('ex_incline_dumbbell_row', 'Dos') === 'rowing', 'Rowing sur banc incliné doit être classé en rowing et non incline_press');
  assert(detectExerciseCategory('ex_walking_lunges', 'Jambes') === 'squat', 'Fentes marchées doit être classé en squat/jambes et non running');
  assert(detectExerciseCategory('ex_bench_dips', 'Triceps') === 'dips', 'Dips banc doit être classé en dips et non bench_press');
  assert(detectExerciseCategory('ex_decline_bench_leg_raise', 'Abdominaux') === 'hanging_leg_raise', 'Relevé de jambes sur banc décliné doit être classé en hanging_leg_raise et non bench_press');
  assert(detectExerciseCategory('ex_decline_bench_crunch', 'Abdominaux') === 'core_crunch', 'Crunch banc décliné doit être classé en core_crunch et non bench_press');
  assert(detectExerciseCategory('ex_cable_rope_triceps_pushdown', 'Triceps') === 'triceps_extension', 'Extension triceps corde doit être classé en triceps_extension et non running');
  assert(detectExerciseCategory('ex_cable_rear_delt_cross_pulldown', 'Épaules') === 'lateral_raise', 'Écarté croisé arrière épaule doit être classé en lateral_raise et non lat_pulldown');

  // G. Aucune catégorie générique default_weights non qualifiée
  let unclassifiedCount = 0;
  for (const ex of allExercises) {
    const cat = detectExerciseCategory(ex.id, ex.target_muscle);
    if (cat === 'default_weights') unclassifiedCount++;
  }
  assert(unclassifiedCount === 0, `Aucun exercice ne doit rester dans la catégorie générique par défaut (trouvé: ${unclassifiedCount})`);

  // H. Tous les 134 exercices sont cartographiés dans les sous-muscles précis
  const registeredMuscleIds = new Set();
  Object.values(MUSCLE_GROUPS_INFO).forEach((group) => {
    if (group.preciseMuscles) {
      group.preciseMuscles.forEach((pm) => {
        if (pm.exerciseIds) {
          pm.exerciseIds.forEach((id) => registeredMuscleIds.add(id));
        }
      });
    }
  });
  for (const ex of allExercises) {
    assert(registeredMuscleIds.has(ex.id), `L'exercice ${ex.id} doit être cartographié dans un sous-muscle précis de muscles.ts`);
  }

  names.push('exerciseIntegrityAndExecutionPrecision: vérification stricte anti-doublons, 100% guides biomécaniques et classification cinématique');

  // =========================================================================
  // 20. DATABASE RESILIENCE & WORKOUT VALIDATION
  // =========================================================================
  const { initDatabase } = await import('../database/db');
  await initDatabase();

  const { saveWorkoutSession, getAllWorkoutSessions } = await import('../database/workoutRepository');

  // Test de sauvegarde d'une séance libre sans erreur même si calories est null ou calculé
  const testSession = {
    id: 'test_session_free_' + Date.now(),
    program_id: null,
    program_name: 'Séance libre',
    date: new Date().toISOString(),
    duration_seconds: 1200,
    notes: 'Test séance libre',
    total_volume: 1500,
    total_sets: 3,
    completed: 1,
    calories: 145,
  };

  const testSets = [
    {
      id: 'set_test_1',
      workout_session_id: testSession.id,
      exercise_id: 'ex_bench_press',
      set_order: 1,
      weight: 60,
      reps: 10,
      completed: 1,
    },
    {
      id: 'set_test_2',
      workout_session_id: testSession.id,
      exercise_id: 'ex_bench_press',
      set_order: 2,
      weight: 60,
      reps: 8,
      completed: 1,
    },
  ];

  await saveWorkoutSession(testSession, testSets);
  const localSessions = await getAllWorkoutSessions();
  assert(Array.isArray(localSessions), 'getAllWorkoutSessions doit retourner un tableau sans bloquer');

  // Test du store workoutSessionStore finishWorkout pour séance libre
  const { useWorkoutSessionStore } = await import('../stores/workoutSessionStore');
  useWorkoutSessionStore.getState().startFreeWorkout();
  assert(useWorkoutSessionStore.getState().isActive === true, 'La séance libre doit être active');
  assert(useWorkoutSessionStore.getState().programName === 'Séance libre', 'Nom par défaut séance libre');

  const benchEx = allExercises.find((e) => e.id === 'ex_bench_press') || allExercises[0];
  await useWorkoutSessionStore.getState().addExerciseToWorkout(benchEx, 1, 10);
  useWorkoutSessionStore.getState().toggleSetCompleted(0, 0);

  const finishedRes = await useWorkoutSessionStore.getState().finishWorkout();
  assert(Boolean(finishedRes && finishedRes.session), 'finishWorkout doit retourner le résultat de séance validé');
  assert(useWorkoutSessionStore.getState().isActive === false, 'Le store doit être réinitialisé (isActive = false) après validation');
  assert(finishedRes?.session?.completed === 1, 'La séance doit être marquée complétée');

  names.push('databaseResilienceAndWorkoutValidation: auto-guérison schéma SQLite, accès instantané et validation fiable des séances');

  return { passed: names.length, names };
}


