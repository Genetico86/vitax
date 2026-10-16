import {
  AIWorkoutGeneratorParams,
  GeneratedWorkoutPlan,
  GeneratedExercise,
  ExercisePhase,
  TargetFocus,
  TARGET_FOCUS_OPTIONS,
  TRAINING_TYPE_OPTIONS,
} from '../types/aiWorkout';
import { Exercise, MuscleGroup } from '../types';
import { getAllExercises } from '../database/exerciseRepository';
import { getAllGoals } from '../database/goalRepository';
import { createCustomProgram } from '../database/programRepository';
import { isExerciseCompatibleWithEquipment, isDurationExercise } from '../utils/exerciseUnits';
import { getSportsScienceParams, AI_WORKOUT_JSON_SCHEMA } from './aiWorkoutKnowledge';
import { useWorkoutSessionStore } from '../stores/workoutSessionStore';

export { AI_WORKOUT_JSON_SCHEMA };

/**
 * Mappe une zone ciblée vers ses groupes musculaires correspondants.
 */
function getMuscleGroupsForTarget(target: TargetFocus): MuscleGroup[] {
  switch (target) {
    case 'full_body':
      return ['Pectoraux', 'Dos', 'Jambes', 'Épaules', 'Abdominaux'];
    case 'upper_body':
      return ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps'];
    case 'lower_body':
      return ['Jambes', 'Abdominaux'];
    case 'push':
      return ['Pectoraux', 'Épaules', 'Triceps'];
    case 'pull':
      return ['Dos', 'Biceps', 'Épaules'];
    case 'legs':
      return ['Jambes'];
    case 'pecs_triceps':
      return ['Pectoraux', 'Triceps'];
    case 'dos_biceps':
      return ['Dos', 'Biceps'];
    case 'shoulders':
      return ['Épaules', 'Dos'];
    case 'glutes_hamstrings':
      return ['Jambes'];
    case 'abs_core':
      return ['Abdominaux', 'Dos'];
    case 'performance_goals':
      return ['Pectoraux', 'Dos', 'Jambes', 'Épaules', 'Triceps', 'Biceps', 'Abdominaux'];
  }
}

/**
 * Détermine si un exercice est un mouvement polyarticulaire lourd / majeur.
 */
function isMajorCompoundExercise(exercise: Exercise): boolean {
  const id = exercise.id.toLowerCase();
  const name = exercise.name.toLowerCase();

  return (
    id.includes('squat') ||
    id.includes('bench_press') ||
    id.includes('deadlift') ||
    id.includes('overhead_press') ||
    id.includes('barbell_row') ||
    id.includes('pullups') ||
    id.includes('chinups') ||
    id.includes('dips') ||
    id.includes('hip_thrust') ||
    id.includes('rack_pull') ||
    id.includes('pin_press') ||
    name.includes('développé') ||
    name.includes('squat') ||
    name.includes('traction') ||
    name.includes('rowing') ||
    name.includes('soulevé de terre')
  );
}

/**
 * Génère des consignes d'exécution technique précises adaptées à l'exercice.
 */
function getCoachingTipForExercise(exercise: Exercise): string {
  const id = exercise.id.toLowerCase();
  const name = exercise.name.toLowerCase();

  if (id.includes('bench') || name.includes('développé couché')) {
    return 'Scapulas rétractées et fixées dans le banc, pieds ancrés au sol. Trajectoire de barre légèrement en J.';
  }
  if (id.includes('squat') || name.includes('squat')) {
    return 'Pieds écartés largeur des épaules, genoux alignés avec la pointe des pieds. Buste fier, poids équilibré au milieu du pied.';
  }
  if (id.includes('deadlift') || name.includes('soulevé de terre') || id.includes('rack_pull')) {
    return 'Bassin basculé en antéversion, cage ouverte, barre collée aux tibias. Poussez dans le sol sans cambrer le bas du dos.';
  }
  if (id.includes('row') || name.includes('rowing')) {
    return 'Initiez le mouvement en tirant les coudes vers l’arrière, serrez les omoplates 1 seconde au sommet de la contraction.';
  }
  if (id.includes('pullup') || id.includes('chinup') || name.includes('traction') || id.includes('lat_pulldown')) {
    return 'Dépression scapulaire dès le départ : descendez les épaules avant de fléchir les bras, poitrine ouverte vers la barre.';
  }
  if (id.includes('overhead') || name.includes('développé militaire') || name.includes('développé assis')) {
    return 'Gainage abdominal et fessier serré pour éviter toute lordose lombaire. Poussez la tête légèrement en avant sous la barre.';
  }
  if (id.includes('curl') || name.includes('curl')) {
    return 'Coudes immobiles le long des côtes, aucun élan du bassin. Contrôlez la phase descendante en 3 secondes.';
  }
  if (id.includes('tricep') || name.includes('extension triceps') || id.includes('skull')) {
    return 'Verrouillez les coudes sans les écarter. Concentrez l’effort sur l’extension complète des avant-bras.';
  }
  if (id.includes('raise') || name.includes('élévation') || id.includes('rear_delt')) {
    return 'Poignets légèrement sous les coudes, trapèzes relâchés. Imaginez pousser les poids vers les murs extérieurs.';
  }
  if (id.includes('crunch') || id.includes('woodchopper') || id.includes('leg_raise')) {
    return 'Enroulez la colonne vertébrale sans tirer sur la nuque. Expirez profondément au point de contraction maximale.';
  }
  if (id.includes('plank') || name.includes('gainage')) {
    return 'Rétroversion légère du bassin, fessiers serrés et nombril aspiré vers la colonne vertébrale.';
  }
  if (id.includes('burpee') || name.includes('burpee')) {
    return 'Amortissez la descente sur la pointe des pieds, touchez le sol avec la poitrine, puis repoussez vivement avec extension complète et saut vertical.';
  }
  if (id.includes('mountain') || name.includes('mountain') || id.includes('climber')) {
    return 'Gainage solide en planche haute, ramenez alternativement les genoux vers la poitrine avec un tempo dynamique et constant.';
  }
  if (id.includes('lunge') || name.includes('fente')) {
    return 'Grand pas vers l’avant, genou arrière frôlant le sol à 90°, buste fier et poussée dynamique sur le talon avant.';
  }
  if (id.includes('jump_rope') || name.includes('corde')) {
    return 'Rebonds légers sur la pointe des pieds, coudes près du corps, rotation rapide du câble impulsée uniquement par les poignets.';
  }
  if (id.includes('farmers_walk') || name.includes('fermier')) {
    return 'Torse bombé, épaules tirées en arrière et abdominaux verrouillés. Marchez d’un pas assuré sans aucune oscillation latérale.';
  }
  return exercise.description || 'Contrôlez la trajectoire, maintenez une respiration coordonnée et évitez tout verrouillage articulaire brusque.';
}

/**
 * Détecte les exercices à haute intensité métabolique et forte dépense calorique (Brûlage de graisse / HIIT).
 */
function isMetabolicFatBurnExercise(exercise: Exercise): boolean {
  const id = exercise.id.toLowerCase();
  const name = exercise.name.toLowerCase();

  return (
    exercise.target_muscle === 'Cardio' ||
    id.includes('burpee') ||
    id.includes('mountain') ||
    id.includes('lunge') ||
    id.includes('squat') ||
    id.includes('pushups') ||
    id.includes('jump_rope') ||
    id.includes('farmers_walk') ||
    id.includes('rower') ||
    name.includes('burpee') ||
    name.includes('climber') ||
    name.includes('fente') ||
    name.includes('squat') ||
    name.includes('pompe') ||
    name.includes('corde') ||
    name.includes('fermier') ||
    name.includes('rameur')
  );
}

/**
 * Génère une routine d'assistance et de renfort des maillons faibles
 * pour améliorer la performance sur l'exercice ou l'objectif fixé sans
 * proposer uniquement l'exercice cible lui-même.
 */
function generatePerformanceAssistanceWorkoutPlan(
  params: AIWorkoutGeneratorParams,
  compatiblePool: Exercise[],
  sportsParams: any,
  targetExerciseCount: number
): {
  exercises: GeneratedExercise[];
  title: string;
  subtitle: string;
  warmupTip: string;
  cooldownTip: string;
  rationale: string;
} {
  const goalStr = (params.targetGoalExerciseName || '').toLowerCase().trim();
  const selectedList: GeneratedExercise[] = [];
  const usedExerciseIds = new Set<string>();

  const isBench =
    goalStr.includes('couché') ||
    goalStr.includes('bench') ||
    goalStr.includes('pec') ||
    goalStr.includes('poussée');
  const isSquat =
    goalStr.includes('squat') ||
    goalStr.includes('jambe') ||
    goalStr.includes('cuisse');
  const isDeadlift =
    goalStr.includes('deadlift') ||
    goalStr.includes('terre');
  const isPullups =
    goalStr.includes('traction') ||
    goalStr.includes('pullup') ||
    goalStr.includes('chinup') ||
    goalStr.includes('tirage');
  const isOverhead =
    goalStr.includes('militaire') ||
    goalStr.includes('overhead') ||
    goalStr.includes('épaule');
  const isDips =
    goalStr.includes('dips') ||
    goalStr.includes('pompe') ||
    goalStr.includes('bras');

  // Déterminer le libellé propre de l'objectif
  let resolvedGoalLabel = params.targetGoalExerciseName || 'Objectifs Fixés';
  if (!params.targetGoalExerciseName) {
    if (isBench) resolvedGoalLabel = 'Développé Couché';
    else if (isSquat) resolvedGoalLabel = 'Squat';
    else if (isDeadlift) resolvedGoalLabel = 'Soulevé de Terre';
    else if (isPullups) resolvedGoalLabel = 'Tractions';
    else if (isOverhead) resolvedGoalLabel = 'Développé Militaire';
    else if (isDips) resolvedGoalLabel = 'Dips / Poussée';
    else resolvedGoalLabel = 'Développé Couché / Force Générale';
  }

  const addExercise = (
    chosen: Exercise,
    phase: ExercisePhase,
    isCompound: boolean,
    customTip?: string
  ) => {
    usedExerciseIds.add(chosen.id);
    const isDuration = isDurationExercise(chosen);
    const sets = isCompound ? sportsParams.compoundSets : sportsParams.isolationSets;
    const reps = isDuration
      ? '15 min'
      : isCompound
      ? sportsParams.compoundReps
      : sportsParams.isolationReps;
    const rest = isCompound ? sportsParams.compoundRest : sportsParams.isolationRest;
    const rpe = isCompound ? sportsParams.compoundRpe : sportsParams.isolationRpe;

    const altCandidate = compatiblePool.find(
      (ex) => ex.id !== chosen.id && ex.target_muscle === chosen.target_muscle
    );

    selectedList.push({
      exercise_id: chosen.id,
      name: chosen.name,
      target_muscle: chosen.target_muscle,
      equipment_needed: chosen.equipment_needed,
      phase,
      sets,
      reps,
      rest_seconds: rest,
      tempo: sportsParams.tempo,
      rpe,
      execution_tip: customTip || getCoachingTipForExercise(chosen),
      alternative_exercise: altCandidate ? altCandidate.name : 'Variante haltère ou élastique',
    });
  };

  const pick = (
    predicate: (ex: Exercise) => boolean,
    phase: ExercisePhase,
    isCompound: boolean,
    customTip?: string
  ): boolean => {
    // Règle stricte : on évite l'exercice cible lui-même pour se concentrer sur l'assistance
    const candidates = compatiblePool.filter((ex) => {
      if (usedExerciseIds.has(ex.id)) return false;
      const isTargetItself =
        goalStr.length > 3 &&
        (ex.name.toLowerCase().includes(goalStr) ||
          (goalStr.includes('couché') && ex.id === 'ex_bench_press') ||
          (goalStr.includes('squat') && ex.id === 'ex_squat') ||
          (goalStr.includes('deadlift') && ex.id === 'ex_deadlift') ||
          (goalStr.includes('traction') && ex.id === 'ex_pullups'));
      if (isTargetItself && compatiblePool.length > 3) {
        return false;
      }
      return predicate(ex);
    });

    if (candidates.length === 0) {
      // Fallback
      const fallback = compatiblePool.filter(
        (ex) => !usedExerciseIds.has(ex.id) && predicate(ex)
      );
      if (fallback.length === 0) return false;
      const chosen = fallback[Math.floor(Math.random() * fallback.length)];
      addExercise(chosen, phase, isCompound, customTip);
      return true;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    addExercise(chosen, phase, isCompound, customTip);
    return true;
  };

  let rationale = '';
  let warmupAdvice = '';
  let cooldownAdvice = '';

  if (isSquat) {
    warmupAdvice = 'Échauffement articulaire dynamique des chevilles et des hanches, puis 2 séries légères de fentes unilatérales.';
    cooldownAdvice = 'Décompression lombaire légère et étirement doux des fléchisseurs de hanches et ischio-jambiers.';
    rationale = `Pour débloquer un palier au Squat, l'IA renforce spécifiquement les maillons faibles biomécaniques : surcharge progressive des quadriceps sans taxe rachidienne (presse), puissance de la chaîne postérieure au soulevé roumain pour éviter le « butt wink », et gainage pour rigidifier le tronc.`;

    // 1. Activation
    pick(
      (ex) => ex.id.includes('lunge') || ex.name.includes('fente') || ex.target_muscle === 'Jambes',
      'warmup',
      false,
      'Mobilité des hanches & activation unilatérale : stabilise le bassin pour un squat symétrique et puissant.'
    );

    // 2. Surcharge quadriceps sans compression lombaire
    pick(
      (ex) => ex.id.includes('leg_press') || ex.name.includes('presse') || ex.id.includes('squat'),
      'compound',
      true,
      'Surcharge mécanique pure des quadriceps sans comprimer les vertèbres pour franchir le point mort du squat.'
    );

    // 3. Chaîne postérieure / Ischios & fessiers
    pick(
      (ex) => ex.id.includes('romanian') || ex.name.includes('roumain') || ex.id.includes('deadlift'),
      'compound',
      true,
      'Chaîne postérieure : renforce les ischio-jambiers et fessiers pour propulser la sortie du trou.'
    );

    // 4. Extension de hanche / Fessiers
    pick(
      (ex) => ex.id.includes('hip_thrust') || ex.name.includes('thrust') || ex.target_muscle === 'Jambes',
      'isolation',
      false,
      'Verrouillage de hanche : renforce les fessiers pour la phase terminale du mouvement.'
    );

    // 5. Stabilité cheville / mollets
    if (selectedList.length < targetExerciseCount - 1) {
      pick(
        (ex) => ex.id.includes('calf') || ex.name.includes('mollet'),
        'isolation',
        false,
        'Stabilité de l’arche plantaire et cheville sous forte charge.'
      );
    }
  } else if (isDeadlift) {
    warmupAdvice = 'Activation neuro-musculaire des fessiers et ouverture des hanches, montées de genoux et gainage léger.';
    cooldownAdvice = 'Suspension passive à la barre pour décompresser les vertèbres lombaires et étirements des ischio-jambiers.';
    rationale = `Pour exploser votre maxi au Soulevé de Terre, la séance renforce l'endurance de préhension (grip), la fermeture puissante du bassin via les fessiers/ischios, et la densité du dos pour maintenir la barre collée aux jambes sans cambrer.`;

    // 1. Activation
    pick(
      (ex) => ex.id.includes('romanian') || ex.id.includes('thrust') || ex.target_muscle === 'Dos',
      'warmup',
      false,
      'Activation de la chaîne postérieure et proprioception du bassin.'
    );

    // 2. Épaisseur dorsale & verrouillage
    pick(
      (ex) => ex.id.includes('barbell_row') || ex.name.includes('rowing') || ex.target_muscle === 'Dos',
      'compound',
      true,
      'Verrouillage du grand dorsal : indispensable pour maintenir la barre plaquée contre le corps.'
    );

    // 3. Poussée des jambes / départ du sol
    pick(
      (ex) => ex.id.includes('leg_press') || ex.id.includes('squat') || ex.target_muscle === 'Jambes',
      'compound',
      true,
      'Impulsion initiale des jambes pour arracher la barre du sol sans surcharger les lombaires.'
    );

    // 4. Extension fessiers/ischios
    pick(
      (ex) => ex.id.includes('hip_thrust') || ex.id.includes('romanian') || ex.target_muscle === 'Jambes',
      'isolation',
      false,
      'Verrouillage terminal de hanche.'
    );

    // 5. Grip / Trapèzes
    if (selectedList.length < targetExerciseCount - 1) {
      pick(
        (ex) => ex.id.includes('farmers') || ex.id.includes('pullup') || ex.target_muscle === 'Dos',
        'isolation',
        false,
        'Force de préhension (grip) et maintien des épaules.'
      );
    }
  } else if (isPullups) {
    warmupAdvice = 'Décompression des épaules, rotation des poignets et activation du grand dorsal avec bras tendus.';
    cooldownAdvice = 'Étirement passif des dorsaux, triceps et pectoraux pour libérer la cage thoracique.';
    rationale = `Pour réussir plus de tractions ou progresser en charge lestée, l'IA active le grand dorsal par isolation, développe la force de flexion des coudes avec du curl marteau (brachial antérieur), et fortifie la rétraction scapulaire.`;

    // 1. Activation
    pick(
      (ex) => ex.id.includes('straight_arm') || ex.name.includes('pull-over') || ex.target_muscle === 'Dos',
      'warmup',
      false,
      'Isolation du grand dorsal : apprend à engager le dos sans tirer excessivement avec les biceps.'
    );

    // 2. Rétraction scapulaire horizontale
    pick(
      (ex) => ex.id.includes('seated_cable_row') || ex.name.includes('rowing') || ex.target_muscle === 'Dos',
      'compound',
      true,
      'Tirage horizontal : renforce le haut du dos pour passer le menton au-dessus de la barre.'
    );

    // 3. Antagoniste / Équilibre postural
    pick(
      (ex) => ex.id.includes('dips') || ex.id.includes('pushups') || ex.target_muscle === 'Pectoraux',
      'compound',
      true,
      'Équilibre postural : évite l’enroulement des épaules causé par un volume de tirage élevé.'
    );

    // 4. Brachial & fléchisseurs du coude
    pick(
      (ex) => ex.id.includes('hammer') || ex.name.includes('marteau') || ex.id.includes('curl'),
      'isolation',
      false,
      'Brachial antérieur : muscle clé pour le verrouillage du dernier tiers de la traction.'
    );

    // 5. Unilatéral dos
    if (selectedList.length < targetExerciseCount - 1) {
      pick(
        (ex) => ex.id.includes('dumbbell_row') || ex.name.includes('bûcheron'),
        'isolation',
        false,
        'Symétrie de tirage et élimination des déséquilibres gauche/droite.'
      );
    }
  } else if (isOverhead) {
    warmupAdvice = 'Échauffement minutieux de la coiffe des rotateurs avec face pull et rotations externes légères.';
    cooldownAdvice = 'Étirement des trapèzes, deltoïdes et triceps avec respiration profonde.';
    rationale = `Pour débloquer votre Développé Militaire, la séance renforce la stabilité de la ceinture scapulaire (face pull), augmente la puissance d'extension finale des triceps au-dessus de la tête et renforce le haut de poitrine.`;

    // 1. Activation
    pick(
      (ex) => ex.id.includes('face_pull') || ex.name.includes('face pull') || ex.target_muscle === 'Épaules',
      'warmup',
      false,
      'Stabilité scapulaire et coiffe des rotateurs pour sécuriser l’épaule sous barre lourde.'
    );

    // 2. Haut de poitrine & poussée
    pick(
      (ex) => ex.id.includes('incline') || ex.name.includes('incliné') || ex.target_muscle === 'Pectoraux',
      'compound',
      true,
      'Haut de poitrine : faisceau claviculaire d’assistance au développé vertical.'
    );

    // 3. Verrouillage triceps
    pick(
      (ex) => ex.id.includes('dips') || ex.id.includes('overhead_cable_triceps') || ex.target_muscle === 'Triceps',
      'compound',
      true,
      'Force de verrouillage au-dessus de la tête.'
    );

    // 4. Faisceau latéral
    pick(
      (ex) => ex.id.includes('lateral_raise') || ex.name.includes('élévation') || ex.target_muscle === 'Épaules',
      'isolation',
      false,
      'Volume et densité des deltoïdes latéraux.'
    );

    // 5. Triceps complémentaire
    if (selectedList.length < targetExerciseCount - 1) {
      pick(
        (ex) => ex.id.includes('tricep_pushdown') || ex.target_muscle === 'Triceps',
        'isolation',
        false,
        'Endurance et résistance tendineuse des coudes.'
      );
    }
  } else {
    // Par défaut : Développé couché / Bench press / Poussée
    warmupAdvice = '5 min de mobilisation articulaire des poignets/coudes/épaules, activation scapulaire et face pull léger.';
    cooldownAdvice = 'Ouverture de la cage thoracique, étirement des pectoraux et suspension légère pour décompresser les épaules.';
    rationale = `Pour faire progresser votre ${resolvedGoalLabel}, l’IA cible les maillons faibles limitants : le verrouillage des triceps (lockout), l'ancrage scapulaire par un dos épais et stable (rowing antagoniste), et la protection de la coiffe des rotateurs. Aucun doublon sur le mouvement de base, 100% de transfert direct de force.`;

    // 1. Activation
    pick(
      (ex) => ex.id.includes('face_pull') || ex.id.includes('cable_lateral') || ex.target_muscle === 'Épaules',
      'warmup',
      false,
      'Activation de la coiffe des rotateurs & rétraction scapulaire : stabilise l’épaule et renforce votre ancrage sur le banc.'
    );

    // 2. Verrouillage Triceps lourd (Lockout assistance)
    pick(
      (ex) => ex.id.includes('dips') || ex.id.includes('pushups') || ex.id.includes('skull_crushers') || ex.target_muscle === 'Triceps',
      'compound',
      true,
      'Verrouillage des triceps : renforce la 2ème moitié de poussée pour franchir le point d’arrêt du développé couché.'
    );

    // 3. Antagoniste & Plateforme scapulaire
    pick(
      (ex) => ex.id.includes('barbell_row') || ex.id.includes('seated_cable_row') || ex.target_muscle === 'Dos',
      'compound',
      true,
      'Assise scapulaire : un dos épais et compact fournit le socle indispensable pour pousser lourd sans déperdition de force.'
    );

    // 4. Hypertrophie d’assistance / Étirement
    pick(
      (ex) => ex.id.includes('incline') || ex.id.includes('cable_fly') || ex.target_muscle === 'Pectoraux',
      'isolation',
      false,
      'Amplitude et volume : étire et renforce les faisceaux musculaires sans surcharger les tendons de la barre fixe.'
    );

    // 5. Triceps complémentaire
    if (selectedList.length < targetExerciseCount - 1) {
      pick(
        (ex) => ex.id.includes('tricep_pushdown') || ex.id.includes('overhead_cable_triceps') || ex.target_muscle === 'Triceps',
        'isolation',
        false,
        'Force d’isolation des triceps pour une endurance de poussée maximale.'
      );
    }
  }

  // Compléter avec des exercices d'assistance si le quota n'est pas atteint
  while (selectedList.length < targetExerciseCount - 1) {
    const added = pick(
      (ex) => ex.target_muscle !== 'Cardio' && ex.target_muscle !== 'Abdominaux',
      'isolation',
      false
    );
    if (!added) break;
  }

  // Finisher : Gainage & transmission de force
  pick(
    (ex) => ex.id.includes('plank') || ex.target_muscle === 'Abdominaux' || ex.equipment_needed === 'Sans matériel',
    'cooldown',
    false,
    'Rigidité du tronc & caisson abdominal : optimise le transfert d’énergie et élimine toute déperdition de force.'
  );

  const title = `Séance IA : Boost Performance • ${resolvedGoalLabel.toUpperCase()}`;
  const subtitle = `Assistance & Points Faibles • ${params.durationMinutes} min • ${selectedList.length} exercices ciblés`;

  return {
    exercises: selectedList,
    title,
    subtitle,
    warmupTip: warmupAdvice,
    cooldownTip: cooldownAdvice,
    rationale,
  };
}

/**
 * MOTEUR D'EXPERTISE BIOMÉCANIQUE LOCAL (100% Hors-Ligne & Déterministe).
 * Garantit un respect absolu de la biomécanique, du matériel sélectionné,
 * et des règles scientifiques de séries/reps/repos sans aucune dépendance externe.
 */
export async function generateOfflineWorkoutPlan(
  params: AIWorkoutGeneratorParams,
  availableExercises: Exercise[]
): Promise<GeneratedWorkoutPlan> {
  const sportsParams = getSportsScienceParams(params.trainingType, params.difficulty);
  const targetGroups = getMuscleGroupsForTarget(params.targetFocus);

  // 1. Filtrer strictement selon le matériel sélectionné (zéro hallucination d'équipement)
  const compatiblePool = availableExercises.filter((ex) =>
    isExerciseCompatibleWithEquipment(ex, params.availableEquipments as string[])
  );

  if (compatiblePool.length === 0) {
    throw new Error(
      'Aucun exercice compatible avec votre sélection d’équipements. Veuillez cocher au moins un équipement dans vos paramètres.'
    );
  }

  // 2. Déterminer le nombre d'exercices selon la durée
  let targetExerciseCount = 5;
  if (params.durationMinutes <= 30) targetExerciseCount = 4;
  else if (params.durationMinutes <= 45) targetExerciseCount = 5;
  else if (params.durationMinutes <= 60) targetExerciseCount = 6;
  else targetExerciseCount = 7;

  // CAS PARTICULIER : BOOST PERFORMANCE SUR OBJECTIFS FIXÉS VIA EXERCICES D'ASSISTANCE
  if (params.targetFocus === 'performance_goals') {
    const perfPlan = generatePerformanceAssistanceWorkoutPlan(
      params,
      compatiblePool,
      sportsParams,
      targetExerciseCount
    );

    return {
      id: `ai_plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: perfPlan.title,
      subtitle: perfPlan.subtitle,
      targetFocus: params.targetFocus,
      trainingType: params.trainingType,
      difficulty: params.difficulty,
      estimated_duration_minutes: params.durationMinutes,
      warmup_advice: perfPlan.warmupTip,
      cooldown_advice: perfPlan.cooldownTip,
      sports_science_rationale: perfPlan.rationale,
      exercises: perfPlan.exercises,
      created_at: new Date().toISOString(),
      is_offline_generated: true,
    };
  }

  // 3. Ordonnancement biomécanique strict :
  // Phase 1 : Échauffement / Mouvement d'activation
  // Phase 2 : Mouvements polyarticulaires majeurs (heavy compound)
  // Phase 3 : Mouvements d'isolation & accessoires ciblés
  // Phase 4 : Retour au calme / Gainage profond

  const selectedList: GeneratedExercise[] = [];
  const usedExerciseIds = new Set<string>();

  // Helper pour trouver un exercice dans la sélection
  const pickExercise = (
    predicate: (ex: Exercise) => boolean,
    phase: ExercisePhase,
    isCompound: boolean
  ): boolean => {
    const candidates = compatiblePool.filter(
      (ex) => !usedExerciseIds.has(ex.id) && predicate(ex)
    );
    if (candidates.length === 0) return false;

    // Trier ou mélanger intelligemment
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    usedExerciseIds.add(chosen.id);

    // Trouver une alternative possible dans le pool compatible
    const altCandidate = compatiblePool.find(
      (ex) => ex.id !== chosen.id && ex.target_muscle === chosen.target_muscle
    );
    const alternativeName = altCandidate ? altCandidate.name : 'Variante au poids du corps ou élastique';

    const isDuration = isDurationExercise(chosen);
    const sets = isCompound ? sportsParams.compoundSets : sportsParams.isolationSets;
    const reps = isDuration
      ? '15 min'
      : isCompound
      ? sportsParams.compoundReps
      : sportsParams.isolationReps;
    const rest = isCompound ? sportsParams.compoundRest : sportsParams.isolationRest;
    const rpe = isCompound ? sportsParams.compoundRpe : sportsParams.isolationRpe;

    selectedList.push({
      exercise_id: chosen.id,
      name: chosen.name,
      target_muscle: chosen.target_muscle,
      equipment_needed: chosen.equipment_needed,
      phase,
      sets,
      reps,
      rest_seconds: rest,
      tempo: sportsParams.tempo,
      rpe,
      execution_tip: getCoachingTipForExercise(chosen),
      alternative_exercise: alternativeName,
    });
    return true;
  };

  const isFatBurn = params.trainingType === 'hiit';

  if (isFatBurn) {
    // === SÉQUENCE OPTIMISÉE BRÛLAGE DE GRAISSE / HIIT / CIRCUIT ===
    // 1. Activation cardio-musculaire progressive (poids du corps ou cardio léger)
    pickExercise(
      (ex) =>
        (ex.equipment_needed === 'Sans matériel' || ex.target_muscle === 'Cardio') &&
        (ex.id.includes('bodyweight_squat') ||
          ex.id.includes('walking_active') ||
          ex.id.includes('plank') ||
          ex.id.includes('squat') ||
          ex.target_muscle === 'Cardio'),
      'warmup',
      false
    );

    // 2. Mouvements polyarticulaires majeurs & métaboliques ciblés (recrutement musculaire massif)
    const compoundTargetCount = Math.min(2, Math.floor(targetExerciseCount / 2));
    for (let i = 0; i < compoundTargetCount; i++) {
      pickExercise(
        (ex) =>
          targetGroups.includes(ex.target_muscle as MuscleGroup) &&
          (isMajorCompoundExercise(ex) || isMetabolicFatBurnExercise(ex)),
        'compound',
        true
      );
    }

    // 3. Exercices métaboliques et fonctionnels pour maximiser la dépense calorique (EPOC)
    for (const group of targetGroups) {
      if (selectedList.length >= targetExerciseCount - 1) break;
      const addedMetabolic = pickExercise(
        (ex) => ex.target_muscle === group && isMetabolicFatBurnExercise(ex),
        'isolation',
        false
      );
      if (!addedMetabolic) {
        pickExercise((ex) => ex.target_muscle === group, 'isolation', false);
      }
    }

    // Si on a un focus Full Body et encore de la capacité, injecter des exercices métaboliques clés
    if (params.targetFocus === 'full_body' && selectedList.length < targetExerciseCount - 1) {
      pickExercise(
        (ex) =>
          ex.id.includes('burpee') ||
          ex.id.includes('mountain') ||
          ex.id.includes('walking_lunge') ||
          ex.id.includes('farmers_walk') ||
          ex.id.includes('jump_rope'),
        'compound',
        true
      );
    }

    // Compléter si nécessaire jusqu'au quota
    while (selectedList.length < targetExerciseCount - 1) {
      const added = pickExercise(
        (ex) =>
          targetGroups.includes(ex.target_muscle as MuscleGroup) ||
          isMetabolicFatBurnExercise(ex),
        'isolation',
        false
      );
      if (!added) break;
    }

    // 4. Finisher / Cooldown : Gainage dynamique ou retour au calme
    pickExercise(
      (ex) =>
        ex.id.includes('mountain') ||
        ex.id.includes('plank') ||
        ex.target_muscle === 'Abdominaux' ||
        ex.id.includes('walking_active') ||
        ex.equipment_needed === 'Sans matériel',
      'cooldown',
      false
    );
  } else {
    // === SÉQUENCE STANDARD (HYPERTROPHIE, FORCE, ENDURANCE, MOBILITÉ) ===
    // 1. Échauffement dynamique (Activation)
    pickExercise(
      (ex) =>
        ex.equipment_needed === 'Sans matériel' ||
        ex.target_muscle === 'Cardio' ||
        ex.id.includes('plank') ||
        ex.id.includes('squat'),
      'warmup',
      false
    );

    // 2. Mouvements polyarticulaires majeurs (2 exercices)
    const compoundTargetCount = Math.min(2, Math.floor(targetExerciseCount / 2));
    for (let i = 0; i < compoundTargetCount; i++) {
      pickExercise(
        (ex) =>
          targetGroups.includes(ex.target_muscle as MuscleGroup) &&
          isMajorCompoundExercise(ex),
        'compound',
        true
      );
    }

    // 3. Mouvements d'isolation & compléments ciblés
    for (const group of targetGroups) {
      if (selectedList.length >= targetExerciseCount - 1) break;
      pickExercise(
        (ex) => ex.target_muscle === group,
        'isolation',
        false
      );
    }

    // Si on n'a pas encore atteint le nombre cible, piocher dans les groupes cibles
    while (selectedList.length < targetExerciseCount - 1) {
      const added = pickExercise(
        (ex) => targetGroups.includes(ex.target_muscle as MuscleGroup),
        'isolation',
        false
      );
      if (!added) break;
    }

    // 4. Cooldown / Gainage final (Retour au calme)
    pickExercise(
      (ex) =>
        ex.target_muscle === 'Abdominaux' ||
        ex.id.includes('superman') ||
        ex.equipment_needed === 'Sans matériel',
      'cooldown',
      false
    );
  }

  // Titre et sous-titres évocateurs
  const targetMeta = TARGET_FOCUS_OPTIONS.find((t) => t.id === params.targetFocus);
  const trainingMeta = TRAINING_TYPE_OPTIONS.find((t) => t.id === params.trainingType);

  const title = `Séance IA : ${targetMeta ? targetMeta.label : 'Personnalisée'} • ${trainingMeta ? trainingMeta.badge : 'SPORT'}`;
  const subtitle = `${params.difficulty} • ${params.durationMinutes} min • ${selectedList.length} exercices calibrés`;

  return {
    id: `ai_plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title,
    subtitle,
    targetFocus: params.targetFocus,
    trainingType: params.trainingType,
    difficulty: params.difficulty,
    estimated_duration_minutes: params.durationMinutes,
    warmup_advice: sportsParams.warmupTip,
    cooldown_advice: sportsParams.cooldownTip,
    sports_science_rationale: sportsParams.rationale,
    exercises: selectedList,
    created_at: new Date().toISOString(),
    is_offline_generated: true,
  };
}

/**
 * GÉNÉRATEUR PRINCIPAL DE SÉANCE D'ENTRAÎNEMENT PAR IA.
 * Orchestre la génération (avec Structured Output si clé configurée, ou moteur biomécanique local).
 */
export async function generateWorkoutPlan(
  params: AIWorkoutGeneratorParams
): Promise<GeneratedWorkoutPlan> {
  const allExercises = await getAllExercises();

  // Si le focus est 'performance_goals' et qu'aucun exercice n'a été spécifié,
  // récupérer automatiquement le premier objectif actif de force/exercice de l'athlète
  if (params.targetFocus === 'performance_goals' && !params.targetGoalExerciseName) {
    try {
      const goals = await getAllGoals();
      const activeExerciseGoal =
        goals.find((g) => (g.category === 'exercise' || g.exercise_id) && !g.completed) ||
        goals.find((g) => g.category === 'exercise' || g.exercise_id);

      if (activeExerciseGoal) {
        params.targetGoalExerciseName =
          activeExerciseGoal.exercise_name || activeExerciseGoal.title;
        params.targetGoalId = activeExerciseGoal.id;
      }
    } catch (e) {
      console.warn('Impossible de charger les objectifs pour la génération:', e);
    }
  }

  // Pour garantir une robustesse à 100% et une exécution ultra-rapide sans latence ni dépendance réseau,
  // nous exploitons le moteur d'expertise biomécanique local, extensible avec des modèles distants.
  try {
    const plan = await generateOfflineWorkoutPlan(params, allExercises);
    return plan;
  } catch (err: any) {
    console.error('Erreur génération séance IA:', err);
    throw new Error(err.message || 'Impossible de générer la séance avec ces paramètres.');
  }
}

/**
 * DÉMARRAGE IMMÉDIAT DE LA SÉANCE GÉNÉRÉE DANS LE STORE VITAX.
 * Convertit le plan IA en session active 100% opérationnelle avec sets, reps et timers.
 */
export async function startGeneratedWorkout(plan: GeneratedWorkoutPlan): Promise<void> {
  const allExercises = await getAllExercises();
  const configuredExercises: {
    exercise: Exercise;
    sets: number;
    targetReps: number;
    restSeconds: number;
  }[] = [];

  for (const genEx of plan.exercises) {
    let matchedEx: Exercise | undefined;
    if (genEx.exercise_id) {
      matchedEx = allExercises.find((e) => e.id === genEx.exercise_id);
    }
    if (!matchedEx) {
      matchedEx = allExercises.find(
        (e) => e.name.toLowerCase() === genEx.name.toLowerCase()
      );
    }
    if (!matchedEx) {
      matchedEx = allExercises.find(
        (e) => e.target_muscle.toLowerCase() === genEx.target_muscle.toLowerCase()
      ) || allExercises[0];
    }

    // Extraire le nombre de répétitions cible
    let targetReps = 10;
    const match = genEx.reps.match(/\d+/);
    if (match) {
      targetReps = parseInt(match[0], 10);
    }

    configuredExercises.push({
      exercise: matchedEx,
      sets: genEx.sets,
      targetReps,
      restSeconds: genEx.rest_seconds,
    });
  }

  await useWorkoutSessionStore.getState().startCustomConfiguredWorkout(
    plan.title,
    configuredExercises
  );
}

/**
 * SAUVEGARDE DE LA SÉANCE IA COMME PROGRAMME DANS SQLITE.
 */
export async function saveGeneratedPlanAsProgram(
  plan: GeneratedWorkoutPlan
): Promise<string> {
  const allExercises = await getAllExercises();
  const progExercises: {
    exercise_id: string;
    default_sets: number;
    default_reps: number;
    rest_time_seconds: number;
  }[] = [];

  for (const genEx of plan.exercises) {
    let matchedId = genEx.exercise_id;
    if (!matchedId) {
      const found = allExercises.find(
        (e) => e.name.toLowerCase() === genEx.name.toLowerCase()
      );
      matchedId = found ? found.id : allExercises[0].id;
    }

    let defaultReps = 10;
    const match = genEx.reps.match(/\d+/);
    if (match) {
      defaultReps = parseInt(match[0], 10);
    }

    progExercises.push({
      exercise_id: matchedId,
      default_sets: genEx.sets,
      default_reps: defaultReps,
      rest_time_seconds: genEx.rest_seconds,
    });
  }

  const programId = await createCustomProgram({
    name: plan.title,
    description: `${plan.subtitle}\n\n🧬 Justification biomécanique :\n${plan.sports_science_rationale}\n\n🔥 Échauffement :\n${plan.warmup_advice}\n\n🧊 Retour au calme :\n${plan.cooldown_advice}`,
    difficulty_level: plan.difficulty,
    exercises: progExercises,
  });

  return programId;
}
