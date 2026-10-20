export type ExerciseBiomechanicCategory =
  | 'bench_press'
  | 'incline_press'
  | 'squat'
  | 'deadlift'
  | 'lat_pulldown'
  | 'pullups'
  | 'rowing'
  | 'overhead_press'
  | 'lateral_raise'
  | 'biceps_curl'
  | 'triceps_extension'
  | 'dips'
  | 'pushups'
  | 'cable_fly'
  | 'hip_thrust'
  | 'core_crunch'
  | 'hanging_leg_raise'
  | 'calf_raise'
  | 'running'
  | 'superman'
  | 'mountain_climber'
  | 'default_weights';

export interface ExerciseCheckpoint {
  icon: string;
  title: string;
  detail: string;
}

export interface BiomechanicsMetadata {
  id: ExerciseBiomechanicCategory;
  title: string;
  targetMuscleGroup: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  jointAngleInfo: {
    label: string;
    targetAngle: string;
  };
  trajectoryType: 'j_curve' | 'vertical' | 'arc' | 'horizontal' | 'diagonal';
  trajectoryLabel: string;
  checkpoints: ExerciseCheckpoint[];
  tempoCues: {
    eccentric: string;
    isometric: string;
    concentric: string;
    lockout: string;
  };
  breathing: {
    in: string;
    out: string;
  };
  colorTheme: {
    primary: string;
    secondary: string;
    glow: string;
    bg: string;
    accent: string;
  };
}

export interface MotionFrameState {
  progress: number; // 0.0 (départ/haut) à 1.0 (étirement maximal/bas)
  muscleTension: number; // 0.1 à 1.0 (intensité de l'effort)
  phase: 'eccentric' | 'isometric' | 'concentric' | 'lockout';
  phaseLabel: string;
  phaseIcon: string;
  breathingText: string;
  breathingIcon: string;
  isDescent: boolean;
}

/**
 * Calcul précis de la cinématique et de la courbe de tempo biomécanique
 * Cycle total de 80 frames (3.2s à 25 FPS) :
 * - 0 à 44 : Phase excentrique contrôlée (descente 1.8s)
 * - 45 à 54 : Point bas isométrique / étirement sans rebond (0.4s)
 * - 55 à 72 : Phase concentrique explosive (poussée 0.7s)
 * - 73 à 79 : Verrouillage & respiration au sommet (0.3s)
 */
export function computeMotionFrame(frameIndex: number): MotionFrameState {
  const normFrame = ((frameIndex % 80) + 80) % 80;

  if (normFrame < 45) {
    // Phase Excentrique (0 -> 1)
    // Easing quadratique doux (accélération puis freinage maîtrisé)
    const t = normFrame / 45;
    const progress = t * t * (3 - 2 * t);
    return {
      progress,
      muscleTension: 0.35 + progress * 0.35,
      phase: 'eccentric',
      phaseLabel: 'Descente Excentrique (Contrôle 2-3s)',
      phaseIcon: '⬇️',
      breathingText: 'Inspirez profondément & ouvrez la cage',
      breathingIcon: '🫁',
      isDescent: true,
    };
  } else if (normFrame < 55) {
    // Pause Isométrique au point bas (1.0)
    return {
      progress: 1.0,
      muscleTension: 0.85,
      phase: 'isometric',
      phaseLabel: 'Arrêt Isométrique (Zéro Rebond)',
      phaseIcon: '⏸️',
      breathingText: 'Bloquez le gainage abdominal',
      breathingIcon: '🛡️',
      isDescent: false,
    };
  } else if (normFrame < 73) {
    // Phase Concentrique (1 -> 0)
    // Explosion rapide
    const t = (normFrame - 55) / 18;
    const inv = 1 - t;
    const progress = inv * inv;
    return {
      progress,
      muscleTension: 0.7 + (1 - progress) * 0.3,
      phase: 'concentric',
      phaseLabel: 'Poussée Concentrique (Explosion 1s)',
      phaseIcon: '⬆️',
      breathingText: 'Expirez puissamment en poussant',
      breathingIcon: '💥',
      isDescent: false,
    };
  } else {
    // Verrouillage au sommet (0.0)
    return {
      progress: 0.0,
      muscleTension: 0.4,
      phase: 'lockout',
      phaseLabel: 'Verrouillage & Rétablissement',
      phaseIcon: '🔒',
      breathingText: 'Préparez l’inspiration suivante',
      breathingIcon: '🫁',
      isDescent: false,
    };
  }
}

/**
 * Détection experte de la catégorie biomécanique
 */
export function detectExerciseCategory(
  exerciseId = '',
  targetMuscle = ''
): ExerciseBiomechanicCategory {
  const id = exerciseId.toLowerCase();
  const muscle = targetMuscle.toLowerCase();

  // 1. Cardio strict
  if (
    muscle.includes('cardio') ||
    id === 'ex_running_outdoor' ||
    id === 'ex_treadmill' ||
    id === 'ex_walking_active' ||
    id === 'ex_walking_incline' ||
    id === 'ex_farmers_walk' ||
    id === 'ex_elliptical' ||
    id === 'ex_jump_rope' ||
    id === 'ex_rower' ||
    id === 'ex_burpees'
  ) {
    return 'running';
  }

  // 2. Superman & Mountain Climber
  if (id.includes('superman')) return 'superman';
  if (id.includes('mountain') || id.includes('climber')) return 'mountain_climber';

  // 3. Mollets
  if (id.includes('calf') || id.includes('mollet')) return 'calf_raise';

  // 4. Abdominaux : relevé de jambes / bassin
  if (
    id.includes('hanging') ||
    id.includes('leg_raise') ||
    id.includes('releve_jambes') ||
    id.includes('releve_bassin')
  ) {
    return 'hanging_leg_raise';
  }

  // 5. Abdominaux : crunch, rouleau, pallof, twist, woodchopper, planche
  if (
    muscle.includes('abdo') ||
    id.includes('crunch') ||
    id.includes('ab_wheel') ||
    id.includes('twist') ||
    id.includes('woodchopper') ||
    id.includes('pallof') ||
    id.includes('plank')
  ) {
    return 'core_crunch';
  }

  // 6. Dips
  if (id.includes('dips')) return 'dips';

  // 7. Pompes
  if (id.includes('pushup') || id.includes('pompe')) return 'pushups';

  // 8. Triceps (inclut close grip bench, kickback triceps, extensions corde/barre/katana)
  if (
    id.includes('tricep') ||
    id.includes('pushdown') ||
    id.includes('skull_crushers') ||
    id.includes('katana') ||
    id.includes('close_grip_bench') ||
    (muscle.includes('tricep') && !id.includes('dips'))
  ) {
    return 'triceps_extension';
  }

  // 9. Biceps (attention à ne pas attraper leg_curl)
  if (
    (id.includes('curl') && !id.includes('leg_curl')) ||
    muscle.includes('bicep')
  ) {
    return 'biceps_curl';
  }

  // 10. Deltoïdes postérieurs / oiseau / face pull / élévations
  if (
    id.includes('rear_delt') ||
    id.includes('oiseau') ||
    id.includes('face_pull') ||
    id.includes('lateral_raise') ||
    id.includes('front_raise') ||
    id.includes('y_raise') ||
    id.includes('pull_apart') ||
    ((muscle.includes('épaule') || muscle.includes('epaule')) &&
      (id.includes('elevation') || id.includes('raise') || id.includes('lateral')))
  ) {
    return 'lateral_raise';
  }

  // 11. Développé épaules (militaire, haltères assis, barre assis, nuque)
  if (
    (muscle.includes('épaule') || muscle.includes('epaule')) &&
    (id.includes('press') ||
      id.includes('overhead') ||
      id.includes('military') ||
      id.includes('nuque'))
  ) {
    return 'overhead_press';
  }

  // 12. Pectoraux : Écartés & Crossovers
  if (
    id.includes('fly') ||
    id.includes('crossover') ||
    id.includes('ecarte')
  ) {
    return 'cable_fly';
  }

  // 13. Pectoraux : Développé incliné
  if (
    (muscle.includes('pec') || id.includes('bench') || id.includes('chest')) &&
    id.includes('incline')
  ) {
    return 'incline_press';
  }

  // 14. Pectoraux : Développé couché / décliné / pin press / pull-over haltères
  if (
    muscle.includes('pec') ||
    id.includes('bench_press') ||
    id.includes('flat_bench') ||
    id.includes('flat_dumbbell_press') ||
    id.includes('pin_press') ||
    (id.includes('pullover') && muscle.includes('pec'))
  ) {
    return 'bench_press';
  }

  // 15. Fessiers : Hip Thrust, Kickback fessier, Abduction/Adduction hanche
  if (
    id.includes('hip_thrust') ||
    id.includes('glute_kickback') ||
    id.includes('donkey_kickback') ||
    id.includes('hip_abduction') ||
    id.includes('hip_adduction')
  ) {
    return 'hip_thrust';
  }

  // 16. Soulevé de terre & Charnière postérieure (Deadlift, Romanian, Pull-through, Good morning, Rack pull)
  if (
    id.includes('deadlift') ||
    id.includes('pull_through') ||
    id.includes('good_morning') ||
    id.includes('rack_pull')
  ) {
    return 'deadlift';
  }

  // 17. Jambes : Squat, Presse, Fentes (dont walking_lunges), Leg Extension, Leg Curl
  if (
    id.includes('squat') ||
    id.includes('leg_press') ||
    id.includes('lunge') ||
    id.includes('fente') ||
    id.includes('leg_extension') ||
    id.includes('leg_curl') ||
    id.includes('belt_squat') ||
    muscle.includes('jambe')
  ) {
    return 'squat';
  }

  // 18. Tractions
  if (id.includes('pullup') || id.includes('chinup') || id.includes('traction')) {
    return 'pullups';
  }

  // 19. Tirage vertical dos & Pull-over poulie haute dos
  if (
    id.includes('pulldown') ||
    id.includes('lat_pulldown') ||
    id.includes('straight_arm') ||
    id.includes('scapular_pulldown') ||
    (id.includes('pullover') && muscle.includes('dos'))
  ) {
    return 'lat_pulldown';
  }

  // 20. Rowing & Tirages horizontaux dos
  if (
    id.includes('row') ||
    id.includes('shrug') ||
    id.includes('hyperextension') ||
    muscle.includes('dos')
  ) {
    return 'rowing';
  }

  return 'default_weights';
}

/**
 * Métadonnées biomécaniques expertes par mouvement
 */
export function getBiomechanicsMetadata(
  category: ExerciseBiomechanicCategory,
  exerciseName?: string
): BiomechanicsMetadata {
  switch (category) {
    case 'bench_press':
      return {
        id: 'bench_press',
        title: exerciseName || 'Développé Couché',
        targetMuscleGroup: 'Pectoraux',
        primaryMuscles: ['Grand pectoral (faisceau moyen & sternal)'],
        secondaryMuscles: ['Deltoïdes antérieurs', 'Triceps brachial'],
        jointAngleInfo: {
          label: 'Coudes à 45°',
          targetAngle: '45°- 60° (Évite le conflit d’épaule)',
        },
        trajectoryType: 'j_curve',
        trajectoryLabel: 'Trajectoire en J : Clavicules ➔ Bas des pectoraux',
        checkpoints: [
          {
            icon: '📐',
            title: 'Coudes rentrés à 45°',
            detail: 'Évitez les coudes ouverts à 90° qui écrasent la coiffe des rotateurs.',
          },
          {
            icon: '🛡️',
            title: 'Omoplates rétractées & abaissées',
            detail: 'Plaquez le haut du dos sur le banc pour créer une base d’appui stable.',
          },
          {
            icon: '🎯',
            title: 'Point de contact sternal',
            detail: 'Effleurez le bas de la poitrine sous les mamelons sans aucun rebond.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente freinée 2-3 secondes',
          isometric: 'Pause 1 seconde sur la poitrine',
          concentric: 'Poussée explosive vers les yeux',
          lockout: 'Bras tendus sans claquer les coudes',
        },
        breathing: {
          in: 'Inspirez profondément au début de la descente',
          out: 'Expirez à la fin de la poussée en passant le point dur',
        },
        colorTheme: {
          primary: '#FF5500',
          secondary: '#EF4444',
          glow: '#FFA07A',
          bg: '#1F1215',
          accent: '#FF5500',
        },
      };

    case 'incline_press':
      return {
        id: 'incline_press',
        title: exerciseName || 'Développé Incliné',
        targetMuscleGroup: 'Pectoraux',
        primaryMuscles: ['Haut des pectoraux (faisceau claviculaire)'],
        secondaryMuscles: ['Deltoïdes antérieurs', 'Triceps'],
        jointAngleInfo: {
          label: 'Banc incliné à 30°',
          targetAngle: '30° (Angle optimal haut de pecs)',
        },
        trajectoryType: 'diagonal',
        trajectoryLabel: 'Trajectoire vers les clavicules',
        checkpoints: [
          {
            icon: '📐',
            title: 'Inclinaison max 30°',
            detail: 'Au-delà de 30-40°, le travail bascule entièrement sur les deltoïdes.',
          },
          {
            icon: '🎯',
            title: 'Convergence naturelle',
            detail: 'Rapprochez légèrement les haltères au sommet sans les entrechoquer.',
          },
          {
            icon: '🛡️',
            title: 'Poitrine sortie',
            detail: 'Gardez la cage thoracique haute tout au long du mouvement.',
          },
        ],
        tempoCues: {
          eccentric: 'Contrôle précis de l’écartement',
          isometric: 'Pause en bas pour étirer les fibres hautes',
          concentric: 'Poussée verticale légèrement diagonale',
          lockout: 'Contraction maximale des claviculaires',
        },
        breathing: {
          in: 'Inspirez à la descente en ouvrant la cage',
          out: 'Expirez vigoureusement à la montée',
        },
        colorTheme: {
          primary: '#FF6B00',
          secondary: '#DC2626',
          glow: '#FF8A48',
          bg: '#211316',
          accent: '#FF6B00',
        },
      };

    case 'squat':
      return {
        id: 'squat',
        title: exerciseName || 'Squat Arrière',
        targetMuscleGroup: 'Jambes',
        primaryMuscles: ['Quadriceps', 'Grand fessier'],
        secondaryMuscles: ['Ischio-jambiers', 'Érecteurs du rachis', 'Abdominaux'],
        jointAngleInfo: {
          label: 'Genoux à 90° / Parallèle',
          targetAngle: 'Creux de hanche sous la rotule',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Trajectoire laser verticale au-dessus du médio-pied',
        checkpoints: [
          {
            icon: '🦶',
            title: 'Barre au-dessus du milieu du pied',
            detail: 'La barre doit monter et descendre en ligne droite parfaite sans bascule.',
          },
          {
            icon: '🦴',
            title: 'Dos droit & colonne neutre',
            detail: 'Engagez les abdos (valsalva) pour bannir tout arrondi du bas du dos (butt-wink).',
          },
          {
            icon: '🦵',
            title: 'Genoux dans l’axe des orteils',
            detail: 'Poussez les genoux vers l’extérieur pour ouvrir le bassin et stabiliser.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente contrôlée hanches d’abord',
          isometric: 'Arrêt net à la parallèle',
          concentric: 'Poussée écrasant les talons dans le sol',
          lockout: 'Verrouillage hanches & fessiers',
        },
        breathing: {
          in: 'Inspirez et bloquez l’air dans le ventre avant de descendre',
          out: 'Expirez en franchissant le cap difficile de la remontée',
        },
        colorTheme: {
          primary: '#EC4899',
          secondary: '#BE185D',
          glow: '#F472B6',
          bg: '#22111E',
          accent: '#EC4899',
        },
      };

    case 'deadlift':
      return {
        id: 'deadlift',
        title: exerciseName || 'Soulevé de Terre',
        targetMuscleGroup: 'Dos & Ischios',
        primaryMuscles: ['Ischio-jambiers', 'Grand fessier', 'Érecteurs du rachis'],
        secondaryMuscles: ['Trapèzes', 'Grand dorsal', 'Avant-bras'],
        jointAngleInfo: {
          label: 'Charnière de hanche',
          targetAngle: 'Hanches entre genoux et épaules',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Trajectoire verticale collée aux tibias',
        checkpoints: [
          {
            icon: '📏',
            title: 'Barre au contact du corps',
            detail: 'La barre doit frôler les tibias puis les cuisses pour préserver les lombaires.',
          },
          {
            icon: '🛡️',
            title: 'Bras tendus comme des câbles',
            detail: 'Ne fléchissez jamais les coudes (risque de déchirure du biceps).',
          },
          {
            icon: '💥',
            title: 'Poussez le sol avec les jambes',
            detail: 'Pensez à « pousser la Terre » avec les talons au démarrage, pas à tirer avec le dos.',
          },
        ],
        tempoCues: {
          eccentric: 'Charnière de hanche arrière sans plier prématurément les genoux',
          isometric: 'Contact avec le sol sans rebond',
          concentric: 'Poussée jambes puis verrouillage bassin',
          lockout: 'Debout fier, fessiers contractés sans hyperextension',
        },
        breathing: {
          in: 'Grand volume d’air emmagasiné au départ pour gainer la ceinture',
          out: 'Expirez une fois la position verticale verrouillée',
        },
        colorTheme: {
          primary: '#06B6D4',
          secondary: '#3B82F6',
          glow: '#38BDF8',
          bg: '#0F1E2E',
          accent: '#06B6D4',
        },
      };

    case 'lat_pulldown':
    case 'pullups':
      return {
        id: category,
        title: exerciseName || (category === 'pullups' ? 'Tractions' : 'Tirage Poitrine'),
        targetMuscleGroup: 'Dos',
        primaryMuscles: ['Grand dorsal (V-Taper)'],
        secondaryMuscles: ['Grand rond', 'Biceps brachial', 'Trapèzes inférieurs'],
        jointAngleInfo: {
          label: 'Tirage coudes en bas',
          targetAngle: 'Coudes ramenés vers les poches arrière',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Trajectoire vers la partie supérieure du thorax',
        checkpoints: [
          {
            icon: '🦅',
            title: 'Abaissement des omoplates d’abord',
            detail: 'Initiez toujours le tirage en tirant les épaules vers le bas avant les bras.',
          },
          {
            icon: '🎯',
            title: 'Coudes tirés vers les côtes',
            detail: 'Visualisez vos coudes qui descendent dans le sol, pas vos mains.',
          },
          {
            icon: '🫁',
            title: 'Poitrine fière & bombée',
            detail: 'Arquez légèrement le haut du dos pour maximiser le recrutement du grand dorsal.',
          },
        ],
        tempoCues: {
          eccentric: 'Remontée contrôlée pour étirer le grand dorsal',
          isometric: 'Pause d’une seconde menton/barre à hauteur de clavicule',
          concentric: 'Tirage explosif focalisé sur les coudes',
          lockout: 'Bras presque tendus sans décrocher les épaules',
        },
        breathing: {
          in: 'Inspirez lors de la phase d’étirement bras hauts',
          out: 'Expirez vigoureusement en tirant la charge vers la poitrine',
        },
        colorTheme: {
          primary: '#0EA5E9',
          secondary: '#2563EB',
          glow: '#60A5FA',
          bg: '#0C1B2E',
          accent: '#0EA5E9',
        },
      };

    case 'rowing':
      return {
        id: 'rowing',
        title: exerciseName || 'Rowing Buste Penché',
        targetMuscleGroup: 'Dos',
        primaryMuscles: ['Épaisseur du dos (Rhomboïdes, Trapèzes moyens, Grand dorsal)'],
        secondaryMuscles: ['Arrière d’épaules', 'Biceps', 'Lombaires'],
        jointAngleInfo: {
          label: 'Buste à 45°',
          targetAngle: '45° avec colonne rigide',
        },
        trajectoryType: 'diagonal',
        trajectoryLabel: 'Trajectoire en arc vers le nombril',
        checkpoints: [
          {
            icon: '📐',
            title: 'Tirage vers le bas-ventre',
            detail: 'Tirez la barre vers le nombril plutôt que vers la poitrine pour engager le dos.',
          },
          {
            icon: '🛡️',
            title: 'Dos verrouillé droit',
            detail: 'Pliez légèrement les genoux et gardez les fesses en arrière sans courber la nuque.',
          },
          {
            icon: '💥',
            title: 'Serrez les omoplates au sommet',
            detail: 'Maintenez la contraction 1 seconde pour écraser la musculature du haut du dos.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente freinée jusqu’aux bras tendus',
          isometric: 'Contraction de pointe au nombril',
          concentric: 'Tirage puissant guidé par les coudes',
          lockout: 'Étirement complet sans relâcher les lombaires',
        },
        breathing: {
          in: 'Inspirez au relâchement des bras',
          out: 'Expirez en ramenant la barre au ventre',
        },
        colorTheme: {
          primary: '#06B6D4',
          secondary: '#0284C7',
          glow: '#38BDF8',
          bg: '#0D212E',
          accent: '#06B6D4',
        },
      };

    case 'overhead_press':
      return {
        id: 'overhead_press',
        title: exerciseName || 'Développé Militaire',
        targetMuscleGroup: 'Épaules',
        primaryMuscles: ['Deltoïdes antérieurs & latéraux'],
        secondaryMuscles: ['Triceps', 'Haut des pectoraux', 'Abdominaux'],
        jointAngleInfo: {
          label: 'Verrouillage vertical',
          targetAngle: 'Barre au-dessus des talons',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Trajectoire verticale passant devant le menton',
        checkpoints: [
          {
            icon: '🚪',
            title: 'Passez la tête sous la barre',
            detail: 'Dès que la barre dépasse le front, avancez légèrement la tête pour verrouiller au-dessus.',
          },
          {
            icon: '🛡️',
            title: 'Fessiers et abdos serrés',
            detail: 'Verrouillez le bassin pour empêcher toute cambrure excessive des lombaires.',
          },
          {
            icon: '📏',
            title: 'Avant-bras verticaux sous la barre',
            detail: 'Gardez les poignets et coudes parfaitement alignés pour maximiser la force.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente contrôlée jusqu’aux clavicules',
          isometric: 'Pose délicate sans relâcher la tension',
          concentric: 'Poussée purement verticale vers le ciel',
          lockout: 'Bras tendus avec deltoïdes hauts',
        },
        breathing: {
          in: 'Inspirez et bloquez en bas',
          out: 'Expirez une fois la barre au-dessus de la tête',
        },
        colorTheme: {
          primary: '#F59E0B',
          secondary: '#D97706',
          glow: '#FCD34D',
          bg: '#251D12',
          accent: '#F59E0B',
        },
      };

    case 'lateral_raise':
      return {
        id: 'lateral_raise',
        title: exerciseName || 'Élévations Latérales',
        targetMuscleGroup: 'Épaules',
        primaryMuscles: ['Deltoïdes latéraux (Largeur d’épaules)'],
        secondaryMuscles: ['Trapèzes supérieurs', 'Sus-épineux'],
        jointAngleInfo: {
          label: 'Plan scapulaire 30°',
          targetAngle: 'Bras légèrement avancés de 30°',
        },
        trajectoryType: 'arc',
        trajectoryLabel: 'Arc de cercle jusqu’à l’horizontale',
        checkpoints: [
          {
            icon: '📐',
            title: 'Plan scapulaire (30° en avant)',
            detail: 'Levez les bras légèrement en avant du buste, pas sur les côtés stricts pour ménager l’épaule.',
          },
          {
            icon: '🧊',
            title: 'Trapèzes relâchés',
            detail: 'Baissez les épaules : imaginez que vous versez une bouteille d’eau au sommet.',
          },
          {
            icon: '✋',
            title: 'Coudes meneurs',
            detail: 'Ce sont les coudes qui montent en premier, les mains restent au même niveau.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente lente sur 3 secondes',
          isometric: 'Maintien 1 seconde à hauteur d’épaule',
          concentric: 'Montée dynamique sans à-coup du buste',
          lockout: 'Contraction pure du deltoïde latéral',
        },
        breathing: {
          in: 'Inspirez à la redescente',
          out: 'Expirez à la montée latérale',
        },
        colorTheme: {
          primary: '#F59E0B',
          secondary: '#B45309',
          glow: '#FBBF24',
          bg: '#241B10',
          accent: '#F59E0B',
        },
      };

    case 'biceps_curl':
      return {
        id: 'biceps_curl',
        title: exerciseName || 'Curl Biceps',
        targetMuscleGroup: 'Biceps',
        primaryMuscles: ['Biceps brachial (Court & long chef)'],
        secondaryMuscles: ['Brachial antérieur', 'Brachioradial'],
        jointAngleInfo: {
          label: 'Coudes fixés aux flancs',
          targetAngle: 'Pivot fixe sans balancier',
        },
        trajectoryType: 'arc',
        trajectoryLabel: 'Arc de cercle pur autour du pivot du coude',
        checkpoints: [
          {
            icon: '📌',
            title: 'Coudes cloués aux côtes',
            detail: 'Ne laissez pas les coudes avancer pour engager les épaules : isolez le biceps.',
          },
          {
            icon: '🛑',
            title: 'Zéro élan du buste',
            detail: 'Restez gainé sans balancer le dos en arrière pour soulever la charge.',
          },
          {
            icon: '💥',
            title: 'Supination complète',
            detail: 'Tournez les paumes vers le haut au sommet pour recruter le pic du biceps.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente contrôlée 3s avec étirement',
          isometric: 'Pic de contraction 1s en haut',
          concentric: 'Flexion dynamique de l’avant-bras',
          lockout: 'Bras presque tendus sans hyper-extension',
        },
        breathing: {
          in: 'Inspirez à la redescente des haltères',
          out: 'Expirez lors de la flexion vers les épaules',
        },
        colorTheme: {
          primary: '#10B981',
          secondary: '#059669',
          glow: '#34D399',
          bg: '#0F241A',
          accent: '#10B981',
        },
      };

    case 'triceps_extension':
      return {
        id: 'triceps_extension',
        title: exerciseName || 'Extension Triceps',
        targetMuscleGroup: 'Triceps',
        primaryMuscles: ['Triceps brachial (Chef latéral & long chef)'],
        secondaryMuscles: ['Anconé'],
        jointAngleInfo: {
          label: 'Extension complète à 180°',
          targetAngle: 'Bras complètement verrouillés en bas',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Trajectoire vers le bas le long du buste',
        checkpoints: [
          {
            icon: '📌',
            title: 'Coudes immobiles le long du corps',
            detail: 'Seuls les avant-bras doivent bouger : le coude agit comme une charnière fixe.',
          },
          {
            icon: '⚡',
            title: 'Écartez au bas du mouvement (corde)',
            detail: 'Si vous utilisez une corde, écartez les mains vers l’extérieur pour contracter à fond.',
          },
          {
            icon: '🛑',
            title: 'Remontée jusqu’à 90°',
            detail: 'Ne laissez pas les mains monter trop haut au risque de décoller les coudes.',
          },
        ],
        tempoCues: {
          eccentric: 'Remontée freinée jusqu’à 90 degrés',
          isometric: 'Verrouillage net 1 seconde en bas',
          concentric: 'Poussée directe vers le bas',
          lockout: 'Fers à cheval des triceps sculptés',
        },
        breathing: {
          in: 'Inspirez en laissant remonter la poignée',
          out: 'Expirez en pressant vers le sol',
        },
        colorTheme: {
          primary: '#8B5CF6',
          secondary: '#6D28D9',
          glow: '#A78BFA',
          bg: '#1C152B',
          accent: '#8B5CF6',
        },
      };

    case 'dips':
      return {
        id: 'dips',
        title: exerciseName || 'Dips Barres Parallèles',
        targetMuscleGroup: 'Pectoraux & Triceps',
        primaryMuscles: ['Bas des pectoraux', 'Triceps brachial'],
        secondaryMuscles: ['Deltoïdes antérieurs'],
        jointAngleInfo: {
          label: 'Angle de 90° aux coudes',
          targetAngle: 'Coudes à 90° au point bas',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Descente verticale avec inclinaison légère',
        checkpoints: [
          {
            icon: '📐',
            title: 'Buste penché à 15-20°',
            detail: 'Penchez le torse en avant pour focaliser sur les pectoraux plutôt que les coudes.',
          },
          {
            icon: '🛑',
            title: 'Arrêt à 90° de flexion',
            detail: 'Ne descendez pas trop bas sous peine d’étirer dangereusement la capsule de l’épaule.',
          },
          {
            icon: '🛡️',
            title: 'Épaules basses et en arrière',
            detail: 'Gardez le cou dégagé sans laisser la tête s’enfoncer dans les clavicules.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente souple sans à-coup',
          isometric: 'Pause au point bas à 90 degrés',
          concentric: 'Repoussée explosive du poids du corps',
          lockout: 'Bras verrouillés fermes',
        },
        breathing: {
          in: 'Inspirez à la descente',
          out: 'Expirez à la poussée au sommet',
        },
        colorTheme: {
          primary: '#FF5500',
          secondary: '#8B5CF6',
          glow: '#FF9E66',
          bg: '#1F1424',
          accent: '#FF5500',
        },
      };

    case 'pushups':
      return {
        id: 'pushups',
        title: exerciseName || 'Pompes au Sol',
        targetMuscleGroup: 'Pectoraux',
        primaryMuscles: ['Grand pectoral', 'Triceps', 'Deltoïdes'],
        secondaryMuscles: ['Sangle abdominale (Gainage)', 'Dentelé antérieur'],
        jointAngleInfo: {
          label: 'Gainage rectiligne',
          targetAngle: 'Alignement chevilles-bassin-épaules',
        },
        trajectoryType: 'diagonal',
        trajectoryLabel: 'Descente du torse à 2 cm du sol',
        checkpoints: [
          {
            icon: '📏',
            title: 'Gainage en planche de fer',
            detail: 'Ne laissez ni les hanches s’affaisser ni les fesses monter en flèche.',
          },
          {
            icon: '📐',
            title: 'Coudes en pointe de flèche (45°)',
            detail: 'Vus du dessus, le corps et les coudes forment une flèche, pas un "T".',
          },
          {
            icon: '🎯',
            title: 'Poitrine au ras du sol',
            detail: 'Touchez presque le sol avec la poitrine sans poser le ventre.',
          },
        ],
        tempoCues: {
          eccentric: 'Contrôle parfait de la gravité',
          isometric: 'Pause 1s au ras du tapis',
          concentric: 'Poussée vive du sol',
          lockout: 'Verrouillage en planche haute',
        },
        breathing: {
          in: 'Inspirez en descendant vers le sol',
          out: 'Expirez en repoussant le sol',
        },
        colorTheme: {
          primary: '#FF5500',
          secondary: '#EF4444',
          glow: '#FCA5A5',
          bg: '#211316',
          accent: '#FF5500',
        },
      };

    case 'cable_fly':
      return {
        id: 'cable_fly',
        title: exerciseName || 'Écarté Poulie / Haltères',
        targetMuscleGroup: 'Pectoraux',
        primaryMuscles: ['Faisceau sternal & étirement pectoral'],
        secondaryMuscles: ['Deltoïdes antérieurs', 'Biceps (stabilisation)'],
        jointAngleInfo: {
          label: 'Coudes semi-fléchis fixes',
          targetAngle: 'Flexion constante à 15-20°',
        },
        trajectoryType: 'arc',
        trajectoryLabel: 'Arc embrassant un grand tronc d’arbre',
        checkpoints: [
          {
            icon: '🌳',
            title: 'Mouvement d’étreinte circulaire',
            detail: 'Imaginez enlacer un grand tronc d’arbre : ne transformez pas l’écarté en développé.',
          },
          {
            icon: '📌',
            title: 'Angle des coudes verrouillé',
            detail: 'Conservez la même courbure légère des coudes de l’ouverture à la fermeture.',
          },
          {
            icon: '💥',
            title: 'Écrasement pectoral au centre',
            detail: 'Serrez fort les deux poignées au centre pour un pic de tension incomparable.',
          },
        ],
        tempoCues: {
          eccentric: 'Ouverture lente pour un étirement profond',
          isometric: 'Maintien 1s de l’ouverture maximale',
          concentric: 'Fermeture en arc de cercle dynamique',
          lockout: 'Compression maximale au centre',
        },
        breathing: {
          in: 'Inspirez profondément à l’ouverture thoracique',
          out: 'Expirez en resserrant les poignées',
        },
        colorTheme: {
          primary: '#FF5500',
          secondary: '#F43F5E',
          glow: '#FDA4AF',
          bg: '#22121A',
          accent: '#FF5500',
        },
      };

    case 'hip_thrust':
      return {
        id: 'hip_thrust',
        title: exerciseName || 'Hip Thrust',
        targetMuscleGroup: 'Fessiers',
        primaryMuscles: ['Grand fessier (Activation maximale)'],
        secondaryMuscles: ['Ischio-jambiers', 'Quadriceps', 'Érecteurs du rachis'],
        jointAngleInfo: {
          label: 'Tibias à 90° au sommet',
          targetAngle: 'Angle droit genoux-chevilles',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Extension pelvienne verticale pure',
        checkpoints: [
          {
            icon: '📐',
            title: 'Tibias perpendiculaires au sol au sommet',
            detail: 'Si vos pieds sont trop avancés, vous tirez sur les ischios ; trop proches, sur les quadriceps.',
          },
          {
            icon: '👀',
            title: 'Regard vers l’avant (menton rentré)',
            detail: 'Ne basculez pas la tête en arrière : fixez vos genoux pour éviter de cambrer le dos.',
          },
          {
            icon: '🔒',
            title: 'Rétroversion du bassin au pic',
            detail: 'Serrez les fesses au maximum sans dépasser la ligne horizontale du torse.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente douce du bassin sans toucher le sol',
          isometric: 'Pic de contraction 2 secondes au sommet',
          concentric: 'Poussée pelvienne fulgurante des talons',
          lockout: 'Pont fessier parfaitement horizontal',
        },
        breathing: {
          in: 'Inspirez à la descente du bassin',
          out: 'Expirez puissamment en verrouillant les hanches',
        },
        colorTheme: {
          primary: '#EC4899',
          secondary: '#D946EF',
          glow: '#F0ABFC',
          bg: '#231121',
          accent: '#EC4899',
        },
      };

    case 'hanging_leg_raise':
    case 'core_crunch':
      return {
        id: category,
        title: exerciseName || (category === 'hanging_leg_raise' ? 'Relevé de Jambes' : 'Crunch Abdominal'),
        targetMuscleGroup: 'Abdominaux',
        primaryMuscles: ['Grand droit de l’abdomen (Six-pack)'],
        secondaryMuscles: ['Obliques internes et externes', 'Psoas iliaque'],
        jointAngleInfo: {
          label: 'Enroulement pelvien',
          targetAngle: 'Rapprochement pubis - sternum',
        },
        trajectoryType: 'arc',
        trajectoryLabel: 'Arc d’enroulement de la colonne lombaire',
        checkpoints: [
          {
            icon: '🔄',
            title: 'Enroulez le bassin, ne levez pas juste les cuisses',
            detail: 'Pour cibler les abdos et non les fléchisseurs de hanches, rétroversez le bassin vers le nez.',
          },
          {
            icon: '🛑',
            title: 'Bannissez tout balancement',
            detail: 'Arrêtez complètement l’inertie au bas de chaque répétition.',
          },
          {
            icon: '🫁',
            title: 'Videz tout l’air pour comprimer',
            detail: 'Expirez jusqu’au bout de vos poumons lors de la contraction maximale.',
          },
        ],
        tempoCues: {
          eccentric: 'Redescente lente et retenue',
          isometric: 'Contraction brûlante 1 seconde',
          concentric: 'Enroulement ferme et contrôlé',
          lockout: 'Gainage maintenu sans cambrer',
        },
        breathing: {
          in: 'Inspirez en dépliant le bassin',
          out: 'Expirez tout l’air en enroulant le tronc',
        },
        colorTheme: {
          primary: '#14B8A6',
          secondary: '#0D9488',
          glow: '#5EEAD4',
          bg: '#0F2321',
          accent: '#14B8A6',
        },
      };

    case 'running':
      return {
        id: 'running',
        title: exerciseName || 'Course à Pied & Tapis',
        targetMuscleGroup: 'Cardio & Bas du Corps',
        primaryMuscles: ['Système Cardiovasculaire', 'Mollets', 'Quadriceps'],
        secondaryMuscles: ['Fessiers', 'Sangle abdominale'],
        jointAngleInfo: {
          label: 'Pose médio-pied',
          targetAngle: 'Attaque sous le centre de gravité',
        },
        trajectoryType: 'horizontal',
        trajectoryLabel: 'Foulée fluide et économique',
        checkpoints: [
          {
            icon: '👟',
            title: 'Attaque médio-pied',
            detail: 'Évitez l’attaque talon talonnière devant le corps, source d’ondes de choc.',
          },
          {
            icon: '📐',
            title: 'Légère inclinaison depuis les chevilles',
            detail: 'Penchez le corps entier d’un bloc vers l’avant pour utiliser la gravité.',
          },
          {
            icon: '⏱️',
            title: 'Cadence dynamique (170-180 ppm)',
            detail: 'Privilégiez des petits pas fréquents et légers à de grands bonds coûteux.',
          },
        ],
        tempoCues: {
          eccentric: 'Amorti élastique de la voûte plantaire',
          isometric: 'Phase d’appui bref (moins de 250ms)',
          concentric: 'Propulsion dynamique du mollet',
          lockout: 'Phase de vol et récupération',
        },
        breathing: {
          in: 'Inspirez sur 2 à 3 foulées de manière rythmée',
          out: 'Expirez sur 2 à 3 foulées pour chasser le CO2',
        },
        colorTheme: {
          primary: '#06B6D4',
          secondary: '#0284C7',
          glow: '#38BDF8',
          bg: '#092133',
          accent: '#06B6D4',
        },
      };

    case 'calf_raise':
      return {
        id: 'calf_raise',
        title: exerciseName || 'Mollets Debout',
        targetMuscleGroup: 'Mollets',
        primaryMuscles: ['Gastrocnémiens (Jumeaux)', 'Soléaire'],
        secondaryMuscles: ['Muscles stabilisateurs de la cheville'],
        jointAngleInfo: {
          label: 'Flexion plantaire max',
          targetAngle: 'Montée sur la pointe des orteils',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Élévation verticale des talons',
        checkpoints: [
          {
            icon: '🦶',
            title: 'Poussée sur le gros orteil',
            detail: 'Répartissez la charge sur l’avant-pied sans laisser le pied rouler sur l’extérieur.',
          },
          {
            icon: '🛑',
            title: 'Pause 2 secondes en bas',
            detail: 'Détruisez le réflexe myotatique d’élasticité du tendon d’Achille en marquant une pause.',
          },
          {
            icon: '💥',
            title: 'Pic de contraction en haut',
            detail: 'Montez aussi haut que possible comme une danseuse étoile.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente lente sous le niveau de la marche',
          isometric: 'Arrêt complet 2 secondes en étirement',
          concentric: 'Montée puissante et haute',
          lockout: 'Contraction maximale des mollets',
        },
        breathing: {
          in: 'Inspirez lors de la descente du talon',
          out: 'Expirez en montant sur la pointe',
        },
        colorTheme: {
          primary: '#10B981',
          secondary: '#047857',
          glow: '#6EE7B7',
          bg: '#0E2219',
          accent: '#10B981',
        },
      };

    case 'superman':
      return {
        id: 'superman',
        title: exerciseName || 'Superman Gainage Lombaire',
        targetMuscleGroup: 'Dos & Fessiers',
        primaryMuscles: ['Érecteurs du rachis (Lombaires)', 'Grand fessier'],
        secondaryMuscles: ['Arrière d’épaules', 'Ischio-jambiers'],
        jointAngleInfo: {
          label: 'Décollage simultané',
          targetAngle: 'Torse et cuisses décollés',
        },
        trajectoryType: 'arc',
        trajectoryLabel: 'Arc d’extension dorsale douce',
        checkpoints: [
          {
            icon: '👀',
            title: 'Regard fixé sur le tapis',
            detail: 'Ne cassez pas la nuque en arrière : alignez les cervicales avec la colonne.',
          },
          {
            icon: '🔒',
            title: 'Verrouillage fessier permanent',
            detail: 'Serrez les fessiers pour soulager la pression directe sur les vertèbres lombaires.',
          },
          {
            icon: '⏱️',
            title: 'Tenue isométrique 2-3 secondes',
            detail: 'Maintenez la contraction au sommet sans mouvements saccadés.',
          },
        ],
        tempoCues: {
          eccentric: 'Redépose lente et contrôlée au tapis',
          isometric: 'Maintien en vol 2 secondes',
          concentric: 'Élévation coordonnée bras et jambes',
          lockout: 'Tension globale de la chaîne postérieure',
        },
        breathing: {
          in: 'Inspirez au sol',
          out: 'Expirez en décollant le torse et les jambes',
        },
        colorTheme: {
          primary: '#06B6D4',
          secondary: '#3B82F6',
          glow: '#67E8F9',
          bg: '#0F2030',
          accent: '#06B6D4',
        },
      };

    case 'mountain_climber':
      return {
        id: 'mountain_climber',
        title: exerciseName || 'Mountain Climbers',
        targetMuscleGroup: 'Abdominaux & Cardio',
        primaryMuscles: ['Grand droit', 'Fléchisseurs de hanche', 'Gainage'],
        secondaryMuscles: ['Épaules', 'Quadriceps'],
        jointAngleInfo: {
          label: 'Bassin fixe et bas',
          targetAngle: 'Alignement parfait avec le torse',
        },
        trajectoryType: 'horizontal',
        trajectoryLabel: 'Piston alternatif vers les coudes',
        checkpoints: [
          {
            icon: '🛑',
            title: 'Bassin stable sans rebond',
            detail: 'Empêchez vos fesses de monter vers le ciel : restez en ligne basse.',
          },
          {
            icon: '📌',
            title: 'Épaules au-dessus des poignets',
            detail: 'Ne reculez pas le buste pour ne pas perdre la tension sur la sangle abdominale.',
          },
          {
            icon: '⚡',
            title: 'Rythme continu et vif',
            detail: 'Enchaînez les flexions de genou comme une course dynamique au sol.',
          },
        ],
        tempoCues: {
          eccentric: 'Extension de la jambe arrière',
          isometric: 'Contact pied furtif',
          concentric: 'Montée explosive du genou au torse',
          lockout: 'Gainage ininterrompu',
        },
        breathing: {
          in: 'Respiration rapide et constante',
          out: 'Expiration rythmée sur chaque montée de genou',
        },
        colorTheme: {
          primary: '#14B8A6',
          secondary: '#0F766E',
          glow: '#5EEAD4',
          bg: '#0E2221',
          accent: '#14B8A6',
        },
      };

    default:
      return {
        id: 'default_weights',
        title: exerciseName || 'Mouvement avec Charge',
        targetMuscleGroup: 'Général',
        primaryMuscles: ['Muscles moteurs principaux'],
        secondaryMuscles: ['Muscles stabilisateurs'],
        jointAngleInfo: {
          label: 'Tempo contrôlé',
          targetAngle: 'Amplitude propre et complète',
        },
        trajectoryType: 'vertical',
        trajectoryLabel: 'Trajectoire fluide et équilibrée',
        checkpoints: [
          {
            icon: '🎯',
            title: 'Contrôlez la charge',
            detail: 'Ne laissez jamais le poids chuter rapidement : maîtrisez chaque centimètre.',
          },
          {
            icon: '🛡️',
            title: 'Gainage fondamental',
            detail: 'Serrez le ventre et fixez les articulations stabilisatrices.',
          },
          {
            icon: '🫁',
            title: 'Respiration synchronisée',
            detail: 'Inspirez à la phase négative, expirez à l’effort.',
          },
        ],
        tempoCues: {
          eccentric: 'Descente contrôlée',
          isometric: 'Point de tension',
          concentric: 'Poussée / Tirage dynamique',
          lockout: 'Verrouillage sécurisé',
        },
        breathing: {
          in: 'Inspirez pendant la phase d’étirement',
          out: 'Expirez pendant la phase de contraction',
        },
        colorTheme: {
          primary: '#FF5500',
          secondary: '#F97316',
          glow: '#FED7AA',
          bg: '#201513',
          accent: '#FF5500',
        },
      };
  }
}
