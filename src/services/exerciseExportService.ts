import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Exercise } from '../types';
import { getAllExercises } from '../database/exerciseRepository';
import { getDatabase } from '../database/db';
import { MUSCLE_GROUPS_INFO, BODY_ZONES, PreciseMuscle } from '../constants/muscles';
import {
  getExerciseGuide,
  saveCustomGuidesBatch,
  loadCustomGuides,
  ExerciseGuide,
} from './exerciseGuideService';
import seedData from '../database/seedData.json';

export interface PreciseMuscleSummary {
  id: string;
  name: string;
  anatomicalFocus: string;
  emoji: string;
}

export interface EnrichedExerciseData {
  id: string;
  name: string;
  description: string;
  target_muscle: string;
  equipment_needed: string;
  is_custom: number;
  zone: string;
  zone_id: string;
  precise_muscles: PreciseMuscleSummary[];
  is_duration: boolean;
  load_label: string;
  value_label: string;
  default_rest_seconds: number;
  guide: ExerciseGuide;
}

export interface ExerciseCatalogExport {
  app: 'Vitax';
  type: 'exercise_catalog';
  version: '1.0';
  exported_at: string;
  total_exercises: number;
  exercises: EnrichedExerciseData[];
}

/**
 * Détermine si un exercice repose sur la durée (secondes) ou sur les répétitions.
 */
function isDurationExercise(exercise: { name?: string; target_muscle?: string }): boolean {
  const target = exercise.target_muscle || '';
  const name = (exercise.name || '').toLowerCase();

  if (target === 'Cardio') return true;
  if (
    name.includes('planche') ||
    name.includes('gainage') ||
    name.includes('course') ||
    name.includes('marche') ||
    name.includes('corde à sauter') ||
    name.includes('rameur') ||
    name.includes('vélo') ||
    name.includes('chaise')
  ) {
    return true;
  }
  return false;
}

/**
 * Détermine le libellé de charge adapté à l'exercice.
 */
function getLoadLabel(exercise: { target_muscle?: string; equipment_needed?: string; name?: string }): string {
  const target = exercise.target_muscle || '';
  const equipment = exercise.equipment_needed || '';
  const name = (exercise.name || '').toLowerCase();

  if (target === 'Cardio') {
    if (name.includes('tapis') || name.includes('course') || name.includes('marche')) {
      return 'Vitesse (km/h)';
    }
    if (name.includes('vélo') || name.includes('rameur')) {
      return 'Résistance / Allure';
    }
    return 'Intensité';
  }

  if (equipment === 'Sans matériel' || equipment.includes('Barres parallèles') || equipment.includes('Barre de traction')) {
    return 'Lest additionnel (kg)';
  }

  return 'Charge (kg)';
}

/**
 * Détermine le temps de repos physiologique conseillé par défaut (en secondes).
 */
function getDefaultRestSeconds(exercise: { target_muscle?: string; name?: string; equipment_needed?: string }): number {
  const target = exercise.target_muscle || '';
  const name = (exercise.name || '').toLowerCase();

  // Mouvements polyarticulaires très lourds
  if (name.includes('squat') || name.includes('deadlift') || name.includes('soulevé de terre') || name.includes('couché')) {
    return 120;
  }

  // Petits muscles / abdos / cardio
  if (target === 'Abdominaux' || target === 'Cardio') {
    return 45;
  }

  if (target === 'Biceps' || target === 'Triceps') {
    return 60;
  }

  // Standard hypertrophie
  return 90;
}

/**
 * Récupère les muscles précis associés à un exercice depuis la cartographie anatomique.
 */
function getPreciseMusclesForExercise(id: string, targetMuscle: string): PreciseMuscleSummary[] {
  const groupInfo = MUSCLE_GROUPS_INFO[targetMuscle as keyof typeof MUSCLE_GROUPS_INFO];
  if (!groupInfo || !groupInfo.preciseMuscles) {
    return [];
  }

  const matches = groupInfo.preciseMuscles.filter(
    (pm: PreciseMuscle) => pm.exerciseIds && pm.exerciseIds.includes(id)
  );
  if (matches.length > 0) {
    return matches.map((m: PreciseMuscle) => ({
      id: m.id,
      name: m.name,
      anatomicalFocus: m.anatomicalFocus,
      emoji: m.emoji,
    }));
  }

  // Fallback si non explicitement listé : premier sous-muscle du groupe
  const fallback = groupInfo.preciseMuscles[0];
  if (fallback) {
    return [
      {
        id: fallback.id,
        name: fallback.name,
        anatomicalFocus: fallback.anatomicalFocus,
        emoji: fallback.emoji,
      },
    ];
  }

  return [];
}

/**
 * Enrichit un exercice brut avec l'intégralité de sa qualification biomécanique,
 * posturale, anatomique et sécuritaire.
 */
export function enrichExerciseData(exercise: Exercise): EnrichedExerciseData {
  const target = exercise.target_muscle || 'Corps Entier';
  const groupInfo = MUSCLE_GROUPS_INFO[target as keyof typeof MUSCLE_GROUPS_INFO];

  let zoneName = 'Haut du Corps';
  let zoneId = 'upper';

  if (groupInfo) {
    zoneId = groupInfo.zone;
    const foundZone = BODY_ZONES.find((z) => z.id === groupInfo.zone);
    if (foundZone) {
      zoneName = foundZone.name;
    }
  }

  const preciseMuscles = getPreciseMusclesForExercise(exercise.id, target);
  const isDuration = isDurationExercise(exercise);
  const loadLabel = getLoadLabel(exercise);
  const valueLabel = isDuration ? 'Durée (sec)' : 'Répétitions';
  const defaultRest = getDefaultRestSeconds(exercise);
  const guide = getExerciseGuide(exercise);

  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description || '',
    target_muscle: exercise.target_muscle,
    equipment_needed: exercise.equipment_needed,
    is_custom: exercise.is_custom || 0,
    zone: zoneName,
    zone_id: zoneId,
    precise_muscles: preciseMuscles,
    is_duration: isDuration,
    load_label: loadLabel,
    value_label: valueLabel,
    default_rest_seconds: defaultRest,
    guide,
  };
}

/**
 * Génère la liste complète des 106 exercices de Vitax qualifiés à 100%.
 */
export async function generateEnrichedExercises(): Promise<EnrichedExerciseData[]> {
  await loadCustomGuides();

  let rawList: Exercise[] = [];
  try {
    rawList = await getAllExercises();
  } catch (err) {
    console.warn('Impossible de charger depuis SQLite, repli sur seedData:', err);
  }

  if (!rawList || rawList.length === 0) {
    rawList = (seedData.exercises as Exercise[]) || [];
  }

  return rawList.map(enrichExerciseData);
}

/**
 * Déclenche le téléchargement du fichier JSON sur le navigateur Web.
 */
function downloadWebJson(fileName: string, jsonString: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporte l'intégralité du catalogue des exercices avec toutes leurs qualifications
 * au format JSON (compatible Web & Mobile).
 */
export async function exportExercisesToJson(): Promise<{
  success: boolean;
  total?: number;
  filePath?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    const list = await generateEnrichedExercises();
    const fileName = `vitax_exercices_qualifies_${new Date().toISOString().slice(0, 10)}.json`;

    const catalogExport: ExerciseCatalogExport = {
      app: 'Vitax',
      type: 'exercise_catalog',
      version: '1.0',
      exported_at: new Date().toISOString(),
      total_exercises: list.length,
      exercises: list,
    };

    const jsonString = JSON.stringify(catalogExport, null, 2);

    if (Platform.OS === 'web') {
      downloadWebJson(fileName, jsonString);
      return {
        success: true,
        total: list.length,
        fileName,
      };
    }

    // Plateformes mobiles natives (Android / iOS)
    const targetFile = new File(Paths.cache, fileName);
    if (targetFile.exists) {
      targetFile.delete();
    }
    targetFile.create();
    targetFile.write(jsonString);

    const shareAvailable = await Sharing.isAvailableAsync();
    if (shareAvailable) {
      await Sharing.shareAsync(targetFile.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Exporter les fiches d’exercices Vitax',
        UTI: 'public.json',
      });
    }

    return {
      success: true,
      total: list.length,
      filePath: targetFile.uri,
      fileName,
    };
  } catch (err: any) {
    console.error('Erreur export exercices:', err);
    return {
      success: false,
      error: err?.message || 'Échec de l’exportation du catalogue',
    };
  }
}

/**
 * Importe et met à jour les fiches d'exercices retravaillées depuis un fichier JSON.
 * Met à jour à la fois la table SQLite `exercises` et la base de guides d'exécution.
 */
export async function importExercisesFromJson(providedContent?: string): Promise<{
  success: boolean;
  total?: number;
  error?: string;
}> {
  try {
    let jsonContent = providedContent;

    if (!jsonContent) {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return { success: false, error: 'Opération annulée' };
      }

      const asset = pickerResult.assets[0];

      if (Platform.OS === 'web') {
        if ((asset as any).file && typeof (asset as any).file.text === 'function') {
          jsonContent = await (asset as any).file.text();
        } else if (asset.uri) {
          const res = await fetch(asset.uri);
          jsonContent = await res.text();
        }
      } else {
        const sourceFile = new File(asset.uri);
        jsonContent = await sourceFile.text();
      }
    }

    if (!jsonContent) {
      return { success: false, error: 'Fichier vide ou illisible' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      return { success: false, error: 'Format JSON invalide.' };
    }

    let rawExercises: any[] = [];
    if (Array.isArray(parsed)) {
      rawExercises = parsed;
    } else if (parsed && Array.isArray(parsed.exercises)) {
      rawExercises = parsed.exercises;
    } else {
      return {
        success: false,
        error: 'Structure de catalogue invalide : tableau "exercises" introuvable.',
      };
    }

    if (rawExercises.length === 0) {
      return { success: false, error: 'Aucun exercice trouvé dans le fichier.' };
    }

    const db = await getDatabase();
    const guidesToSave: Record<string, Partial<ExerciseGuide>> = {};
    let count = 0;

    for (const item of rawExercises) {
      if (!item || !item.id || !item.name || !item.target_muscle) {
        continue;
      }

      const id = String(item.id);
      const name = String(item.name);
      const desc = item.description !== undefined ? String(item.description) : '';
      const muscle = String(item.target_muscle);
      const equip = item.equipment_needed !== undefined ? String(item.equipment_needed) : 'Sans matériel';
      const isCustom = item.is_custom !== undefined ? Number(item.is_custom) : 0;

      // Upsert dans la table SQLite
      await db.runAsync(
        `INSERT OR REPLACE INTO exercises (id, name, description, target_muscle, equipment_needed, is_custom)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, desc, muscle, equip, isCustom]
      );

      // Si l'élément inclut une fiche guide enrichie (guide technique, posture, sécurité)
      if (item.guide && typeof item.guide === 'object') {
        const g = item.guide;
        guidesToSave[id] = {
          objectif: g.objectif || desc,
          chargeAdaptee: g.chargeAdaptee,
          position: g.position,
          posture: g.posture,
          completude: g.completude,
          niveauRisque: g.niveauRisque || 'Modéré',
          mentionRisque: g.mentionRisque,
          pointsAttention: Array.isArray(g.pointsAttention) ? g.pointsAttention : undefined,
        };
      }

      count++;
    }

    // Sauvegarde persistante des guides personnalisés
    if (Object.keys(guidesToSave).length > 0) {
      await saveCustomGuidesBatch(guidesToSave);
    }

    return {
      success: true,
      total: count,
    };
  } catch (err: any) {
    console.error('Erreur import catalogue exercices:', err);
    return {
      success: false,
      error: err?.message || 'Échec de l’importation du catalogue',
    };
  }
}
