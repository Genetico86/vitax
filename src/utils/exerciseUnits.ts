import { Equipment } from '../types';
import { EQUIPMENTS } from '../constants/muscles';
import { useSettingsStore } from '../stores/settingsStore';

export interface ExerciseUnitInfo {
  isDuration: boolean;
  isTimeBased: boolean;
  valueUnit: string;
  valueLabel: string;
  loadUnit: string;
  loadLabel: string;
  defaultStep: number;
  formatSet: (weight: number, repsOrMinutes: number) => string;
}

/**
 * Détermine si un exercice est un exercice basé sur la durée (en minutes),
 * exclusivement les activités cardio continues : tapis de course, vélo elliptique, vélo stationnaire et rameur.
 */
export function isDurationExercise(exercise?: {
  id?: string;
  name?: string;
  equipment_needed?: string;
}): boolean {
  if (!exercise) return false;
  const id = (exercise.id || '').toLowerCase();
  const name = (exercise.name || '').toLowerCase();
  const eq = (exercise.equipment_needed || '').toLowerCase();

  // Matériel purement cardio machine
  if (
    eq === 'tapis de course' ||
    eq === 'vélo elliptique' ||
    eq === 'velo elliptique' ||
    eq === 'rameur'
  ) {
    return true;
  }

  // Identifiants connus d'exercices d'endurance / cardio continu
  if (
    id === 'ex_treadmill' ||
    id === 'ex_running_outdoor' ||
    id === 'ex_walking_active' ||
    id === 'ex_walking_incline' ||
    id === 'ex_elliptical' ||
    id === 'ex_rower'
  ) {
    return true;
  }

  // Recherche textuelle stricte avec limites de mots (\b) pour éviter les collisions
  // (ex: "développé" contient "velo", mais \bvelo\b ne correspond pas à "développé")
  if (/\b(tapis|rameur|elliptique|spinning|biking)\b/i.test(name)) {
    return true;
  }
  if (/\b(v[ée]lo)\b/i.test(name)) {
    return true;
  }
  if (/\b(marche active|marche rapide|marche inclin[ée]e|course [àa] pied)\b/i.test(name)) {
    return true;
  }
  if (/\b(treadmill|elliptical|rower)\b/i.test(id)) {
    return true;
  }

  return false;
}

/**
 * Fournit les unités et libellés adaptés au matériel utilisé et au réglage kg/lbs.
 */
export function getExerciseUnitInfo(exercise?: {
  id?: string;
  name?: string;
  equipment_needed?: string;
}): ExerciseUnitInfo {
  if (isDurationExercise(exercise)) {
    const id = (exercise?.id || '').toLowerCase();
    const name = (exercise?.name || '').toLowerCase();

    let loadUnit = 'résist.';
    let loadLabel = 'RÉSIST.';

    if (
      id.includes('treadmill') ||
      id === 'ex_running_outdoor' ||
      name.includes('tapis') ||
      id === 'ex_walking_active' ||
      id === 'ex_walking_incline' ||
      /\b(marche active|marche rapide|marche inclin[ée]e|course [àa] pied)\b/i.test(name)
    ) {
      loadUnit = 'km/h';
      loadLabel = 'VITESSE';
    } else if (id.includes('rower') || name.includes('rameur')) {
      loadUnit = 'allure';
      loadLabel = 'ALLURE';
    } else if (
      id.includes('elliptical') ||
      /\b(v[ée]lo)\b/i.test(name) ||
      name.includes('elliptique')
    ) {
      loadUnit = 'résist.';
      loadLabel = 'RÉSIST.';
    }

    return {
      isDuration: true,
      isTimeBased: true,
      valueUnit: 'min',
      valueLabel: 'DURÉE',
      loadUnit,
      loadLabel,
      defaultStep: 1, // Pas de 1 minute
      formatSet: (load: number, minutes: number) => {
        if (load > 0) {
          return `${minutes} min @ ${load} ${loadUnit}`;
        }
        return `${minutes} min`;
      },
    };
  }

  let unit: 'kg' | 'lbs' = 'kg';
  try {
    unit = useSettingsStore.getState().weight_unit || 'kg';
  } catch {}

  return {
    isDuration: false,
    isTimeBased: false,
    valueUnit: 'reps',
    valueLabel: 'REPS',
    loadUnit: unit,
    loadLabel: `CHARGE (${unit.toUpperCase()})`,
    defaultStep: 1, // Pas de 1 rep
    formatSet: (weight: number, reps: number) => {
      if (weight > 0) {
        return `${reps} reps @ ${weight} ${unit}`;
      }
      return `${reps} reps`;
    },
  };
}

/**
 * Métadonnées visuelles pour chaque type d'équipement dans les Paramètres.
 */
export interface EquipmentMeta {
  key: Equipment;
  label: string;
  emoji: string;
  description: string;
}

export const EQUIPMENT_CATALOG_METADATA: EquipmentMeta[] = [
  {
    key: 'Sans matériel',
    label: 'Sans matériel (Au sol)',
    emoji: '🏠',
    description: 'Pompes, gainage, fentes, squats au poids du corps, crunchs, superman...',
  },
  {
    key: 'Haltères',
    label: 'Haltères',
    emoji: '🏋️',
    description: 'Paire d’haltères réglables ou fixes pour le haut et le bas du corps.',
  },
  {
    key: 'Barre',
    label: 'Barre & Poids (+ Cage)',
    emoji: '🏋️‍♂️',
    description: 'Barre droite, barre EZ et disques (Développé couché, Squat, Soulevé de terre).',
  },
  {
    key: 'Banc',
    label: 'Banc de musculation',
    emoji: '🛋️',
    description: 'Banc plat ou inclinable pour les développés, tirages et écartés.',
  },
  {
    key: 'Barre de traction',
    label: 'Barre de traction',
    emoji: '🚪',
    description: 'Barre fixe murale, sur porte ou intégrée au rack (Tractions, Relevé de jambes).',
  },
  {
    key: 'Barres parallèles',
    label: 'Barres parallèles (Dips)',
    emoji: '🥢',
    description: 'Station ou poignées de dips pour les pectoraux et triceps.',
  },
  {
    key: 'Poulie / Machine',
    label: 'Poulie / Câbles & Machines',
    emoji: '🏗️',
    description: 'Poulie haute et basse (Rack 900), presse, leg extension, leg curl.',
  },
  {
    key: 'Tapis de course',
    label: 'Tapis de course',
    emoji: '🏃',
    description: 'Machine de course à pied et de marche inclinée avec mesure en minutes.',
  },
  {
    key: 'Vélo elliptique',
    label: 'Vélo elliptique',
    emoji: '🚴',
    description: 'Appareil aérobie à faible impact articulaire avec mesure en minutes.',
  },
  {
    key: 'Corde à sauter',
    label: 'Corde à sauter',
    emoji: '🪢',
    description: 'Corde de vitesse pour l’échauffement, le cardio fractionné et les mollets.',
  },
  {
    key: 'Roue abdominale',
    label: 'Roue abdominale (Ab Wheel)',
    emoji: '🛞',
    description: 'Roulette pour les rollouts et le renforcement extrême du grand droit.',
  },
  {
    key: 'Élastique',
    label: 'Bandes élastiques',
    emoji: '🎗️',
    description: 'Bandes de résistance pour l’échauffement et l’assistance aux tractions.',
  },
  {
    key: 'Kettlebell',
    label: 'Kettlebell',
    emoji: '🔔',
    description: 'Poids sphérique pour les swings et mouvements fonctionnels.',
  },
];

/**
 * Vérifie si un exercice est compatible avec les équipements disponibles de l'utilisateur.
 */
export function isExerciseCompatibleWithEquipment(
  exercise: { equipment_needed?: string },
  availableEquipments?: string[]
): boolean {
  if (!availableEquipments || availableEquipments.length === 0) return true;
  if (availableEquipments.length >= EQUIPMENTS.length) return true;

  const eq = exercise.equipment_needed;
  // Sans matériel est toujours compatible
  if (!eq || eq === 'Sans matériel' || eq === 'Poids du corps') {
    return true;
  }

  return availableEquipments.includes(eq);
}

/**
 * Vérifie si un programme est compatible avec les équipements disponibles de l'utilisateur.
 * Un programme est compatible si TOUS ses exercices nécessitent du matériel dont dispose l'athlète.
 */
export function isProgramCompatibleWithEquipment(
  programExercises: { equipment_needed?: string }[],
  availableEquipments?: string[]
): boolean {
  if (!availableEquipments || availableEquipments.length === 0) return true;
  if (availableEquipments.length >= EQUIPMENTS.length) return true;
  if (!programExercises || programExercises.length === 0) return true;

  return programExercises.every((ex) =>
    isExerciseCompatibleWithEquipment(ex, availableEquipments)
  );
}

/**
 * Vérifie si un programme est compatible en utilisant sa chaîne d'équipements agrégée (ex: "Barre,Haltères").
 */
export function isProgramCompatibleByEquipmentString(
  program: { required_equipments?: string },
  availableEquipments?: string[]
): boolean {
  if (!availableEquipments || availableEquipments.length === 0) return true;
  if (availableEquipments.length >= EQUIPMENTS.length) return true;
  if (!program.required_equipments) return true;

  const requiredList = program.required_equipments.split(',').map((s) => s.trim());
  return requiredList.every((eq) => {
    if (!eq || eq === 'Sans matériel' || eq === 'Poids du corps') return true;
    return availableEquipments.includes(eq);
  });
}
