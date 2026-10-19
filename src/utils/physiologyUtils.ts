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
    categoryLabel = 'Surpoids / Masse athlétique';
    categoryShort = 'Surpoids';
    color = '#F59E0B'; // Amber orange
    healthDescription = 'Poids modérément supérieur au ratio standard de taille.';
    athleticNote = '💪 Paradoxe de l’athlète : en musculation, une forte masse musculaire et une ossature dense placent souvent d’excellents sportifs dans cette catégorie sans aucun excès de masse grasse.';
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
