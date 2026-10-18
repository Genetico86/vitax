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

  return { passed: names.length, names };
}

