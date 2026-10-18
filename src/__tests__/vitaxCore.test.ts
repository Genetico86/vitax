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

  return { passed: names.length, names };
}
