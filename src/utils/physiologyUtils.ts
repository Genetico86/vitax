/**
 * Utilitaires Physiologiques & Calculs IMC / Métabolisme Vitax
 * Formules biomécaniques et médicales validées (OMS, Mifflin-St Jeor, Katch-McArdle, Kouri et al.)
 */

export type BmiCategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese_1'
  | 'obese_2';

export interface BmiAnalysis {
  bmi: number;
  category: BmiCategory;
  categoryLabel: string;
  categoryShort: string;
  color: string;
  gaugePercent: number; // 0 à 100 pour la position du curseur sur la jauge
  idealWeightMinKg: number;
  idealWeightMaxKg: number;
  idealWeightMedianKg: number;
  deltaToHealthyKg: number;
  healthDescription: string;
  athleticNote: string;
}

export interface MetabolicAnalysis {
  bmrKcal: number;
  formulaUsed: 'katch_mcardle' | 'mifflin_st_jeor';
  tdeeKcal: {
    sedentary: number;
    moderateAthlete: number;
    intenseAthlete: number;
  };
  targetsKcal: {
    maintenance: number;
    leanBulk: number;
    fatLoss: number;
  };
  recommendedWaterLiters: number;
}

export interface FfmiAnalysis {
  bodyFatPercentage: number;
  fatMassKg: number;
  leanMassKg: number;
  rawFfmi: number;
  normalizedFfmi: number;
  classification: string;
  classificationColor: string;
}

export interface PhysiologicalProfile {
  weightKg: number;
  heightCm: number;
  bmi: BmiAnalysis;
  metabolism: MetabolicAnalysis;
  ffmi: FfmiAnalysis | null;
}

export type WeightGoalType = 'loss' | 'bulk' | 'maintain';

export interface WeightProgressionFeedback {
  deltaKg: number;
  deltaDirection: 'up' | 'down' | 'stable';
  goalType: WeightGoalType;
  goalLabel: string;
  isAlignedWithGoal: boolean;
  deltaColor: string;
  badgeLabel: string;
  feedbackTitle: string;
  feedbackAdvice: string;
  compositionInsight?: string;
  remainingKg: number;
  progressPercent: number;
  isAchieved: boolean;
}

/**
 * Extrait le type d'objectif depuis le titre ou par déduction
 */
export function parseWeightGoalTitle(title?: string | null): {
  goalType: WeightGoalType;
  targetWeight: number;
} {
  const defaultTarget = 75;
  if (!title) {
    return { goalType: 'loss', targetWeight: defaultTarget };
  }

  let goalType: WeightGoalType = 'loss';
  if (title.includes('[bulk]') || title.includes('[prise_masse]') || title.toLowerCase().includes('masse')) {
    goalType = 'bulk';
  } else if (title.includes('[maintain]') || title.includes('[maintien]') || title.toLowerCase().includes('maintien')) {
    goalType = 'maintain';
  } else if (title.includes('[loss]') || title.includes('[seche]') || title.toLowerCase().includes('sèche') || title.toLowerCase().includes('perte')) {
    goalType = 'loss';
  }

  const match = title.match(/(\d+(?:[.,]\d+)?)/);
  const targetWeight = match ? parseFloat(match[1].replace(',', '.')) : defaultTarget;

  return { goalType, targetWeight };
}

/**
 * Formate le titre standardisé d'un objectif de poids avec tag machine
 */
export function formatWeightGoalTitle(targetKg: number, goalType: WeightGoalType): string {
  const tag = goalType === 'bulk' ? '[prise_masse]' : goalType === 'maintain' ? '[maintien]' : '[seche]';
  return `Poids cible : ${targetKg} kg ${tag}`;
}

/**
 * Calcule l'Indice de Masse Corporelle (IMC / BMI)
 */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || weightKg <= 20 || heightCm <= 50 || heightCm >= 260) {
    return null;
  }
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Analyse complète de l'IMC avec catégorisation OMS, jauge et fourchette de poids santé
 */
export function analyzeBmi(weightKg: number, heightCm: number): BmiAnalysis | null {
  const bmi = calculateBmi(weightKg, heightCm);
  if (bmi === null) return null;

  const heightM = heightCm / 100;
  const heightSq = heightM * heightM;

  const idealWeightMinKg = Math.round(18.5 * heightSq * 10) / 10;
  const idealWeightMaxKg = Math.round(24.9 * heightSq * 10) / 10;
  const idealWeightMedianKg = Math.round(21.7 * heightSq * 10) / 10;

  let deltaToHealthyKg = 0;
  if (weightKg < idealWeightMinKg) {
    deltaToHealthyKg = Math.round((idealWeightMinKg - weightKg) * 10) / 10;
  } else if (weightKg > idealWeightMaxKg) {
    deltaToHealthyKg = Math.round((weightKg - idealWeightMaxKg) * 10) / 10;
  }

  // Jauge de 15 à 40 (0% à 100%)
  const clampedBmi = Math.max(15, Math.min(40, bmi));
  const gaugePercent = Math.round(((clampedBmi - 15) / 25) * 100);

  let category: BmiCategory;
  let categoryLabel: string;
  let categoryShort: string;
  let color: string;
  let healthDescription: string;
  let athleticNote: string;

  if (bmi < 18.5) {
    category = 'underweight';
    categoryLabel = 'Insuffisance pondérale';
    categoryShort = 'Minceur';
    color = '#38BDF8'; // Sky blue
    healthDescription = 'Votre poids se situe sous la fourchette de référence recommandée par l’OMS.';
    athleticNote = 'Un apport calorique suffisant et un surplus protéique favoriseront le gain de masse musculaire saine.';
  } else if (bmi <= 24.9) {
    category = 'normal';
    categoryLabel = 'Corpulence normale';
    categoryShort = 'Poids Santé';
    color = '#22C55E'; // Emerald green
    healthDescription = 'Votre corpulence correspond parfaitement aux standards de référence de l’OMS.';
    athleticNote = 'Zone optimale de forme et d’endurance. Idéal pour développer la force tout en maintenant un ratio puissance/poids élevé.';
  } else if (bmi <= 29.9) {
    category = 'overweight';
    categoryLabel = 'Surpoids (IMC)';
    categoryShort = 'Surpoids';
    color = '#F59E0B'; // Amber orange
    healthDescription = 'Poids modérément supérieur au ratio standard de taille.';
    athleticNote = '💪 Paradoxe de l’athlète musclé : l’IMC est un repère statistique qui ne distingue pas la masse musculaire du tissu adipeux. Pour savoir si une hausse de poids correspond à du muscle ou du gras, suivez votre % de masse grasse, vos mensurations et vos performances sous les barres.';
  } else if (bmi <= 34.9) {
    category = 'obese_1';
    categoryLabel = 'Obésité modérée (Classe I)';
    categoryShort = 'Classe I';
    color = '#F97316'; // Deep orange
    healthDescription = 'Poids nettement supérieur aux ratios standards.';
    athleticNote = 'Pour les athlètes de force lourds (powerlifting, rugby), ce chiffre reflète souvent une masse globale importante. Un suivi du % de masse grasse est conseillé.';
  } else {
    category = 'obese_2';
    categoryLabel = 'Obésité sévère (Classe II+)';
    categoryShort = 'Classe II+';
    color = '#EF4444'; // Red
    healthDescription = 'Poids très élevé par rapport à la taille.';
    athleticNote = 'Une planification progressive combinant renforcement musculaire et déficit calorique contrôlé permettra d’alléger les articulations.';
  }

  return {
    bmi,
    category,
    categoryLabel,
    categoryShort,
    color,
    gaugePercent,
    idealWeightMinKg,
    idealWeightMaxKg,
    idealWeightMedianKg,
    deltaToHealthyKg,
    healthDescription,
    athleticNote,
  };
}

/**
 * Analyse et interprète de manière scientifique et nuancée l'évolution du poids
 * Ne félicite JAMAIS arbitrairement d'avoir gagné du muscle sans confirmation de la masse grasse.
 */
export function analyzeWeightProgression(params: {
  currentWeight: number;
  startingWeight?: number | null;
  targetWeight?: number | null;
  previousWeight?: number | null;
  explicitGoalType?: WeightGoalType;
  currentBodyFat?: number | null;
  previousBodyFat?: number | null;
}): WeightProgressionFeedback {
  const {
    currentWeight,
    startingWeight = currentWeight,
    targetWeight = currentWeight,
    previousWeight,
    explicitGoalType,
    currentBodyFat,
    previousBodyFat,
  } = params;

  const start = startingWeight ?? currentWeight;
  const target = targetWeight ?? currentWeight;

  // Déterminer le type d'objectif
  let goalType: WeightGoalType = explicitGoalType || 'loss';
  if (!explicitGoalType) {
    if (start > target) {
      goalType = 'loss';
    } else if (start < target) {
      goalType = 'bulk';
    } else {
      goalType = 'maintain';
    }
  }

  const refWeight = previousWeight ?? start;
  const deltaRecent = Math.round((currentWeight - refWeight) * 10) / 10;

  let deltaDirection: 'up' | 'down' | 'stable' = 'stable';
  if (deltaRecent > 0.1) deltaDirection = 'up';
  else if (deltaRecent < -0.1) deltaDirection = 'down';

  // Calcul d'accomplissement et de progression
  let remainingKg = 0;
  let progressPercent = 0;
  let isAchieved = false;

  if (goalType === 'maintain') {
    remainingKg = Math.round(Math.abs(currentWeight - target) * 10) / 10;
    // Si l'athlète reste dans une fourchette de ±1.5 kg, objectif tenu à 100%
    isAchieved = remainingKg <= 1.5;
    progressPercent = isAchieved ? 100 : Math.max(0, Math.min(100, Math.round(100 - remainingKg * 20)));
  } else if (goalType === 'bulk') {
    remainingKg = Math.max(0, Math.round((target - currentWeight) * 10) / 10);
    const totalDist = Math.max(0.5, target - start);
    const currentGain = currentWeight - start;
    progressPercent = Math.max(0, Math.min(100, Math.round((currentGain / totalDist) * 100)));
    isAchieved = currentWeight >= target;
  } else {
    // Sèche / Perte
    remainingKg = Math.max(0, Math.round((currentWeight - target) * 10) / 10);
    const totalDist = Math.max(0.5, start - target);
    const currentLoss = start - currentWeight;
    progressPercent = Math.max(0, Math.min(100, Math.round((currentLoss / totalDist) * 100)));
    isAchieved = currentWeight <= target;
  }

  // Analyse de composition corporelle si la masse grasse est renseignée
  let compositionInsight: string | undefined;
  if (
    currentBodyFat !== undefined &&
    currentBodyFat !== null &&
    previousBodyFat !== undefined &&
    previousBodyFat !== null &&
    previousWeight
  ) {
    const prevFatKg = previousWeight * (previousBodyFat / 100);
    const prevLeanKg = previousWeight - prevFatKg;
    const currFatKg = currentWeight * (currentBodyFat / 100);
    const currLeanKg = currentWeight - currFatKg;

    const leanDelta = Math.round((currLeanKg - prevLeanKg) * 10) / 10;
    const fatDelta = Math.round((currFatKg - prevFatKg) * 10) / 10;

    if (fatDelta <= -0.2 && leanDelta >= 0.1) {
      compositionInsight = `🔬 Recomposition remarquable : perte de -${Math.abs(fatDelta)} kg de masse grasse combinée à un gain de +${leanDelta} kg de masse maigre !`;
    } else if (fatDelta <= -0.2 && leanDelta >= -0.2) {
      compositionInsight = `🔬 Sèche réussie : perte de -${Math.abs(fatDelta)} kg de masse grasse avec préservation de votre masse maigre.`;
    } else if (leanDelta >= 0.2 && Math.abs(fatDelta) <= 0.2) {
      compositionInsight = `🔬 Prise de muscle propre : +${leanDelta} kg de masse maigre (synthèse musculaire) sans augmentation du tissu adipeux.`;
    } else if (fatDelta >= 0.2 && leanDelta <= 0.1) {
      compositionInsight = `🔬 Attention composition : la hausse observée provient essentiellement de la masse grasse (+${fatDelta} kg).`;
    } else if (leanDelta >= 0.2 && fatDelta >= 0.2) {
      compositionInsight = `🔬 Prise de masse mixte : +${leanDelta} kg de masse maigre accompagnée de +${fatDelta} kg de masse grasse.`;
    } else {
      compositionInsight = `🔬 Évolution mesurée : variation masse maigre (${leanDelta > 0 ? '+' : ''}${leanDelta} kg) et masse grasse (${fatDelta > 0 ? '+' : ''}${fatDelta} kg).`;
    }
  } else if (!currentBodyFat) {
    compositionInsight =
      '💡 Rappel : Sans mesure du taux de masse grasse (% MG), une variation sur la balance reflète l’ensemble eau + glycogène + graisse + muscle.';
  }

  // Interprétation et orientation de coaching scientifique
  let isAlignedWithGoal = false;
  let deltaColor = '#94A3B8';
  let badgeLabel = 'Stable';
  let feedbackTitle = 'Stabilité pondérale';
  let feedbackAdvice = 'Votre poids oscille dans une marge normale de régulation hydrique (±0,5 kg).';

  if (goalType === 'bulk') {
    const goalLabel = 'Prise de masse musculaire';
    if (deltaDirection === 'up') {
      isAlignedWithGoal = true;
      deltaColor = '#22C55E'; // Vert (conforme à l'objectif)
      badgeLabel = 'Gain pondéral';
      if (deltaRecent > 1.2) {
        feedbackTitle = '📈 Prise de poids rapide';
        feedbackAdvice =
          `+${deltaRecent} kg enregistrés. Attention : le tissu musculaire ne se synthétise que lentement (0,2 à 0,4 kg / semaine max). Un gain plus rapide reflète souvent de l’eau, du glycogène ou du stockage adipeux. Modérez légèrement le surplus calorique.`;
      } else {
        feedbackTitle = '📈 Gain pondéral régulier';
        feedbackAdvice =
          `+${deltaRecent} kg en phase avec votre objectif de prise de masse. Maintenez une surcharge progressive en musculation et un apport protéique adéquat pour orienter ce surplus vers l’anabolisme musculaire.`;
      }
    } else if (deltaDirection === 'down') {
      isAlignedWithGoal = false;
      deltaColor = '#F59E0B'; // Ambre (alerte déviation)
      badgeLabel = 'Légère baisse';
      feedbackTitle = '📉 Légère perte de poids';
      feedbackAdvice =
        `-${Math.abs(deltaRecent)} kg constatés. En phase de prise de masse, un déficit temporaire freine la croissance musculaire. Veillez à consommer un surplus calorique constant (+250 à +350 kcal/j).`;
    } else {
      isAlignedWithGoal = true;
      deltaColor = '#38BDF8';
      badgeLabel = 'Poids stable';
      feedbackTitle = '⚖️ Palier de stabilisation';
      feedbackAdvice =
        'Votre poids est stable. Si vous ne progressez plus sur la balance depuis plus de 2 semaines, augmentez légèrement vos glucides autour de l’entraînement.';
    }

    return {
      deltaKg: deltaRecent,
      deltaDirection,
      goalType,
      goalLabel,
      isAlignedWithGoal,
      deltaColor,
      badgeLabel,
      feedbackTitle,
      feedbackAdvice,
      compositionInsight,
      remainingKg,
      progressPercent,
      isAchieved,
    };
  }

  if (goalType === 'maintain') {
    const goalLabel = 'Maintien & Recomposition';
    if (deltaDirection === 'stable') {
      isAlignedWithGoal = true;
      deltaColor = '#22C55E';
      badgeLabel = 'Équilibre parfait';
      feedbackTitle = '⚖️ Équilibre énergétique maintenu';
      feedbackAdvice =
        'Poids parfaitement stabilisé. Idéal pour optimiser les charges de travail et la récupération sans variation de masse grasse.';
    } else if (deltaDirection === 'up') {
      isAlignedWithGoal = Math.abs(deltaRecent) <= 1.0;
      deltaColor = isAlignedWithGoal ? '#38BDF8' : '#F59E0B';
      badgeLabel = `+${deltaRecent} kg`;
      feedbackTitle = '📊 Légère variation haussière';
      feedbackAdvice =
        `+${deltaRecent} kg sur la balance. Ne concluez pas hâtivement à une prise de muscle ou de gras : le sel, les glucides stockés (eau liée au glycogène) et la fatigue d’entraînement créent souvent des fluctuations temporaires.`;
    } else {
      isAlignedWithGoal = Math.abs(deltaRecent) <= 1.0;
      deltaColor = isAlignedWithGoal ? '#38BDF8' : '#F59E0B';
      badgeLabel = `${deltaRecent} kg`;
      feedbackTitle = '📊 Légère variation baissière';
      feedbackAdvice =
        `-${Math.abs(deltaRecent)} kg enregistrés. Légère fluctuation normale d’hydratation ou déficit modéré non intentionnel.`;
    }

    return {
      deltaKg: deltaRecent,
      deltaDirection,
      goalType,
      goalLabel,
      isAlignedWithGoal,
      deltaColor,
      badgeLabel,
      feedbackTitle,
      feedbackAdvice,
      compositionInsight,
      remainingKg,
      progressPercent,
      isAchieved,
    };
  }

  // Par défaut : Sèche / Perte de poids
  const goalLabel = 'Sèche / Perte de poids';
  if (deltaDirection === 'down') {
    isAlignedWithGoal = true;
    deltaColor = '#22C55E'; // Vert (conforme à la perte)
    badgeLabel = 'Perte régulière';
    if (Math.abs(deltaRecent) > 1.5) {
      feedbackTitle = '📉 Baisse rapide sur la balance';
      feedbackAdvice =
        `-${Math.abs(deltaRecent)} kg enregistrés. Une perte supérieure à 1 kg / semaine comporte souvent une part d’eau et un risque de fonte musculaire. Conservez un apport protéique élevé (1,8 à 2,2 g/kg).`;
    } else {
      feedbackTitle = '📉 Perte progressive maîtrisée';
      feedbackAdvice =
        `-${Math.abs(deltaRecent)} kg en accord avec votre objectif de sèche. Ce rythme protège votre masse musculaire tout en stimulant l’oxydation des graisses.`;
    }
  } else if (deltaDirection === 'up') {
    isAlignedWithGoal = false;
    deltaColor = '#F59E0B'; // Ambre (non conforme, mais neutre et réaliste)
    badgeLabel = 'Variation haussière';
    feedbackTitle = '📊 Hausse temporaire constatée';
    feedbackAdvice =
      `+${deltaRecent} kg sur la balance. Inutile de paniquer : une hausse ponctuelle en période de sèche est le plus souvent liée à la rétention d’eau (sodium, micro-lésions musculaires post-entraînement, transit). Maintenez le cap sur votre déficit calorique.`;
  } else {
    isAlignedWithGoal = true;
    deltaColor = '#38BDF8';
    badgeLabel = 'Poids stable';
    feedbackTitle = '⚖️ Palier temporaire';
    feedbackAdvice =
      'Votre poids est temporairement stable. Surveillez la tendance sur 10 à 14 jours avant d’envisager un réajustement de vos apports alimentaires.';
  }

  return {
    deltaKg: deltaRecent,
    deltaDirection,
    goalType,
    goalLabel,
    isAlignedWithGoal,
    deltaColor,
    badgeLabel,
    feedbackTitle,
    feedbackAdvice,
    compositionInsight,
    remainingKg,
    progressPercent,
    isAchieved,
  };
}

/**
 * Calcule le métabolisme de base (BMR) et la dépense énergétique journalière (TDEE)
 */
export function calculateMetabolism(
  weightKg: number,
  heightCm: number,
  bodyFatPercentage?: number | null
): MetabolicAnalysis | null {
  if (!weightKg || !heightCm || weightKg <= 20 || heightCm <= 50) {
    return null;
  }

  let bmrKcal: number;
  let formulaUsed: 'katch_mcardle' | 'mifflin_st_jeor' = 'mifflin_st_jeor';

  // Si le % de masse grasse est connu et plausible (entre 5% et 55%), utiliser Katch-McArdle
  if (
    bodyFatPercentage !== undefined &&
    bodyFatPercentage !== null &&
    bodyFatPercentage >= 5 &&
    bodyFatPercentage <= 55
  ) {
    const leanMassKg = weightKg * (1 - bodyFatPercentage / 100);
    bmrKcal = Math.round(370 + 21.6 * leanMassKg);
    formulaUsed = 'katch_mcardle';
  } else {
    // Sinon formule de référence internationale Mifflin-St Jeor (adulte moyen actif ~28 ans)
    bmrKcal = Math.round(10 * weightKg + 6.25 * heightCm - 135);
  }

  // TDEE selon les profils d'activité
  const sedentary = Math.round(bmrKcal * 1.2);
  const moderateAthlete = Math.round(bmrKcal * 1.45); // Standard Vitax : 3-4 séances/semaine
  const intenseAthlete = Math.round(bmrKcal * 1.65);  // Athlète très assidu : 5-6 séances intenses

  const maintenance = moderateAthlete;
  const leanBulk = maintenance + 300; // Léger surplus pour prise de muscle propre
  const fatLoss = Math.max(bmrKcal, maintenance - 350); // Léger déficit sans casser le métabolisme

  // Besoins hydriques : 35 ml/kg + 500 ml séance de sport
  const recommendedWaterLiters = Math.round((weightKg * 0.035 + 0.5) * 10) / 10;

  return {
    bmrKcal,
    formulaUsed,
    tdeeKcal: {
      sedentary,
      moderateAthlete,
      intenseAthlete,
    },
    targetsKcal: {
      maintenance,
      leanBulk,
      fatLoss,
    },
    recommendedWaterLiters,
  };
}

/**
 * Calcule l'indice de masse maigre (FFMI / Fat-Free Mass Index) si le % de masse grasse est renseigné
 */
export function calculateFfmi(
  weightKg: number,
  heightCm: number,
  bodyFatPercentage?: number | null
): FfmiAnalysis | null {
  if (
    !weightKg ||
    !heightCm ||
    bodyFatPercentage === undefined ||
    bodyFatPercentage === null ||
    bodyFatPercentage < 4 ||
    bodyFatPercentage > 60
  ) {
    return null;
  }

  const heightM = heightCm / 100;
  const fatMassKg = Math.round(weightKg * (bodyFatPercentage / 100) * 10) / 10;
  const leanMassKg = Math.round((weightKg - fatMassKg) * 10) / 10;

  const rawFfmi = leanMassKg / (heightM * heightM);
  // Normalisation de Kouri et al. (1995) pour une taille standard de 1.80m
  const normalizedFfmi = Math.round((rawFfmi + 6.1 * (1.8 - heightM)) * 10) / 10;

  let classification: string;
  let classificationColor: string;

  if (normalizedFfmi < 18) {
    classification = 'Masse musculaire modérée';
    classificationColor = '#94A3B8';
  } else if (normalizedFfmi < 20) {
    classification = 'Moyenne athlétique';
    classificationColor = '#38BDF8';
  } else if (normalizedFfmi < 22) {
    classification = 'Athlète musclé';
    classificationColor = '#22C55E';
  } else if (normalizedFfmi < 24) {
    classification = 'Très musclé / Avancé';
    classificationColor = '#F59E0B';
  } else if (normalizedFfmi <= 25.5) {
    classification = 'Élite naturelle';
    classificationColor = '#A855F7';
  } else {
    classification = 'Hors norme';
    classificationColor = '#EC4899';
  }

  return {
    bodyFatPercentage,
    fatMassKg,
    leanMassKg,
    rawFfmi: Math.round(rawFfmi * 10) / 10,
    normalizedFfmi,
    classification,
    classificationColor,
  };
}

/**
 * Génère le profil physiologique consolidé de l'athlète
 */
export function buildPhysiologicalProfile(
  weightKg?: number | null,
  heightCm?: number | null,
  bodyFatPercentage?: number | null
): PhysiologicalProfile | null {
  if (!weightKg || !heightCm) return null;

  const bmi = analyzeBmi(weightKg, heightCm);
  const metabolism = calculateMetabolism(weightKg, heightCm, bodyFatPercentage);

  if (!bmi || !metabolism) return null;

  const ffmi = calculateFfmi(weightKg, heightCm, bodyFatPercentage);

  return {
    weightKg,
    heightCm,
    bmi,
    metabolism,
    ffmi,
  };
}
