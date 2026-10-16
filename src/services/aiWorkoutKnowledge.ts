import { WorkoutTrainingType } from '../types/aiWorkout';
import { DifficultyLevel } from '../types';

/**
 * Matrice biomécanique des paramètres d'effort selon l'objectif sportif.
 */
export interface SportsScienceParameters {
  compoundSets: number;
  isolationSets: number;
  compoundReps: string;
  isolationReps: string;
  compoundRest: number;
  isolationRest: number;
  tempo: string;
  compoundRpe: string;
  isolationRpe: string;
  warmupTip: string;
  cooldownTip: string;
  rationale: string;
}

export function getSportsScienceParams(
  trainingType: WorkoutTrainingType,
  difficulty: DifficultyLevel
): SportsScienceParameters {
  const isBeginner = difficulty === 'Débutant';
  const isAdvanced = difficulty === 'Avancé';

  switch (trainingType) {
    case 'strength':
      return {
        compoundSets: isBeginner ? 3 : isAdvanced ? 5 : 4,
        isolationSets: isBeginner ? 2 : 3,
        compoundReps: isBeginner ? '5 reps' : '3-5 reps',
        isolationReps: '6-8 reps',
        compoundRest: isBeginner ? 150 : 210,
        isolationRest: 120,
        tempo: '2-1-X-0 (Phase excentrique contrôlée, explosion concentrique)',
        compoundRpe: isBeginner ? 'RPE 7.5' : 'RPE 8.5 - 9.5',
        isolationRpe: 'RPE 8',
        warmupTip:
          '5 min d’échauffement articulaire (épaules/hanches) suivi de 2 à 3 montées progressives en charge (ramp-up sans fatigue).',
        cooldownTip:
          'Retour au calme actif de 3-5 min avec décompression de la colonne vertébrale (suspension légère à la barre fixe).',
        rationale:
          'Optimisation du recrutement neuromusculaire et de la coordination intramusculaire via des charges lourdes et des temps de récupération complets.',
      };

    case 'hypertrophy':
      return {
        compoundSets: isBeginner ? 3 : 4,
        isolationSets: isBeginner ? 3 : 4,
        compoundReps: '8-10 reps',
        isolationReps: '10-12 reps',
        compoundRest: 90,
        isolationRest: 75,
        tempo: '3-0-1-0 (3 secondes de descente excentrique pour maximiser la tension mécanique)',
        compoundRpe: 'RPE 8',
        isolationRpe: 'RPE 8.5 - 9 (recherche de congestion et fatigue métabolique ciblée)',
        warmupTip:
          'Échauffement dynamique ciblé sur les rotateurs et l’amplitude articulaire des muscles ciblés.',
        cooldownTip:
          'Étirements passifs doux et respiration diaphragmatique pour abaisser le cortisol et favoriser la récupération.',
        rationale:
          'Combinaison éprouvée de tension mécanique sous étirement et de stress métabolique pour stimuler la synthèse des protéines contractiles.',
      };

    case 'hiit':
      return {
        compoundSets: isBeginner ? 3 : 4,
        isolationSets: isBeginner ? 3 : 4,
        compoundReps: '15 reps ou 40s',
        isolationReps: '15-20 reps ou 45s',
        compoundRest: isBeginner ? 45 : 30,
        isolationRest: 30,
        tempo: 'Rythme continu et soutenu sans temps mort au sommet',
        compoundRpe: 'RPE 8.5',
        isolationRpe: 'RPE 8',
        warmupTip:
          '5 min d’activation cardio progressive (montées de genoux, air squats, sautillements) pour élever la fréquence cardiaque à 65% FCM.',
        cooldownTip:
          'Marche lente et retour progressif de la fréquence cardiaque en dessous de 100 bpm avec respiration diaphragmatique profonde.',
        rationale:
          'Dépense calorique maximale et effet EPOC (surconsommation d’oxygène post-effort) : le travail dynamique à haute intensité avec des temps de repos courts (30s) optimise l’oxydation des graisses et maintient un métabolisme élevé pendant plusieurs heures après la séance.',
      };

    case 'endurance':
      return {
        compoundSets: 3,
        isolationSets: 3,
        compoundReps: '15-20 reps',
        isolationReps: '20-25 reps',
        compoundRest: 60,
        isolationRest: 45,
        tempo: '2-0-2-0 (Mouvement fluide en tempo régulier)',
        compoundRpe: 'RPE 7.5 - 8',
        isolationRpe: 'RPE 8',
        warmupTip:
          'Mobilisation articulaire globale et activation neuromusculaire légère.',
        cooldownTip:
          'Étirements légers et relâchement des groupes musculaires congestionnés.',
        rationale:
          'Développement de la capillarisation musculaire, de l’endurance locale des fibres lentes et du seuil lactique.',
      };

    case 'mobility':
      return {
        compoundSets: 3,
        isolationSets: 2,
        compoundReps: '8-10 reps lentes',
        isolationReps: '10-12 reps contrôlées',
        compoundRest: 60,
        isolationRest: 45,
        tempo: '4-2-2-1 (Descente très lente, pause isométrique d’étirement de 2s)',
        compoundRpe: 'RPE 6',
        isolationRpe: 'RPE 5-6',
        warmupTip:
          'Rotations articulaires contrôlées (CARs) pour lubrifier les capsules synoviales.',
        cooldownTip:
          'Postures d’ouverture thoracique et étirements des fléchisseurs de hanche.',
        rationale:
          'Amélioration de l’amplitude de mouvement active, renforcement des stabilisateurs profonds et prévention des déséquilibres posturaux.',
      };
  }
}

/**
 * Schéma JSON officiel (Structured Output) pour les modèles d'IA générative (Gemini / OpenAI).
 */
export const AI_WORKOUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Titre évocateur et motivant de la séance' },
    subtitle: { type: 'string', description: 'Sous-titre résumant le focus anatomique et l’intensité' },
    estimated_duration_minutes: { type: 'number', description: 'Durée totale estimée en minutes' },
    warmup_advice: { type: 'string', description: 'Protocole d’échauffement dynamique spécifique' },
    cooldown_advice: { type: 'string', description: 'Protocole de retour au calme et étirements' },
    sports_science_rationale: { type: 'string', description: 'Justification biomécanique et physiologique de l’ordonnancement' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom précis de l’exercice' },
          target_muscle: { type: 'string', description: 'Muscle principal ciblé' },
          equipment_needed: { type: 'string', description: 'Matériel nécessaire' },
          phase: {
            type: 'string',
            enum: ['warmup', 'compound', 'isolation', 'cooldown'],
            description: 'Phase biomécanique de l’exercice dans la séance',
          },
          sets: { type: 'number', description: 'Nombre de séries' },
          reps: { type: 'string', description: 'Répétitions cibles ou durée' },
          rest_seconds: { type: 'number', description: 'Temps de repos en secondes entre les séries' },
          tempo: { type: 'string', description: 'Tempo d’exécution (ex: 3-0-1-0)' },
          rpe: { type: 'string', description: 'Indice d’effort perçu (ex: RPE 8)' },
          execution_tip: { type: 'string', description: 'Consigne technique clé pour une forme optimale' },
          alternative_exercise: { type: 'string', description: 'Exercice de substitution équivalent' },
        },
        required: [
          'name',
          'target_muscle',
          'equipment_needed',
          'phase',
          'sets',
          'reps',
          'rest_seconds',
          'tempo',
          'rpe',
          'execution_tip',
          'alternative_exercise',
        ],
      },
    },
  },
  required: [
    'title',
    'subtitle',
    'estimated_duration_minutes',
    'warmup_advice',
    'cooldown_advice',
    'sports_science_rationale',
    'exercises',
  ],
};
