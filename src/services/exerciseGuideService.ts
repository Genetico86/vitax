import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RiskLevel = 'Faible' | 'Modéré' | 'Élevé' | 'Très Élevé';

export interface ExerciseGuide {
  id: string;
  name: string;
  target_muscle: string;
  equipment_needed: string;
  objectif: string;
  chargeAdaptee: string;
  position: string;
  posture: string;
  completude: string;
  niveauRisque: RiskLevel;
  mentionRisque: string;
  pointsAttention: string[];
}

export const STORAGE_KEY_CUSTOM_GUIDES = '@vitax_custom_exercise_guides';
let customGuidesCache: Record<string, Partial<ExerciseGuide>> = {};
let customGuidesLoaded = false;

export async function loadCustomGuides(): Promise<Record<string, Partial<ExerciseGuide>>> {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return customGuidesCache;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_GUIDES);
    if (raw) {
      customGuidesCache = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Erreur chargement custom guides:', e);
  }
  customGuidesLoaded = true;
  return customGuidesCache;
}

export function getLoadedCustomGuides(): Record<string, Partial<ExerciseGuide>> {
  return customGuidesCache;
}

export function isCustomGuidesLoaded(): boolean {
  return customGuidesLoaded;
}

export async function saveCustomGuidesBatch(guides: Record<string, Partial<ExerciseGuide>>): Promise<void> {
  customGuidesCache = { ...customGuidesCache, ...guides };
  try {
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_GUIDES, JSON.stringify(customGuidesCache));
  } catch (e) {
    console.warn('Erreur sauvegarde custom guides:', e);
  }
}

export async function resetCustomGuides(): Promise<void> {
  customGuidesCache = {};
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_GUIDES);
  } catch (e) {
    console.warn('Erreur reset custom guides:', e);
  }
}

// Initialisation non bloquante au chargement du module
loadCustomGuides().catch(() => {});

/**
 * Base de données experte des guides d'exécution technique des exercices Vitax.
 * Structurée selon :
 * 1. Objectif (recrutement musculaire & bénéfice ciblé)
 * 2. Charge adaptée (type de charge et intensité pour une exécution parfaite)
 * 3. Position (installation & réglage matériel)
 * 4. Posture (alignement corporel, gainage & respiration)
 * 5. Complétude du geste (amplitude, phase excentrique, transition, phase concentrique)
 * 6. Mention Risque (niveau de risque et alerte sur les traumatismes potentiels)
 * 7. Points d'attention (erreurs critiques & sécurité articulaire)
 */
export const EXERCISE_GUIDES_DATABASE: Record<string, Partial<ExerciseGuide>> = {
  // --- PECTORAUX ---
  ex_bench_press: {
    objectif:
      'Développement de la force maximale et du volume des pectoraux (faisceau sternocostal), avec recrutement secondaire des deltoïdes antérieurs et des triceps.',
    chargeAdaptee:
      'Charge modérée à lourde (70-80% du 1RM, séries de 6 à 10 reps). Conservez impérativement 1 à 2 répétitions en réserve (RIR 1-2) pour maintenir l’alignement des coudes et le pontage sans dégradation.',
    position:
      'Allongez-vous sur le banc, yeux à l’aplomb de la barre. Pieds fermement ancrés à plat dans le sol. Prise sur la barre légèrement supérieure à la largeur des épaules (avant-bras verticaux en bas du mouvement).',
    posture:
      'Resserrez et abaissez les omoplates (rétraction scapulaire) pour protéger les épaules. Maintenez une cambrure lombaire naturelle stable. Fessiers en contact permanent avec le banc. Inspirez au début de la descente.',
    completude:
      'Descendez la barre de manière contrôlée (2 à 3 secondes) jusqu’à effleurer le milieu de la poitrine sans rebond. Poussez explosivement en ramenant la barre vers le haut selon une trajectoire légèrement en diagonale vers le visage, sans verrouiller violemment les coudes.',
    niveauRisque: 'Élevé',
    mentionRisque:
      'Risque de déchirure myotendineuse du grand pectoral lors de l’étirement bas, conflit sous-acromial de l’épaule si les coudes s’écartent à 90°, et risque critique d’écrasement thoracique ou laryngé en cas d’échec sous la barre sans pareur ni barres de sécurité.',
    pointsAttention: [
      'Ne laissez jamais la barre rebondir sur le sternum (risque pour la cage thoracique).',
      'Ne décollez pas les fessiers du banc pour chercher de l’élan.',
      'Gardez les poignets droits au-dessus des avant-bras, évitez l’hyperextension des poignets.',
      'Gardez les coudes ouverts à environ 45-70° du buste, évitez d’écarter les coudes à 90° à l’horizontale.',
    ],
  },
  ex_flat_dumbbell_press: {
    objectif:
      'Hypertrophie des pectoraux avec liberté articulaire maximale pour les poignets et les épaules, et un étirement profond en bas de mouvement.',
    chargeAdaptee:
      'Charge modérée (8 à 12 reps contrôlées). Chaque bras travaillant indépendamment, privilégiez la stabilité scapulaire plutôt que le tonnage brut.',
    position:
      'Assis sur le banc avec les haltères sur les genoux, basculez en arrière en amenant les poids de chaque côté de la poitrine. Pieds bien ancrés au sol.',
    posture:
      'Omoplates serrées et plaquées contre le dossier, poitrine bombée. Nuque neutre posée sur le banc, abdos gainés pour stabiliser le tronc.',
    completude:
      'Descendez les haltères jusqu’à ressentir un étirement net mais confortable des pectoraux (haltères à niveau de poitrine). Poussez en convergeant légèrement vers le haut sans entrechoquer les haltères.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Risque de luxation ou de lésion de la coiffe des rotateurs lors de la mise en place et de la dépose des haltères, hyperextension de l’épaule si la descente est trop profonde.',
    pointsAttention: [
      'Contrôlez impérativement la trajectoire : ne laissez pas les bras s’écarter de manière asymétrique.',
      'Ne claquez pas les haltères au sommet (danger d’instabilité et perte de tension musculaire).',
      'Posez les haltères sur les cuisses avant de vous redresser à la fin de la série.',
    ],
  },
  ex_incline_barbell_press: {
    objectif:
      'Ciblage préférentiel du faisceau claviculaire (haut des pectoraux) et des deltoïdes antérieurs.',
    chargeAdaptee:
      'Charge modérée (65-75% du 1RM, environ 15 à 20% inférieure au développé couché plat). Séries de 8 à 10 reps.',
    position:
      'Banc incliné entre 30° et 45° (au-delà, les deltoïdes prennent le dessus). Prise de barre légèrement plus large que les épaules.',
    posture:
      'Omoplates rétractées, poitrine haute, pieds bien à plat. Ne décollez pas les lombaires en sur-cambrant.',
    completude:
      'Descendez la barre sous contrôle jusqu’au haut des pectoraux (juste sous les clavicules). Pressez fermement vers le haut sans perdre le contact des omoplates.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Risque de pincement de la bourse sous-acromiale et d’hyper-sollicitation du deltoïde antérieur si le banc dépasse 30-45° d’inclinaison.',
    pointsAttention: [
      'Évitez une inclinaison trop forte (>45°) qui transforme le mouvement en développé militaire.',
      'Ne poussez pas les épaules vers l’avant en fin de montée.',
    ],
  },
  ex_incline_dumbbells: {
    objectif:
      'Développement du haut de la poitrine avec étirement approfondi et possibilité d’orienter les poignets pour soulager les articulations.',
    chargeAdaptee:
      'Charge modérée (10 à 12 reps rythmées). Utilisez des charges vous permettant une trajectoire fluide et une remontée symétrique.',
    position:
      'Banc incliné à 30-45°. Installez les haltères sur les cuisses puis basculez dos au dossier.',
    posture:
      'Omoplates resserrées, pieds ancrés au sol, regard vers le plafond sans cambrure cervicale.',
    completude:
      'Descente contrôlée en ouvrant les coudes à 45-60° jusqu’à ressentir l’étirement du haut de la poitrine. Poussez en convergeant sans heurter les haltères.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Risque d’instabilité et de bascule arrière des poids au sommet, contrainte accrue sur la capsule articulaire antérieure de l’épaule.',
    pointsAttention: [
      'Gardez le poignet rigide dans l’axe de l’avant-bras.',
      'Ne laissez pas les haltères basculer vers l’arrière au sommet.',
    ],
  },
  ex_pushups: {
    objectif:
      'Renforcement global au poids du corps des pectoraux, des deltoïdes antérieurs, des triceps et gainage dynamique du tronc.',
    chargeAdaptee:
      'Poids du corps (environ 65% du poids corporel en appui). Éventuel gilet lesté ou surélévation des pieds si plus de 20 répétitions impeccables sont maîtrisées.',
    position:
      'Mains au sol à largeur d’épaules ou légèrement plus, doigts bien écartés. Pieds serrés ou largeur du bassin.',
    posture:
      'Corps en ligne droite parfaite de la tête aux talons. Bassin en rétroversion, fessiers et abdos verrouillés. Nuque allongée dans le prolongement de la colonne.',
    completude:
      'Fléchissez les bras en amenant la poitrine à 2-3 cm du sol en gardant les coudes orientés à 45° vers l’arrière. Poussez jusqu’à l’extension complète des bras en repoussant le sol.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque d’hyperlordose et de pincement lombaire si le gainage abdoperinéal s’affaisse en fin de série, contrainte aux poignets en manque d’extension.',
    pointsAttention: [
      'Ne laissez jamais le bas du dos se creuser (signe d’un gainage relâché).',
      'Ne relevez pas les fesses en toit.',
      'Ne penchez pas la tête en avant vers le sol pour simuler la descente.',
    ],
  },
  ex_dips: {
    objectif:
      'Développement puissant du bas des pectoraux (faisceau abdominal) et de la masse des triceps.',
    chargeAdaptee:
      'Poids du corps pour débuter. Ne commencez le lestage à la ceinture que si vous enchaînez 12 répétitions profondes avec les omoplates parfaitement verrouillées.',
    position:
      'En appui sur les barres parallèles, bras tendus, poignets fermes sans casser l’articulation.',
    posture:
      'Penchez le buste en avant à environ 30° pour cibler les pectoraux (un buste droit isole davantage les triceps). Croisez les jambes, genoux fléchis, abdos gainés.',
    completude:
      'Descendez jusqu’à ce que le bras et l’avant-bras forment un angle droit (90° au coude). Repoussez les barres avec énergie jusqu’au verrouillage contrôlé.',
    niveauRisque: 'Élevé',
    mentionRisque:
      'Risque d’étirement violent de la capsule antérieure de l’épaule et de costochondrite (inflammation aiguë du cartilage sternal) en cas de descente en dessous de 90° de flexion de coude.',
    pointsAttention: [
      'Ne descendez pas trop bas si vous manquez de souplesse scapulaire (risque pour la capsule de l’épaule).',
      'Ne haussez pas les épaules vers les oreilles : gardez les épaules basses et actives.',
    ],
  },
  ex_cable_fly: {
    objectif:
      'Isolation pure des pectoraux sous tension continue constante grâce aux câbles de la poulie.',
    chargeAdaptee:
      'Charge légère à modérée (12 à 15 reps sous tension constante). Mouvement d’isolation où la charge ne doit jamais primer sur la sensation de contraction.',
    position:
      'Poulies réglées à hauteur moyenne ou haute. Poignées fermement saisies, faites un pas en avant en fente pour stabiliser l’assise.',
    posture:
      'Buste légèrement penché vers l’avant (15-20°), poitrine sortie, épaules basses et omoplates serrées. Coudes semi-fléchis à angle fixe pendant tout le mouvement.',
    completude:
      'Ouvrez les bras en arc de cercle jusqu’à un étirement contrôlé des pectoraux. Resserrez les poignées devant vous en contractant volontairement la poitrine pendant 1 seconde.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque de micro-déchirure pectorale si les câbles tractent les bras trop loin en arrière avec les coudes trop tendus.',
    pointsAttention: [
      'Ne modifiez pas l’angle des coudes pendant le mouvement (ce n’est pas un développé).',
      'Ne donnez pas d’élan avec le tronc.',
    ],
  },

  // --- DOS ---
  ex_deadlift: {
    objectif:
      'Construction de la chaîne postérieure complète (érecteurs du rachis, fessiers, ischio-jambiers, trapèzes) et développement de la force brute.',
    chargeAdaptee:
      'Charge lourde progressive (75-85% du 1RM, séries courtes de 3 à 6 reps). Stoppez la série dès que le rythme de montée ralentit avec perte de neutralité dorsale.',
    position:
      'Pieds sous la barre écartés largeur du bassin, pointes légèrement ouvertes. La barre coupe les lacets de chaussures. Mains agrippées à l’extérieur des tibias.',
    posture:
      'Dos parfaitement plat et neutre. Poitrine sortie, omoplates tirées vers les poches arrière, fesses en arrière, tibias proches de la verticale. Abdos sous pression intra-abdominale maximale (manœuvre de Valsalva).',
    completude:
      'Poussez fort le sol avec les talons en étendant simultanément genoux et hanches. La barre frotte les tibias et les cuisses. Au sommet, verrouillez hanches et fessiers sans cambrer le dos en arrière.',
    niveauRisque: 'Très Élevé',
    mentionRisque:
      'Risque majeur d’hernie discale lombaire (L4-L5 / L5-S1) et de sciatique aiguë en cas d’arrondissement de la colonne sous tension, risque de rupture du tendon distal du biceps en prise mixte si le bras n’est pas rigoureusement tendu.',
    pointsAttention: [
      'NE JAMAIS arrondir le bas du dos (danger hernie discale).',
      'Ne tirez pas avec les bras : ils ne servent que de crochets.',
      'Ne relâchez pas la tension au début : engagez la barre avant de décoller le poids.',
    ],
  },
  ex_pullups: {
    objectif:
      'Élargissement du dos (grand dorsal), renforcement du grand rond, des rhomboïdes et des biceps.',
    chargeAdaptee:
      'Poids du corps (utiliser un élastique d’allègement ou une machine assistée si moins de 6 répétitions complètes). Lest uniquement si la poitrine touche la barre sans balancement.',
    position:
      'Prise en pronation (paumes vers l’avant) plus large que les épaules sur la barre fixe.',
    posture:
      'Départ bras tendus (suspension active). Engagez d’abord les omoplates vers le bas avant de fléchir les bras. Jambes légèrement fléchies et gainées, sans balancement.',
    completude:
      'Tirez en amenant la poitrine vers la barre jusqu’à ce que le menton dépasse nettement la barre. Redescendez lentement jusqu’à l’extension quasi-complète.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Risque d’épitrochléite (tendinite du coude) due à une prise trop rigide, et micro-traumatisme scapulaire en cas de décrochage passif brutal en bas de suspension.',
    pointsAttention: [
      'Évitez le kipping (coups de genoux ou balancement du bassin).',
      'Ne cherchez pas à tricher en tendant le cou vers le haut.',
    ],
  },
  ex_barbell_row: {
    objectif:
      'Épaisseur du dos : grand dorsal, trapèzes moyens/inférieurs et rhomboïdes, avec maintien isométrique des lombaires.',
    chargeAdaptee:
      'Charge modérée à lourde (70-75% 1RM, 8 à 10 reps). La charge ne doit pas vous contraindre à redresser le buste au-delà de 45° pour tricher.',
    position:
      'Debout pieds largeur du bassin, genoux légèrement déverrouillés. Penchez le buste à 45° ou quasi-parallèle au sol, barre saisie en pronation.',
    posture:
      'Colonne vertébrale droite et verrouillée, regard à 1 mètre devant au sol pour respecter la neutralité cervicale. Gainage abdominal rigide.',
    completude:
      'Tirez la barre vers le bas du ventre (nombril) en guidant avec les coudes vers l’arrière et le haut. Marquez une contraction d’1 seconde en resserrant les omoplates puis redescendez lentement.',
    niveauRisque: 'Élevé',
    mentionRisque:
      'Risque de cisaillement vertébral lombaire aigu et de contracture des paravertébraux lors des à-coups verticaux pour arracher la barre du sol.',
    pointsAttention: [
      'Ne donnez pas d’à-coups de buste de haut en bas pour faire monter la charge.',
      'Ne laissez pas le dos s’arrondir en fin de série.',
    ],
  },
  ex_lat_pulldown: {
    objectif:
      'Recrutement guidé et isolé du grand dorsal pour développer la silhouette en V.',
    chargeAdaptee:
      'Charge modérée (8 à 12 reps). Choisissez un poids vous permettant de marquer 1 seconde d’arrêt sur le haut du torse sans vous allonger en arrière.',
    position:
      'Assis sous la poulie haute, boudins de calage réglés fermement sur les cuisses. Prise large en pronation sur la barre.',
    posture:
      'Buste très légèrement incliné vers l’arrière (10-15°), poitrine sortie, épaules basses. Ne pas se pencher excessivement en arrière.',
    completude:
      'Tirez la barre vers le haut des pectoraux en amenant les coudes vers le bas et l’arrière. Marquez 1 seconde de contraction puis contrôlez la remontée complète.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque de conflit gléno-huméral et de traumatisme cervical majeur si la barre est tirée derrière le cou (tirage nuque à proscrire impérativement).',
    pointsAttention: [
      'Ne tirez pas la barre derrière la nuque (risque de conflit pour les épaules et les cervicales).',
      'Ne relâchez pas brutalement la barre en haut.',
    ],
  },
  ex_seated_cable_row: {
    objectif:
      'Développement de l’épaisseur du milieu du dos, des rhomboïdes et des trapèzes moyens.',
    chargeAdaptee:
      'Charge modérée (10 à 12 reps). Le dos reste verrouillé en équerre sans bascule d’avant en arrière.',
    position:
      'Assis pieds calés sur les repose-pieds, genoux souples. Saisissez la poignée ou la barre droite.',
    posture:
      'Buste vertical et stable, dos droit, épaules basses. Ne pas osciller d’avant en arrière avec les lombaires.',
    completude:
      'Tirez la poignée vers le nombril en tirant les coudes le long du corps et en resserrant fortement les omoplates. Revenez en contrôlant l’étirement.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque de lombalgie d’effort si l’athlète balance le torse d’avant en arrière pour compenser la fatigue des dorsaux.',
    pointsAttention: [
      'Ne courbez pas les épaules vers l’avant lors du retour.',
      'Ne balancez pas le torse pour arracher la charge.',
    ],
  },

  // --- ÉPAULES ---
  ex_overhead_press: {
    objectif:
      'Force globale et développement des deltoïdes antérieurs et latéraux, triceps et gainage debout.',
    chargeAdaptee:
      'Charge modérée (60-70% 1RM, 6 à 10 reps). Une charge trop lourde pousse le corps à cambrer exagérément les lombaires pour engager les pectoraux.',
    position:
      'Debout devant le rack, barre posée sur les clavicules et le haut de la poitrine. Prise largeur d’épaules, avant-bras verticaux sous la barre.',
    posture:
      'Fessiers contractés à fond, abdos verrouillés pour éviter toute cambrure lombaire excessive. Tête légèrement reculée pour laisser passer la barre.',
    completude:
      'Poussez la barre droit vers le plafond. Dès que la barre dépasse le front, avancez légèrement la tête pour aligner la barre, les épaules, les hanches et les chevilles.',
    niveauRisque: 'Élevé',
    mentionRisque:
      'Risque d’hyperlordose lombaire de compensation pouvant comprimer les racines nerveuses, et pincement du tendon du sus-épineux sous l’acromion.',
    pointsAttention: [
      'Ne cambrez pas le dos en arrière pour transformer l’exercice en développé couché debout.',
      'Ne fléchissez pas les genoux pour donner une impulsion (sinon c’est un Push Press).',
    ],
  },
  ex_lateral_raise: {
    objectif:
      'Isolation ciblée du deltoïde latéral pour donner la largeur d’épaules et la carrure.',
    chargeAdaptee:
      'Charge légère (12 à 20 reps strictes). Les deltoïdes latéraux répondent à la tension continue et au volume propre : 4 à 8 kg suffisent à la plupart des athlètes.',
    position:
      'Debout, pieds largeur du bassin, un haltère dans chaque main tenu le long du corps ou légèrement devant les cuisses.',
    posture:
      'Légère inclinaison du buste en avant (5°), coudes très légèrement fléchis, épaules abaissées loin des oreilles.',
    completude:
      'Élevez les bras sur les côtés jusqu’à l’horizontale (hauteur des épaules) en guidant le mouvement par les coudes. Petite pause au sommet puis descente freinée sur 2 secondes.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque de conflit de la coiffe des rotateurs si les pouces pointent vers le bas lors de la montée (gardez les pouces horizontaux ou très légèrement vers le haut) et hyperactivité parasite des trapèzes supérieurs.',
    pointsAttention: [
      'Ne montez pas les haltères plus haut que les épaules.',
      'Ne donnez pas d’élan avec les jambes ou le bassin.',
      'Privilégiez une charge modérée pour ne pas recruter les trapèzes supérieurs.',
    ],
  },
  ex_face_pull: {
    objectif:
      'Renforcement de l’arrière d’épaule (deltoïde postérieur), des rotateurs externes et santé posturale scapulaire.',
    chargeAdaptee:
      'Charge légère (15 à 20 reps avec maintien 2s). Travail thérapeutique et correctif : ne cherchez jamais la charge lourde.',
    position:
      'Corde fixée à la poulie haute, prise neutre pouces vers l’arrière. Reculez d’un ou deux pas.',
    posture:
      'Posture stable en fente ou pieds parallèles, buste droit et abdos engagés.',
    completude:
      'Tirez la corde vers le front et le nez en écartant activement les mains et en tirant les coudes hauts et en arrière (rotation externe de l’épaule). Contractez 2 secondes.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Perte de gainage et traction cervicale inutile si la poulie est trop chargée par rapport aux rotateurs externes.',
    pointsAttention: [
      'Ne laissez pas les coudes tomber vers le bas pendant le tirage.',
      'Ne compensez pas en avançant la tête vers la corde.',
    ],
  },

  // --- BRAS (BICEPS / TRICEPS) ---
  ex_bicep_curl_bar: {
    objectif:
      'Masse globale des biceps (chef long et court) et des avant-bras à l’aide de la barre EZ ergonomique.',
    chargeAdaptee:
      'Charge modérée (8 à 12 reps strictes). Le corps doit rester un bloc de pierre sans oscillation du bassin.',
    position:
      'Debout pieds largeur d’épaules, barre EZ tenue en supination sur les courbures anatomiques.',
    posture:
      'Coudes calés contre les flancs, épaules basses et immobiles, torse bombé.',
    completude:
      'Fléchissez les avant-bras vers le haut sans avancer les coudes. Contractez fort le biceps en haut puis redescendez lentement jusqu’à l’extension complète.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque de tendinopathie bicipitale distale et de contrainte excessive sur le poignet si une barre droite impose une supination forcée (privilégiez la barre EZ) ou en cas d’élan dorsal.',
    pointsAttention: [
      'Ne balancez pas le dos pour faire décoller la barre.',
      'Gardez les coudes fixes : ils ne doivent pas avancer vers l’avant.',
    ],
  },
  ex_skull_crushers: {
    objectif:
      'Isolation de la longue portion et du vaste externe des triceps pour développer l’arrière des bras.',
    chargeAdaptee:
      'Charge modérée à légère (10 à 12 reps lentes et contrôlées). Ne tentez jamais de max sur cet exercice d’isolation.',
    position:
      'Allongé sur le banc, barre EZ tenue à bout de bras avec une prise largeur d’épaules.',
    posture:
      'Bras légèrement inclinés vers l’arrière (environ 75-80° par rapport au sol) pour conserver une tension continue.',
    completude:
      'Pliez uniquement les coudes en amenant la barre vers le sommet du crâne ou juste derrière la tête. Tendez les avant-bras vers le haut sans bouger les bras.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Risque élevé de tendinite du tendon tricipital au niveau de l’olécrâne, et risque de traumatisme crânien en cas de dérapage de la barre vers le visage.',
    pointsAttention: [
      'Gardez les coudes resserrés : ne les laissez pas s’écarter vers l’extérieur.',
      'Contrôlez scrupuleusement la descente pour la sécurité du front.',
    ],
  },
  ex_tricep_pushdown: {
    objectif:
      'Isolation continue des triceps à la poulie haute sans fatigue articulaire.',
    chargeAdaptee:
      'Charge modérée (10 à 15 reps). Coudes verrouillés le long des côtes.',
    position:
      'Debout face à la poulie haute avec la barre droite ou la corde.',
    posture:
      'Buste légèrement penché en avant, coudes collés aux côtes et immobiles pendant toute la série.',
    completude:
      'Poussez la barre ou la corde vers le bas jusqu’à l’extension complète des bras. Avec la corde, écartez légèrement les mains en bas pour un pic de contraction maximal.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Irritation de l’insertion tricipitale au coude si le mouvement est exécuté à froid ou avec à-coups du torse.',
    pointsAttention: [
      'Ne laissez pas les coudes monter et descendre.',
      'Ne vous affaissez pas sur la barre avec le poids du corps.',
    ],
  },

  // --- JAMBES ---
  ex_squat: {
    objectif:
      'Mouvement roi pour le développement complet des quadriceps, fessiers, adducteurs et force du tronc.',
    chargeAdaptee:
      'Charge modérée à lourde (70-80% 1RM, 6 à 10 reps). Ne dépassez jamais la charge permettant de descendre sous la parallèle avec les genoux stables.',
    position:
      'Barre posée sur les trapèzes (high bar) ou l’arrière des deltoïdes (low bar). Pieds écartés largeur d’épaules, pointes tournées à 15-30° vers l’extérieur.',
    posture:
      'Poitrine fière, coudes sous la barre, regard droit devant. Gainage abdominal sous forte pression avant d’entamer la descente.',
    completude:
      'Initiez la descente en poussant simultanément les genoux vers l’extérieur (dans l’axe des orteils) et les hanches vers l’arrière. Descendez au minimum jusqu’à ce que le pli de la hanche casse la parallèle du genou. Remontez en poussant puissamment dans tout le pied.',
    niveauRisque: 'Très Élevé',
    mentionRisque:
      'Risque majeur de lésion méniscale et d’entorse du ligament croisé antérieur en cas d’effondrement des genoux vers l’intérieur (valgus), et hernie discale lombaire si le bas du dos s’arrondit sous la parallèle (rétroversion ou « butt-wink »).',
    pointsAttention: [
      'Ne laissez jamais les genoux rentrer vers l’intérieur (valgus dynamique).',
      'Ne décollez pas les talons du sol.',
      'Ne laissez pas le bas du dos s’arrondir en bas (butt wink excessif).',
    ],
  },
  ex_leg_press: {
    objectif:
      'Surcharge lourde et sécurisée des quadriceps et fessiers sans contrainte axiale sur le rachis.',
    chargeAdaptee:
      'Charge lourde progressive (8 à 12 reps contrôlées). La sécurité apparente de la machine ne doit pas pousser à surcharger au détriment de l’amplitude.',
    position:
      'Dos et fessiers fermement plaqués au dossier. Pieds placés au milieu du plateau à largeur d’épaules.',
    posture:
      'Tenez les poignées latérales fermement pour maintenir le bassin bien plaqué. Nuque posée.',
    completude:
      'Déverrouillez le plateau et descendez-le jusqu’à ce que les genoux forment un angle droit (90°). Repoussez le plateau sans jamais verrouiller les genoux en hyperextension.',
    niveauRisque: 'Élevé',
    mentionRisque:
      'Risque catastrophique d’hyperextension et de luxation inversée des genoux en cas de verrouillage complet des jambes sous la charge (danger absolu), écrasement des vertèbres lombaires si le bassin se décolle du dossier.',
    pointsAttention: [
      'NE JAMAIS verrouiller les genoux en extension complète sous charge lourde.',
      'Ne décollez jamais le bas du dos du dossier en bas de mouvement.',
    ],
  },
  ex_walking_lunges: {
    objectif:
      'Développement unilatéral des quadriceps, du grand fessier, des ischios et de l’équilibre fonctionnel.',
    chargeAdaptee:
      'Poids du corps pour débuter, puis haltères modérés de chaque côté (10 à 12 pas par jambe). Le contrôle de l’équilibre est prioritaire.',
    position:
      'Debout pieds joints, mains sur les hanches ou avec haltères le long du corps.',
    posture:
      'Buste très droit, regard horizontal, abdominaux et fessiers gainés.',
    completude:
      'Faites un grand pas vers l’avant. Fléchissez les deux genoux jusqu’à ce que le genou avant soit à 90° et que le genou arrière effleure le sol sans taper. Poussez dans le talon avant pour enchaîner le pas suivant.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Risque de syndrome fémoro-patellaire si le genou avant part en torsion vers l’intérieur, et contusion de la rotule arrière par choc au sol.',
    pointsAttention: [
      'Ne laissez pas le genou avant s’affaisser vers l’intérieur.',
      'Le genou avant ne doit pas dépasser exagérément la pointe du pied.',
    ],
  },
  ex_romanian_deadlift: {
    objectif:
      'Isolation et étirement sous charge des ischio-jambiers et des fessiers.',
    chargeAdaptee:
      'Charge modérée (60-70% du deadlift classique, 8 à 12 reps). Vous devez pouvoir freiner la descente sur 3 secondes complètes.',
    position:
      'Debout barre ou haltères tenus contre les cuisses, pieds largeur du bassin.',
    posture:
      'Genoux très légèrement déverrouillés (angle fixe de 15°). Dos parfaitement droit, omoplates serrées.',
    completude:
      'Poussez les fesses vers l’arrière comme pour toucher un mur derrière vous. Laissez la barre glisser le long des cuisses jusqu’à mi-tibias en ressentant l’étirement intense des ischios. Contractez les fessiers pour vous redresser.',
    niveauRisque: 'Élevé',
    mentionRisque:
      'Risque d’élongation ou de déchirure aiguë des ischio-jambiers sous tension d’étirement maximal, et lumbago si les lombaires compensent le manque de mobilité de hanche.',
    pointsAttention: [
      'Ne pliez pas davantage les genoux pendant la descente (ce n’est pas un squat).',
      'Ne courbez pas le bas du dos pour chercher à aller toucher le sol.',
    ],
  },

  // --- ABDOMINAUX ---
  ex_plank: {
    objectif:
      'Renforcement isométrique du muscle transverse de l’abdomen et stabilité profonde du caisson abdominal.',
    chargeAdaptee:
      'Poids du corps (30 à 60 secondes en contraction isométrique maximale). Il est préférable d’augmenter l’intensité de gainage plutôt que la durée passive.',
    position:
      'En appui sur les avant-bras (coudes alignés sous les épaules) et sur la pointe des pieds.',
    posture:
      'Corps en planche rigide. Rétroversez légèrement le bassin (rentrez le ventre vers la colonne), serrez les fessiers et les quadriceps à 100%. Regard entre les avant-bras.',
    completude:
      'Maintenez la contraction continue sans bouger pendant toute la durée de la série avec une respiration régulière et contrôlée.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Pincement des disques lombaires et hyperlordose douloureuse dès que le muscle transverse fatigue et que le bassin s’affaisse vers le bas.',
    pointsAttention: [
      'Ne laissez pas le bassin s’affaisser vers le sol (douleurs lombaires).',
      'Ne levez pas les fesses en l’air pour réduire l’effort.',
    ],
  },
  ex_cable_crunch: {
    objectif:
      'Hypertrophie et définition du grand droit de l’abdomen avec surcharge progressive à la poulie.',
    chargeAdaptee:
      'Charge modérée (12 à 15 reps). Ce sont les abdominaux qui enroulent la cage thoracique, pas le poids du corps qui tire sur le câble.',
    position:
      'À genoux face ou dos à la poulie haute, corde tenue fermement des deux côtés de la tête.',
    posture:
      'Hanches stables et fixes au-dessus des genoux. Ne reculez pas les fesses sur les talons.',
    completude:
      'Enroulez la cage thoracique vers le bassin en contractant intensément les abdominaux. Expirez à fond au point de contraction maximale puis déroulez lentement.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Tension parasitaire sur les cervicales si l’on tire la tête avec les bras, ou sollicitation excessive des psoas-iliaques si les hanches reculent.',
    pointsAttention: [
      'Ne fléchissez pas au niveau des hanches : c’est la colonne qui s’enroule, pas le bassin qui recule.',
      'Ne tirez pas avec les bras.',
    ],
  },

  // --- CARDIO ---
  ex_treadmill: {
    objectif:
      'Développement de la capacité cardiovasculaire aérobie, de l’endurance fondamentale et de la dépense calorique.',
    chargeAdaptee:
      'Allure d’endurance fondamentale (Zone 2, conversation aisée) ou vitesse d’intervalle programmée selon la filière énergétique ciblée.',
    position:
      'Au centre du tapis de course, avec une inclinaison minimale de 1% (pour simuler la résistance de l’air).',
    posture:
      'Buste droit, épaules relâchées, regard droit devant. Ne vous accrochez pas aux rampes.',
    completude:
      'Foulée souple et rythmée, attaque médio-pied plutôt que talon agressif. Balancement naturel des bras coordonné avec les jambes.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque de chute traumatique lors des changements d’allure ou par distraction, périostite tibiale et tendinite d’Achille en cas d’attaque talon trop violente ou de chaussures inadaptées.',
    pointsAttention: [
      'Ne courez pas trop près de la console avant ni trop près de l’arrière.',
      'Respirez avec régularité (cycle 2-2 ou 3-3).',
    ],
  },
  ex_running_outdoor: {
    objectif:
      'Développement de l’endurance aérobie fondamentale, de la VO2max, de la santé cardiovasculaire et du renforcement des membres inférieurs en extérieur.',
    chargeAdaptee:
      'Allure d’endurance fondamentale (Zone 2, allure permettant de converser sans essoufflement) ou séances au train / fartlek selon votre niveau.',
    position:
      'En plein air sur terrain régulier (piste d’athlétisme, parc ou route souple). Chaussures de running adaptées à votre foulée et amorti.',
    posture:
      'Buste très légèrement incliné vers l’avant depuis les chevilles (pas depuis la taille), regard à 15-20 mètres devant, épaules relâchées et bras fléchis à 90° avec balancement fluide.',
    completude:
      'Attaque médio-pied sous le centre de gravité pour réduire les impacts articulaires. Cadence régulière idéale autour de 170 à 180 pas par minute.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Risque d’entorse de la cheville sur terrain accidenté, périostite tibiale ou syndrome de l’essuie-glace (TFL) en cas d’augmentation trop brutale du volume kilométrique hebdomadaire.',
    pointsAttention: [
      'Ne posez pas le talon loin devant le corps (freinage et impact excessif sur les genoux).',
      'Augmentez votre volume kilométrique de manière progressive (+10% max par semaine).',
      'Gardez les mains et les mâchoires détendues pendant la course.',
    ],
  },
  ex_elliptical: {
    objectif:
      'Travail cardiorespiratoire global et tonification des membres inférieurs et supérieurs sans aucun choc articulaire.',
    chargeAdaptee:
      'Résistance intermédiaire permettant une cadence fluide de 60 à 75 tours par minute sans à-coups.',
    position:
      'Pieds bien calés à plat sur les pédales, mains sur les poignées mobiles.',
    posture:
      'Dos droit, abdos gainés, épaules basses. Ne pas se pencher vers l’avant sur la console.',
    completude:
      'Mouvement elliptique fluide et continu. Poussez et tirez avec les bras en même temps que l’effort des jambes.',
    niveauRisque: 'Faible',
    mentionRisque:
      'Pression excessive sur les orteils et engourdissement plantaire si les talons se soulèvent constamment des repose-pieds.',
    pointsAttention: [
      'Ne décollez pas les talons des pédales pour éviter les tensions sur les mollets.',
      'Maintenez une résistance suffisante pour garder le contrôle du pédalage.',
    ],
  },
  ex_rower: {
    objectif:
      'Entraînement complet mobilisant 85% des masses musculaires (jambes, dos, bras, cœur) et puissance aérobie.',
    chargeAdaptee:
      'Résistance réglée entre 4 et 6 (drag factor optimal). Ne poussez pas la résistance à 10 pour préserver vos lombaires.',
    position:
      'Pieds sanglés sur les cale-pieds au niveau de la pliure des orteils. Saisissez la poignée à deux mains.',
    posture:
      'Dos droit en permanence, épaules relâchées, torse gainé.',
    completude:
      'Respectez la séquence rigoureuse : 1. Poussée puissante des jambes (60% de l’effort), 2. Ouverture du buste (20%), 3. Tirage des bras vers le bas des côtes (20%). Au retour : bras d’abord, buste ensuite, puis flexion des genoux.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Risque de lombalgie aiguë si l’athlète tire prématurément avec le haut du corps avant l’extension complète des jambes.',
    pointsAttention: [
      'Ne pliez pas les genoux avant que la poignée n’ait dépassé les genoux au retour.',
      'Ne tirez pas uniquement avec le dos : la puissance vient des jambes.',
    ],
  },
  ex_burpees: {
    objectif:
      'Stimulation métabolique extrême, explosivité fonctionnelle et résistance à la fatigue.',
    chargeAdaptee:
      'Poids du corps à cadence soutenue (séries de 10 à 20 répétitions ou format Tabata).',
    position:
      'Debout pieds largeur d’épaules au sol.',
    posture:
      'Gainage constant pour protéger le dos lors de la transition au sol.',
    completude:
      'Enchaînez sans temps mort : 1. Squat avec pose des mains au sol, 2. Jet des pieds en arrière en planche, 3. Pompe complète poitrine au sol, 4. Retour groupé des pieds, 5. Saut vertical avec frappe des mains au-dessus de la tête.',
    niveauRisque: 'Modéré',
    mentionRisque:
      'Hyperextension brutale du rachis lombaire lors du jet de jambes en arrière, et entorse du poignet lors de la frappe des mains au sol.',
    pointsAttention: [
      'Ne laissez pas le bassin s’effondrer au sol lors de la descente en planche.',
      'Amortissez la réception du saut sur l’avant des pieds.',
    ],
  },
};

/**
 * Construit un guide technique complet pour n'importe quel exercice.
 * S'appuie sur la base experte, ou génère un guide biomécanique intelligent
 * basé sur le muscle ciblé et le matériel si l'exercice est personnalisé.
 */
export function getExerciseGuide(exercise: {
  id?: string;
  name?: string;
  description?: string;
  target_muscle?: string;
  equipment_needed?: string;
}): ExerciseGuide {
  const id = exercise.id || '';
  const name = exercise.name || 'Exercice';
  const target = exercise.target_muscle || 'Corps Entier';
  const equipment = exercise.equipment_needed || 'Sans matériel';
  const customDesc = exercise.description || '';

  // Vérifier d'abord les guides personnalisés / réimportés par l'utilisateur, puis la base experte
  const customData = customGuidesCache[id];
  const expertData = EXERCISE_GUIDES_DATABASE[id];
  const data = customData || expertData;

  if (data) {
    return {
      id,
      name,
      target_muscle: target,
      equipment_needed: equipment,
      objectif: data.objectif || `Renforcement et hypertrophie ciblée : ${target}.`,
      chargeAdaptee:
        data.chargeAdaptee ||
        'Charge modérée permettant 8 à 12 répétitions avec 1 à 2 répétitions en réserve (RIR 1-2). Contrôlez la descente sans dégrader la technique.',
      position: data.position || `Installation stable avec : ${equipment}.`,
      posture: data.posture || 'Alignement neutre de la colonne, gainage actif.',
      completude: data.completude || 'Amplitude complète et contrôle de la charge.',
      niveauRisque: data.niveauRisque || 'Modéré',
      mentionRisque:
        data.mentionRisque ||
        'Risque de lésion musculo-tendineuse si la charge entraîne une compensation posturale. Ne sacrifiez jamais la technique pour le poids.',
      pointsAttention: data.pointsAttention || [
        'Contrôlez la phase descendante sans à-coups.',
        'Maintenez le gainage abdominal tout au long du mouvement.',
        'Ne sacrifiez jamais la technique pour la charge.',
      ],
    };
  }

  // Génération intelligente par défaut selon le groupe musculaire et le matériel
  const defaultObjectif =
    customDesc ||
    `Ciblage principal : ${target}. Amélioration de la force fonctionnelle, de la coordination neuromusculaire et du volume musculaire avec ${equipment}.`;

  let defaultCharge =
    'Charge modérée permettant 8 à 12 répétitions avec 1 à 2 répétitions en réserve (RIR 1-2). Privilégiez la précision de contraction.';
  if (equipment.includes('Barre')) {
    defaultCharge =
      'Charge modérée à lourde (65-75% 1RM, 6 à 10 reps). Conservez toujours une marge technique sans chercher l’échec absolu.';
  } else if (equipment.includes('Haltères')) {
    defaultCharge =
      'Charge modérée (8 à 12 reps). Contrôlez la descente sur 2 à 3 secondes et conservez un mouvement symétrique.';
  } else if (equipment.includes('Poulie') || equipment.includes('Machine')) {
    defaultCharge =
      'Charge modérée (10 à 15 reps sous tension continue). Mouvement guidé : maximisez la sensation sans utiliser d’élan.';
  } else if (equipment.includes('Poids du corps') || equipment.includes('Sans matériel')) {
    defaultCharge =
      'Poids du corps (ajustez le levier ou l’amplitude pour réaliser 8 à 15 répétitions propres sans déformation du tronc).';
  }

  let defaultPosition = `Installez-vous confortablement avec votre équipement (${equipment}). Pieds fermement calés et prise assurée.`;
  if (equipment.includes('Barre')) {
    defaultPosition = `Barre réglée à hauteur appropriée dans le rack. Prise symétrique et ferme avec les pouces verrouillés autour de la barre.`;
  } else if (equipment.includes('Haltères')) {
    defaultPosition = `Saisissez une paire d’haltères de poids équivalent. Gardez les poignets alignés dans l’axe des avant-bras.`;
  } else if (equipment.includes('Poulie')) {
    defaultPosition = `Réglez la hauteur de la poulie et fixez la poignée adaptée. Positionnez vos pieds pour une stabilité optimale contre la traction du câble.`;
  } else if (equipment.includes('Banc')) {
    defaultPosition = `Réglez l’inclinaison du banc selon le faisceau recherché. Assise stable et pieds à plat au sol.`;
  }

  const defaultPosture =
    'Omoplates serrées et abaissées, poitrine ouverte, sangle abdominale verrouillée pour protéger le rachis. Respiration synchronisée : inspirez sur la phase descendante (excentrique), expirez sur l’effort (concentrique).';

  const defaultCompletude =
    'Réalisez une amplitude de mouvement complète et physiologique. Freinez la descente sur 2 à 3 secondes pour maximiser la tension mécanique sous étirement, puis produisez une poussée ou un tirage dynamique sans verrouiller brutalement les articulations.';

  let defaultNiveauRisque: RiskLevel = 'Modéré';
  let defaultMentionRisque =
    'Risque de micro-lésion ou de compensation articulaire en cas de charge excessive. Maintenez le gainage abdominal actif.';

  if (target.includes('Dos')) {
    defaultNiveauRisque = 'Élevé';
    defaultMentionRisque =
      'Risque de cisaillement ou de hernie discale lombaire si le bas du dos s’arrondit sous l’effort. Ne courbez jamais la colonne vertébrale.';
  } else if (target.includes('Jambes') || target.includes('Quadriceps') || target.includes('Fessiers')) {
    defaultNiveauRisque = equipment.includes('Barre') ? 'Très Élevé' : 'Élevé';
    defaultMentionRisque =
      'Risque d’entorse ou de lésion méniscale si les genoux s’effondrent vers l’intérieur (valgus). Alignez toujours les genoux avec les pointes de pieds.';
  } else if (target.includes('Épaules')) {
    defaultNiveauRisque = 'Modéré';
    defaultMentionRisque =
      'Risque de conflit sous-acromial et de tendinopathie de la coiffe des rotateurs si les épaules haussent ou si la charge est trop lourde.';
  } else if (target.includes('Pectoraux')) {
    defaultNiveauRisque = equipment.includes('Barre') ? 'Élevé' : 'Modéré';
    defaultMentionRisque =
      'Risque d’étirement excessif du grand pectoral et d’instabilité antérieure de l’épaule si les coudes s’écartent à 90° à l’horizontale.';
  } else if (equipment.includes('Machine') || equipment.includes('Poulie')) {
    defaultNiveauRisque = 'Faible';
    defaultMentionRisque =
      'Risque modéré : veillez à ne pas heurter violemment les butées de la machine et à contrôler le retour de la charge.';
  }

  const defaultPointsAttention = [
    'Contrôlez chaque répétition sans utiliser d’élan ni balancer le torse.',
    'Ne bloquez pas votre respiration : maintenez un souffle fluide et puissant.',
    'Conservez toujours la neutralité lombaire et cervicale sans à-coups.',
    'En cas de dégradation de la posture, réduisez la charge ou arrêtez la série.',
  ];

  return {
    id,
    name,
    target_muscle: target,
    equipment_needed: equipment,
    objectif: defaultObjectif,
    chargeAdaptee: defaultCharge,
    position: defaultPosition,
    posture: defaultPosture,
    completude: defaultCompletude,
    niveauRisque: defaultNiveauRisque,
    mentionRisque: defaultMentionRisque,
    pointsAttention: defaultPointsAttention,
  };
}
