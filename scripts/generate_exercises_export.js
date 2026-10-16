const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. Lire seedData.json
const seedData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/database/seedData.json'), 'utf8')
);

// 2. Extraire MUSCLE_GROUPS_INFO depuis src/constants/muscles.ts
const musclesTs = fs.readFileSync(
  path.join(__dirname, '../src/constants/muscles.ts'),
  'utf8'
);
const muscleStartIdx = musclesTs.indexOf(
  'export const MUSCLE_GROUPS_INFO: Record<MuscleGroup, MuscleGroupInfo> = {'
);
const muscleSlice = musclesTs.substring(muscleStartIdx);
const muscleSubSlice = muscleSlice.substring(
  muscleSlice.indexOf('{'),
  muscleSlice.indexOf('\n};\n') + 2
);
const muscleSandbox = {};
vm.runInNewContext('muscleGroupsInfo = ' + muscleSubSlice, muscleSandbox);
const muscleGroupsInfo = muscleSandbox.muscleGroupsInfo;

// Extraire BODY_ZONES
const zoneStartIdx = musclesTs.indexOf('export const BODY_ZONES: BodyZoneInfo[] = [');
const zoneSlice = musclesTs.substring(zoneStartIdx);
const zoneSubSlice = zoneSlice.substring(
  zoneSlice.indexOf('['),
  zoneSlice.indexOf('\n];\n') + 2
);
const zoneSandbox = {};
vm.runInNewContext('bodyZones = ' + zoneSubSlice, zoneSandbox);
const bodyZones = zoneSandbox.bodyZones;

// 3. Extraire EXERCISE_GUIDES_DATABASE depuis exerciseGuideService.ts
const guideTs = fs.readFileSync(
  path.join(__dirname, '../src/services/exerciseGuideService.ts'),
  'utf8'
);
const guideStartIdx = guideTs.indexOf(
  'export const EXERCISE_GUIDES_DATABASE: Record<string, Partial<ExerciseGuide>> = {'
);
const guideSlice = guideTs.substring(guideStartIdx);
const guideSubSlice = guideSlice.substring(
  guideSlice.indexOf('{'),
  guideSlice.indexOf('\n};\n') + 2
);
const guideSandbox = {};
vm.runInNewContext('expertGuides = ' + guideSubSlice, guideSandbox);
const expertGuides = guideSandbox.expertGuides;

console.log('Evaluated expert guides count:', Object.keys(expertGuides).length);
console.log('Evaluated muscle groups count:', Object.keys(muscleGroupsInfo).length);

// 4. Enrichir chaque exercice
function qualifyExercise(exercise) {
  const { id, name, description, target_muscle, equipment_needed, is_custom } = exercise;

  const group = muscleGroupsInfo[target_muscle];
  let zoneName = 'Haut du Corps';
  let zoneId = 'upper';

  if (group) {
    zoneId = group.zone;
    const foundZone = bodyZones.find((z) => z.id === group.zone);
    if (foundZone) {
      zoneName = foundZone.name;
    }
  }

  // Sous-muscles correspondants
  let matchedPrecise = [];
  if (group && group.preciseMuscles) {
    matchedPrecise = group.preciseMuscles
      .filter((pm) => pm.exerciseIds && pm.exerciseIds.includes(id))
      .map((pm) => ({
        id: pm.id,
        name: pm.name,
        anatomicalFocus: pm.anatomicalFocus,
        emoji: pm.emoji,
      }));

    if (matchedPrecise.length === 0 && group.preciseMuscles.length > 0) {
      matchedPrecise = [
        {
          id: group.preciseMuscles[0].id,
          name: group.preciseMuscles[0].name,
          anatomicalFocus: group.preciseMuscles[0].anatomicalFocus,
          emoji: group.preciseMuscles[0].emoji,
        },
      ];
    }
  }

  const isDuration =
    target_muscle === 'Cardio' ||
    name.toLowerCase().includes('planche') ||
    name.toLowerCase().includes('gainage') ||
    name.toLowerCase().includes('course') ||
    name.toLowerCase().includes('marche') ||
    name.toLowerCase().includes('corde à sauter') ||
    name.toLowerCase().includes('rameur') ||
    name.toLowerCase().includes('vélo') ||
    name.toLowerCase().includes('chaise');

  let loadLabel = 'Charge (kg)';
  if (target_muscle === 'Cardio') {
    loadLabel =
      name.toLowerCase().includes('tapis') || name.toLowerCase().includes('course') || name.toLowerCase().includes('marche')
        ? 'Vitesse (km/h)'
        : 'Allure / Résistance';
  } else if (
    equipment_needed === 'Sans matériel' ||
    equipment_needed.includes('Barres parallèles') ||
    equipment_needed.includes('Barre de traction')
  ) {
    loadLabel = 'Lest additionnel (kg)';
  }

  const valueLabel = isDuration ? 'Durée (sec)' : 'Répétitions';

  let defaultRest = 90;
  if (name.toLowerCase().includes('squat') || name.toLowerCase().includes('deadlift') || name.toLowerCase().includes('couché')) {
    defaultRest = 120;
  } else if (target_muscle === 'Abdominaux' || target_muscle === 'Cardio') {
    defaultRest = 45;
  } else if (target_muscle === 'Biceps' || target_muscle === 'Triceps') {
    defaultRest = 60;
  }

  // Fiche guide experte ou intelligente
  let guide = expertGuides[id];
  if (!guide) {
    // Fiche biomécanique intelligente par défaut
    let defCharge = 'Charge modérée (8 à 12 reps, RIR 1-2). Contrôlez la phase descendante sur 2 à 3 secondes.';
    if (equipment_needed.includes('Barre')) {
      defCharge = 'Charge modérée à lourde (65-75% 1RM, 6 à 10 reps avec marge technique).';
    } else if (equipment_needed.includes('Poulie') || equipment_needed.includes('Machine')) {
      defCharge = 'Charge modérée (10 à 15 reps sous tension continue fluide sans à-coups).';
    } else if (equipment_needed.includes('Sans matériel')) {
      defCharge = 'Poids du corps (8 à 15 répétitions propres sans déformation posturale).';
    }

    let defPos = `Installation stable avec ${equipment_needed}. Pieds fermement ancrés et prise sécurisée.`;
    if (equipment_needed.includes('Barre')) defPos = 'Barre réglée sur les taquets de sécurité. Prise ferme et symétrique.';
    if (equipment_needed.includes('Haltères')) defPos = 'Haltères tenus fermement dans l’axe naturel des avant-bras.';
    if (equipment_needed.includes('Poulie')) defPos = 'Poulie réglée à la bonne hauteur, buste stable contre la résistance du câble.';

    let defRisk = 'Modéré';
    let defRiskMention = 'Risque de micro-traumatisme tendineux en cas de charge excessive ou d’élan compensatoire.';

    if (target_muscle.includes('Dos')) {
      defRisk = 'Élevé';
      defRiskMention = 'Risque de cisaillement ou hernie discale lombaire si le dos s’arrondit sous la charge.';
    } else if (target_muscle.includes('Jambes')) {
      defRisk = equipment_needed.includes('Barre') ? 'Très Élevé' : 'Élevé';
      defRiskMention = 'Risque pour les genoux et les ménisques en cas d’effondrement des genoux vers l’intérieur (valgus).';
    } else if (target_muscle.includes('Épaules')) {
      defRisk = 'Modéré';
      defRiskMention = 'Risque de conflit sous-acromial et tendinopathie de la coiffe des rotateurs si la charge est trop lourde.';
    } else if (target_muscle.includes('Pectoraux')) {
      defRisk = equipment_needed.includes('Barre') ? 'Élevé' : 'Modéré';
      defRiskMention = 'Risque d’étirement excessif du grand pectoral et d’instabilité de l’épaule si les coudes s’écartent trop.';
    } else if (equipment_needed.includes('Machine') || equipment_needed.includes('Poulie')) {
      defRisk = 'Faible';
      defRiskMention = 'Risque modéré : veillez à ne pas heurter violemment les butées et contrôlez le retour.';
    }

    guide = {
      id,
      name,
      target_muscle,
      equipment_needed,
      objectif: description || `Ciblage principal : ${target_muscle}. Hypertrophie et renforcement avec ${equipment_needed}.`,
      chargeAdaptee: defCharge,
      position: defPos,
      posture: 'Colonne neutre, omoplates contrôlées, sangle abdominale verrouillée pour protéger le rachis. Respiration calée sur l’effort.',
      completude: 'Amplitude complète et physiologique. Phase excentrique contrôlée (2 à 3s), transition fluide, phase concentrique dynamique sans à-coups.',
      niveauRisque: defRisk,
      mentionRisque: defRiskMention,
      pointsAttention: [
        'Contrôlez chaque répétition sans utiliser d’élan ni cambrer excessivement.',
        'Ne bloquez pas votre respiration : expirez sur la phase d’effort concentrique.',
        'En cas de fatigue ou perte de trajectoire, réduisez la charge immédiatement.',
      ],
    };
  } else {
    guide = {
      id,
      name,
      target_muscle,
      equipment_needed,
      objectif: guide.objectif || description || `Renforcement ciblé : ${target_muscle}.`,
      chargeAdaptee: guide.chargeAdaptee || 'Charge modérée (8-12 reps, RIR 1-2).',
      position: guide.position || `Installation avec : ${equipment_needed}.`,
      posture: guide.posture || 'Colonne neutre, gainage actif.',
      completude: guide.completude || 'Amplitude complète et phase excentrique contrôlée.',
      niveauRisque: guide.niveauRisque || 'Modéré',
      mentionRisque: guide.mentionRisque || 'Risque de compensation en cas de fatigue.',
      pointsAttention: guide.pointsAttention || ['Maintenez la technique propre.', 'Ne bloquez pas la respiration.'],
    };
  }

  return {
    id,
    name,
    description: description || '',
    target_muscle,
    equipment_needed,
    is_custom: is_custom || 0,
    zone: zoneName,
    zone_id: zoneId,
    precise_muscles: matchedPrecise,
    is_duration: isDuration,
    load_label: loadLabel,
    value_label: valueLabel,
    default_rest_seconds: defaultRest,
    guide,
  };
}

const enrichedExercises = seedData.exercises.map(qualifyExercise);

const exportPayload = {
  app: 'Vitax',
  type: 'exercise_catalog',
  version: '1.0',
  description:
    'Base de données exhaustive des 106 exercices de musculation et cardio de Vitax avec qualifications anatomiques complètes, fiches d’exécution techniques, charges recommandées, postures et consignes de sécurité.',
  exported_at: new Date().toISOString(),
  total_exercises: enrichedExercises.length,
  summary: {
    by_muscle: {},
    by_risk_level: {},
  },
  exercises: enrichedExercises,
};

enrichedExercises.forEach((e) => {
  exportPayload.summary.by_muscle[e.target_muscle] =
    (exportPayload.summary.by_muscle[e.target_muscle] || 0) + 1;
  const risk = e.guide.niveauRisque || 'Modéré';
  exportPayload.summary.by_risk_level[risk] =
    (exportPayload.summary.by_risk_level[risk] || 0) + 1;
});

// Créer le dossier exports s'il n'existe pas
const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

const outputPath = path.join(exportsDir, 'vitax_exercises_database.json');
fs.writeFileSync(outputPath, JSON.stringify(exportPayload, null, 2), 'utf8');

console.log(`\n✅ Fichier généré avec succès : ${outputPath}`);
console.log(`📊 Total exercices qualifiés : ${enrichedExercises.length}`);
console.log('📌 Répartition par groupe musculaire :', exportPayload.summary.by_muscle);
console.log('⚠️ Répartition par niveau de risque :', exportPayload.summary.by_risk_level);
