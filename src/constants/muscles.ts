import { DifficultyLevel, MuscleGroup, Equipment, Exercise } from '../types';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Pectoraux',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Jambes',
  'Abdominaux',
  'Corps Entier',
  'Cardio',
];

export const EQUIPMENTS: Equipment[] = [
  'Sans matériel',
  'Barre de traction',
  'Barres parallèles',
  'Haltères',
  'Barre',
  'Banc',
  'Poulie / Machine',
  'Kettlebell',
  'Élastique',
  'Tapis de course',
  'Vélo elliptique',
  'Corde à sauter',
  'Roue abdominale',
];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'Débutant',
  'Intermédiaire',
  'Avancé',
];

export const MUSCLE_COLORS: Record<string, string> = {
  Pectoraux: '#EF4444',
  Dos: '#3B82F6',
  Épaules: '#F59E0B',
  Biceps: '#10B981',
  Triceps: '#8B5CF6',
  Jambes: '#EC4899',
  Abdominaux: '#14B8A6',
  'Corps Entier': '#FF5500',
  Cardio: '#06B6D4',
};

export type BodyZoneId = 'upper' | 'lower' | 'core' | 'cardio' | 'full';

export interface PreciseMuscle {
  id: string;
  name: string;
  anatomicalFocus: string;
  emoji: string;
  exerciseIds: string[];
}

export interface MuscleGroupInfo {
  name: MuscleGroup;
  zone: BodyZoneId;
  emoji: string;
  color: string;
  description: string;
  preciseMuscles: PreciseMuscle[];
  programIds: string[];
}

export interface BodyZoneInfo {
  id: BodyZoneId;
  name: string;
  emoji: string;
  subtitle: string;
  color: string;
  groups: MuscleGroup[];
}

export const BODY_ZONES: BodyZoneInfo[] = [
  {
    id: 'upper',
    name: 'Haut du Corps',
    emoji: '🦾',
    subtitle: 'Pectoraux, Dos, Épaules, Biceps & Triceps',
    color: '#3B82F6',
    groups: ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps'],
  },
  {
    id: 'lower',
    name: 'Bas du Corps',
    emoji: '🦵',
    subtitle: 'Quadriceps, Ischios, Fessiers & Mollets',
    color: '#EC4899',
    groups: ['Jambes'],
  },
  {
    id: 'core',
    name: 'Tronc & Abdos',
    emoji: '🧘',
    subtitle: 'Grand droit, Gainage profond & Transverse',
    color: '#14B8A6',
    groups: ['Abdominaux'],
  },
  {
    id: 'cardio',
    name: 'Cardio & Souffle',
    emoji: '🏃',
    subtitle: 'Tapis de course, Vélo elliptique, Rameur & HIIT',
    color: '#06B6D4',
    groups: ['Cardio'],
  },
  {
    id: 'full',
    name: 'Corps Entier (Full Body)',
    emoji: '⚡',
    subtitle: 'Mouvements polyarticulaires globaux',
    color: '#FF5500',
    groups: ['Corps Entier'],
  },
];

export const MUSCLE_GROUPS_INFO: Record<MuscleGroup, MuscleGroupInfo> = {
  Pectoraux: {
    name: 'Pectoraux',
    zone: 'upper',
    emoji: '🛡️',
    color: '#EF4444',
    description: 'Développement de la cage thoracique, de la masse pectorale et de la force de poussée.',
    programIds: [
      'prog_split_push',
      'prog_rack900_upper_pulleys',
      'prog_upper_bench_dumbbells',
      'prog_rack900_cables_only',
      'prog_full_body_no_equipment',
      'prog_bodyweight_upper_core',
    ],
    preciseMuscles: [
      {
        id: 'pec_upper',
        name: 'Haut des pectoraux',
        anatomicalFocus: 'Faisceau claviculaire • Poussée inclinée',
        emoji: '📐',
        exerciseIds: [
          'ex_incline_dumbbells',
          'ex_incline_barbell_press',
          'ex_cable_incline_bench_press',
          'ex_cable_incline_fly',
          'ex_cable_crossover_low_to_high',
          'ex_decline_pushups',
        ],
      },
      {
        id: 'pec_mid',
        name: 'Milieu & Masse sternale',
        anatomicalFocus: 'Faisceau sterno-costal • Poussée horizontale',
        emoji: '💥',
        exerciseIds: [
          'ex_bench_press',
          'ex_flat_dumbbell_press',
          'ex_pushups',
          'ex_diamond_pushups',
          'ex_cable_fly',
          'ex_cable_flat_bench_press',
          'ex_pin_press',
          'ex_dumbbell_pullover',
          'ex_dumbbell_fly',
        ],
      },
      {
        id: 'pec_lower',
        name: 'Bas des pectoraux',
        anatomicalFocus: 'Faisceau abdominal / costal • Dips & déclinaison',
        emoji: '🔻',
        exerciseIds: [
          'ex_dips',
          'ex_decline_bench_press',
          'ex_incline_pushups',
          'ex_cable_fly',
          'ex_cable_crossover_high_to_low',
        ],
      },
    ],
  },

  Dos: {
    name: 'Dos',
    zone: 'upper',
    emoji: '🦅',
    color: '#3B82F6',
    description: 'Largeur du grand dorsal, épaisseur des trapèzes et renforcement des lombaires.',
    programIds: [
      'prog_split_pull',
      'prog_rack900_upper_pulleys',
      'prog_rack900_cables_only',
      'prog_rack900_poulie_haute_pro',
      'prog_rack900_power_lower_pull',
      'prog_upper_bench_dumbbells',
      'prog_full_body_no_equipment',
      'prog_bodyweight_upper_core',
    ],
    preciseMuscles: [
      {
        id: 'back_lats',
        name: 'Grand dorsal (Largeur en V)',
        anatomicalFocus: 'Tirages verticaux, tractions & pull-over',
        emoji: '📐',
        exerciseIds: [
          'ex_lat_pulldown',
          'ex_cable_lat_pulldown_close_grip',
          'ex_cable_single_arm_lat_pulldown',
          'ex_cable_lat_pulldown_supinated',
          'ex_pullups',
          'ex_chinups',
          'ex_neutral_grip_pullups',
          'ex_straight_arm_pulldown',
          'ex_cable_rope_pullover',
        ],
      },
      {
        id: 'back_thickness',
        name: 'Trapèzes & Épaisseur',
        anatomicalFocus: 'Rowing horizontal, tirages coudes serrés',
        emoji: '🧱',
        exerciseIds: [
          'ex_barbell_row',
          'ex_seated_cable_row',
          'ex_cable_standing_row',
          'ex_cable_single_arm_row',
          'ex_cable_seated_single_arm_row',
          'ex_cable_chest_supported_row',
          'ex_cable_high_row',
          'ex_cable_scapular_pulldown',
          'ex_dumbbell_row',
          'ex_incline_dumbbell_row',
          'ex_tbar_row',
          'ex_shrugs_barbell',
        ],
      },
      {
        id: 'back_lower',
        name: 'Lombaires & Chaîne postérieure',
        anatomicalFocus: 'Érecteurs du rachis, stabilité vertébrale',
        emoji: '⚡',
        exerciseIds: [
          'ex_deadlift',
          'ex_rack_pull',
          'ex_superman',
          'ex_hyperextensions',
        ],
      },
    ],
  },

  Épaules: {
    name: 'Épaules',
    zone: 'upper',
    emoji: '🎯',
    color: '#F59E0B',
    description: 'Galbe 3D des épaules : faisceaux antérieur, latéral (largeur) et postérieur (posture).',
    programIds: [
      'prog_split_push',
      'prog_rack900_upper_pulleys',
      'prog_rack900_cables_only',
      'prog_upper_bench_dumbbells',
    ],
    preciseMuscles: [
      {
        id: 'shoulders_front',
        name: 'Deltoïde antérieur (Avant)',
        anatomicalFocus: 'Poussée verticale au-dessus de la tête',
        emoji: '⬆️',
        exerciseIds: [
          'ex_overhead_press',
          'ex_seated_dumbbell_press',
          'ex_seated_barbell_overhead_press',
          'ex_front_raise',
          'ex_cable_front_raise',
          'ex_behind_neck_press',
        ],
      },
      {
        id: 'shoulders_lateral',
        name: 'Deltoïde latéral (Largeur carrée)',
        anatomicalFocus: 'Abduction des bras, élévations haltères & poulie',
        emoji: '↔️',
        exerciseIds: [
          'ex_lateral_raise',
          'ex_cable_lateral_raise',
          'ex_cable_y_raise',
          'ex_cable_behind_back_lateral_raise',
        ],
      },
      {
        id: 'shoulders_rear',
        name: 'Deltoïde postérieur (Arrière & Posture)',
        anatomicalFocus: 'Face pull, ouverture scapulaire & santé d’épaule',
        emoji: '🏹',
        exerciseIds: [
          'ex_face_pull',
          'ex_cable_face_pull_rotation',
          'ex_rear_delt_fly',
          'ex_cable_rear_delt_fly',
          'ex_cable_rear_delt_cross_pulldown',
          'ex_cable_incline_rear_delt',
          'ex_chest_supported_rear_delt_fly',
        ],
      },
    ],
  },

  Biceps: {
    name: 'Biceps',
    zone: 'upper',
    emoji: '💪',
    color: '#10B981',
    description: 'Flexion du coude, supination et épaisseur du bras (biceps brachial et brachial antérieur).',
    programIds: [
      'prog_split_pull',
      'prog_rack900_upper_pulleys',
      'prog_rack900_cables_only',
      'prog_rack900_poulie_haute_pro',
      'prog_upper_bench_dumbbells',
    ],
    preciseMuscles: [
      {
        id: 'biceps_brachii',
        name: 'Biceps brachial (Pic & Supination)',
        anatomicalFocus: 'Chef court et long • Curls barre EZ, poulie et incliné',
        emoji: '🏔️',
        exerciseIds: [
          'ex_bicep_curl_bar',
          'ex_cable_bicep_curl',
          'ex_cable_ez_bar_curl',
          'ex_incline_curl',
          'ex_preacher_curl',
          'ex_concentration_curl',
          'ex_cable_single_arm_curl',
          'ex_cable_incline_curl',
          'ex_cable_concentration_curl',
          'ex_cable_hercules_curl',
          'ex_cable_lying_high_curl',
        ],
      },
      {
        id: 'biceps_brachialis',
        name: 'Brachial antérieur & Avant-bras',
        anatomicalFocus: 'Prise neutre marteau • Épaisseur latérale du bras',
        emoji: '🔨',
        exerciseIds: ['ex_hammer_curl', 'ex_cable_rope_hammer_curl'],
      },
    ],
  },

  Triceps: {
    name: 'Triceps',
    zone: 'upper',
    emoji: '⚡',
    color: '#8B5CF6',
    description: 'Extension du coude représentant 60% du volume du bras (chefs latéral, médial et long).',
    programIds: [
      'prog_split_push',
      'prog_rack900_upper_pulleys',
      'prog_rack900_cables_only',
      'prog_rack900_poulie_haute_pro',
    ],
    preciseMuscles: [
      {
        id: 'triceps_lateral_medial',
        name: 'Chefs latéral & médial (Fers à cheval)',
        anatomicalFocus: 'Extension coudes bas • Pushdown & Skull crushers',
        emoji: '🐎',
        exerciseIds: [
          'ex_tricep_pushdown',
          'ex_cable_rope_triceps_pushdown',
          'ex_skull_crushers',
          'ex_close_grip_bench',
          'ex_tricep_kickback',
          'ex_cable_single_arm_triceps',
          'ex_cable_reverse_single_arm_triceps',
          'ex_bench_dips',
        ],
      },
      {
        id: 'triceps_long_head',
        name: 'Chef long (Longue portion)',
        anatomicalFocus: 'Bras levés au-dessus de la tête • Étirement maximal',
        emoji: '📐',
        exerciseIds: [
          'ex_overhead_cable_triceps',
          'ex_cable_katana_extension',
          'ex_cable_seated_overhead_triceps',
          'ex_cable_lying_triceps_extension',
        ],
      },
    ],
  },

  Jambes: {
    name: 'Jambes',
    zone: 'lower',
    emoji: '🦵',
    color: '#EC4899',
    description: 'Puissance des cuisses, fessiers galbés et force explosive de l’ensemble du bas du corps.',
    programIds: [
      'prog_split_legs',
      'prog_rack900_power_lower_pull',
      'prog_rack900_fullbody',
      'prog_full_body_no_equipment',
      'prog_bodyweight_legs_hiit',
    ],
    preciseMuscles: [
      {
        id: 'quads',
        name: 'Quadriceps (Avant des cuisses)',
        anatomicalFocus: 'Extension du genou • Squat cage, presse et fentes',
        emoji: '⚡',
        exerciseIds: [
          'ex_squat',
          'ex_front_squat',
          'ex_bodyweight_squat',
          'ex_leg_press',
          'ex_leg_extension',
          'ex_walking_lunges',
          'ex_bulgarian_split_squat',
          'ex_barbell_bulgarian_split_squat',
          'ex_barbell_lunges',
          'ex_box_squat',
          'ex_cable_belt_squat',
        ],
      },
      {
        id: 'hamstrings',
        name: 'Ischio-jambiers & Chaîne postérieure',
        anatomicalFocus: 'Flexion de hanche • Soulevé de terre roumain',
        emoji: '🏹',
        exerciseIds: [
          'ex_romanian_deadlift',
          'ex_leg_curl',
          'ex_cable_standing_leg_curl',
          'ex_cable_pull_through',
          'ex_good_morning',
        ],
      },
      {
        id: 'glutes',
        name: 'Fessiers (Grand & Moyen fessier)',
        anatomicalFocus: 'Extension de hanche profonde • Squat, fentes, hip thrust',
        emoji: '🍑',
        exerciseIds: [
          'ex_hip_thrust',
          'ex_squat',
          'ex_walking_lunges',
          'ex_bodyweight_squat',
          'ex_barbell_lunges',
          'ex_barbell_bulgarian_split_squat',
          'ex_cable_glute_kickback',
          'ex_cable_donkey_kickback',
          'ex_cable_pull_through',
          'ex_cable_hip_abduction',
          'ex_cable_hip_adduction',
        ],
      },
      {
        id: 'calves',
        name: 'Mollets (Soléaire & Gastrocnémien)',
        anatomicalFocus: 'Extension de cheville • Élévations debout sur pointes',
        emoji: '🦶',
        exerciseIds: ['ex_calf_raise', 'ex_barbell_calf_raise'],
      },
    ],
  },

  Abdominaux: {
    name: 'Abdominaux',
    zone: 'core',
    emoji: '🍫',
    color: '#14B8A6',
    description: 'Ceinture abdominale, gainage du tronc et stabilité de la colonne vertébrale.',
    programIds: [
      'prog_split_legs',
      'prog_rack900_fullbody',
      'prog_rack900_cables_only',
      'prog_full_body_no_equipment',
      'prog_bodyweight_upper_core',
      'prog_bodyweight_legs_hiit',
    ],
    preciseMuscles: [
      {
        id: 'abs_rectus',
        name: 'Grand droit (Tablettes de chocolat)',
        anatomicalFocus: 'Flexion du buste & bassin • Crunch au sol, poulie et relevé suspendu',
        emoji: '🍫',
        exerciseIds: [
          'ex_floor_crunch',
          'ex_cable_crunch',
          'ex_cable_standing_crunch',
          'ex_hanging_leg_raise',
          'ex_ab_wheel',
          'ex_decline_bench_crunch',
          'ex_decline_bench_leg_raise',
        ],
      },
      {
        id: 'abs_transverse',
        name: 'Gainage profond, Obliques & Transverse',
        anatomicalFocus: 'Ventre plat et stabilisation posturale • Planche & Grimpeurs',
        emoji: '🧱',
        exerciseIds: [
          'ex_plank',
          'ex_mountain_climbers',
          'ex_russian_twist',
          'ex_cable_woodchopper',
          'ex_cable_kneeling_oblique_crunch',
          'ex_cable_pallof_press',
        ],
      },
    ],
  },

  'Corps Entier': {
    name: 'Corps Entier',
    zone: 'full',
    emoji: '🔥',
    color: '#FF5500',
    description: 'Sollicitation complète et coordonnée de toutes les chaînes musculaires.',
    programIds: [
      'prog_rack900_fullbody',
      'prog_full_body_no_equipment',
      'prog_bodyweight_upper_core',
      'prog_bodyweight_legs_hiit',
    ],
    preciseMuscles: [
      {
        id: 'full_synergy',
        name: 'Synergie polyarticulaire complète',
        anatomicalFocus: 'Tous groupes musculaires réunis pour un effort global',
        emoji: '🌐',
        exerciseIds: [
          'ex_squat',
          'ex_bodyweight_squat',
          'ex_bench_press',
          'ex_pushups',
          'ex_pullups',
          'ex_burpees',
          'ex_plank',
        ],
      },
    ],
  },
  Cardio: {
    name: 'Cardio',
    zone: 'cardio',
    emoji: '🏃',
    color: '#06B6D4',
    description: 'Capacité aérobie, dépense calorique et endurance cardiovasculaire sans point mort.',
    programIds: [
      'prog_cardio_hiit',
      'prog_cardio_endurance',
      'prog_cardio_low_impact',
      'prog_cardio_express',
      'prog_rack900_fullbody',
    ],
    preciseMuscles: [
      {
        id: 'treadmill_running',
        name: 'Tapis de course & Course',
        anatomicalFocus: 'Endurance aérobie, foulée et travail des mollets / cuisses',
        emoji: '🏃',
        exerciseIds: ['ex_running_outdoor', 'ex_treadmill', 'ex_jump_rope', 'ex_burpees'],
      },
      {
        id: 'elliptical_trainer',
        name: 'Vélo elliptique & Bas impact',
        anatomicalFocus: 'Cardio fluide complet sans choc articulaire',
        emoji: '🚴',
        exerciseIds: ['ex_elliptical', 'ex_rower'],
      },
      {
        id: 'cardio_hiit_burn',
        name: 'HIIT & Fractionné Brûle-Graisses',
        anatomicalFocus: 'Explosivité métabolique, intervalles intenses et sudation',
        emoji: '🔥',
        exerciseIds: ['ex_running_outdoor', 'ex_treadmill', 'ex_jump_rope', 'ex_burpees', 'ex_rower'],
      },
      {
        id: 'walking_cardio',
        name: 'Marche active & Inclinée',
        anatomicalFocus: 'Endurance à faible impact, activation fessiers et dépense calorique',
        emoji: '🚶',
        exerciseIds: ['ex_walking_active', 'ex_walking_incline', 'ex_farmers_walk'],
      },
    ],
  },
};

/**
 * Filtre les exercices selon un groupe musculaire et optionnellement un muscle précis
 */
export function filterExercisesByMuscleTarget(
  allExercises: Exercise[],
  muscleGroup?: MuscleGroup | string,
  preciseMuscleId?: string
): Exercise[] {
  if (!muscleGroup || muscleGroup === 'Tous') {
    return allExercises;
  }

  const groupInfo = MUSCLE_GROUPS_INFO[muscleGroup as MuscleGroup];
  if (!groupInfo) {
    return allExercises.filter(
      (e) => e.target_muscle.toLowerCase() === muscleGroup.toLowerCase()
    );
  }

  if (preciseMuscleId && preciseMuscleId !== 'all') {
    const sub = groupInfo.preciseMuscles.find((p) => p.id === preciseMuscleId);
    if (sub && sub.exerciseIds.length > 0) {
      return allExercises.filter((e) => sub.exerciseIds.includes(e.id));
    }
  }

  // Tous les exercices de ce groupe
  return allExercises.filter(
    (e) => e.target_muscle.toLowerCase() === muscleGroup.toLowerCase()
  );
}
