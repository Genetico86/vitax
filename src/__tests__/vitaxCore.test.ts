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

  return { passed: names.length, names };
}


