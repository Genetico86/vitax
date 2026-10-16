import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/db';
import {
  EggRarity,
  PokemonEgg,
  PokemonSpecies,
  IncubatorSlot,
  EggHatchResult,
} from '../types';

export const MAX_UNHATCHED_EGGS = 9;
export const STORAGE_KEY_ACTIVE_BUDDY = '@vitax_active_buddy_id';

// -------------------------------------------------------------
// POKÉDEX COMPLET DES 60+ ESPÈCES DE POKÉMON (SPORT & FITNESS)
// -------------------------------------------------------------
export const POKEMON_SPECIES: PokemonSpecies[] = [
  // ===========================================================
  // 🟢 STARTERS, ÉVOLUTIONS & DÉBUTANTS (Oeufs Découverte 200 XP & Évolutions)
  // ===========================================================
  // Famille Bulbizarre (Plante)
  {
    id: 'bulbizarre',
    name: 'Bulbizarre',
    pokedexNumber: 1,
    emoji: '🍃',
    type: 'Plante / Poison',
    baseCp: 420,
    rarity: 'starter',
    description: 'Graine d’athlète sur le dos qui puise son énergie dans chaque goutte de sueur.',
    isLegendary: false,
    evolvesTo: 'herbizarre',
    evolutionXpRequired: 500,
    evolutionStage: 1,
    buddyBuffType: 'plante',
    buddyBuffDescription: '+15% d’XP sur la première séance du jour',
    buddyBuffShort: '+15% XP 1ère Séance',
  },
  {
    id: 'herbizarre',
    name: 'Herbizarre',
    pokedexNumber: 2,
    emoji: '🌿',
    type: 'Plante / Poison',
    baseCp: 950,
    rarity: 'athlete',
    description: 'Le bourgeon floral grossit au fil des séances intenses et régulières.',
    isLegendary: false,
    evolvesFrom: 'bulbizarre',
    evolvesTo: 'florizarre',
    evolutionXpRequired: 1200,
    evolutionStage: 2,
    buddyBuffType: 'plante',
    buddyBuffDescription: '+20% d’XP sur la première séance du jour',
    buddyBuffShort: '+20% XP 1ère Séance',
  },
  {
    id: 'florizarre',
    name: 'Florizarre',
    pokedexNumber: 3,
    emoji: '🌺',
    type: 'Plante / Poison',
    baseCp: 1980,
    rarity: 'champion',
    description: 'Fleur royale épanouie, synthèse parfaite de la force brute et de la récupération durable.',
    isLegendary: false,
    evolvesFrom: 'herbizarre',
    evolutionStage: 3,
    buddyBuffType: 'plante',
    buddyBuffDescription: '+25% d’XP sur la première séance du jour & boost métabolique',
    buddyBuffShort: '+25% XP 1ère Séance',
  },

  // Famille Salamèche (Feu)
  {
    id: 'salameche',
    name: 'Salamèche',
    pokedexNumber: 4,
    emoji: '🔥',
    type: 'Feu',
    baseCp: 430,
    rarity: 'starter',
    description: 'La flamme au bout de sa queue brûle au rythme de vos séries géantes et de vos efforts.',
    isLegendary: false,
    evolvesTo: 'reptincel',
    evolutionXpRequired: 500,
    evolutionStage: 1,
    buddyBuffType: 'feu',
    buddyBuffDescription: '+10% d’XP sur les séances intenses (> 40 min ou > 10 séries)',
    buddyBuffShort: '+10% XP Intensité',
  },
  {
    id: 'reptincel',
    name: 'Reptincel',
    pokedexNumber: 5,
    emoji: '🦎',
    type: 'Feu',
    baseCp: 980,
    rarity: 'athlete',
    description: 'Griffes acérées et tempérament explosif, prêt à déchiqueter chaque record personnel.',
    isLegendary: false,
    evolvesFrom: 'salameche',
    evolvesTo: 'dracaufeu',
    evolutionXpRequired: 1200,
    evolutionStage: 2,
    buddyBuffType: 'feu',
    buddyBuffDescription: '+15% d’XP sur les séances intenses (> 40 min ou > 10 séries)',
    buddyBuffShort: '+15% XP Intensité',
  },
  {
    id: 'dracaufeu',
    name: 'Dracaufeu',
    pokedexNumber: 6,
    emoji: '🐲',
    type: 'Feu / Vol',
    baseCp: 2150,
    rarity: 'champion',
    description: 'Dragon ailé colossal dont le souffle ardent consume les barres les plus lourdes de la salle.',
    isLegendary: false,
    evolvesFrom: 'reptincel',
    evolutionStage: 3,
    buddyBuffType: 'feu',
    buddyBuffDescription: '+20% d’XP sur les séances intenses (> 40 min ou > 10 séries)',
    buddyBuffShort: '+20% XP Intensité',
  },

  // Famille Carapuce (Eau)
  {
    id: 'carapuce',
    name: 'Carapuce',
    pokedexNumber: 7,
    emoji: '💧',
    type: 'Eau',
    baseCp: 420,
    rarity: 'starter',
    description: 'Carapace ultra-solide capable d’encaisser n’importe quelle charge sous les barres.',
    isLegendary: false,
    evolvesTo: 'carabaffe',
    evolutionXpRequired: 500,
    evolutionStage: 1,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+5% d’XP global et récupération musculaire active',
    buddyBuffShort: '+5% XP & Récupération',
  },
  {
    id: 'carabaffe',
    name: 'Carabaffe',
    pokedexNumber: 8,
    emoji: '🐢',
    type: 'Eau',
    baseCp: 940,
    rarity: 'athlete',
    description: 'Queue duveteuse et posture hydrodynamique pour maintenir le cap même sous haute tension.',
    isLegendary: false,
    evolvesFrom: 'carapuce',
    evolvesTo: 'tortank',
    evolutionXpRequired: 1200,
    evolutionStage: 2,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+8% d’XP global et récupération musculaire active',
    buddyBuffShort: '+8% XP & Récupération',
  },
  {
    id: 'tortank',
    name: 'Tortank',
    pokedexNumber: 9,
    emoji: '🌊',
    type: 'Eau',
    baseCp: 2050,
    rarity: 'champion',
    description: 'Deux canons dorsaux propulsant des jets surpuissants, armure invulnérable pour la fonte.',
    isLegendary: false,
    evolvesFrom: 'carabaffe',
    evolutionStage: 3,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+12% d’XP global et armure de récupération contre le surentraînement',
    buddyBuffShort: '+12% XP & Récupération',
  },

  // Famille Roucool (Agilité)
  {
    id: 'roucool',
    name: 'Roucool',
    pokedexNumber: 16,
    emoji: '🕊️',
    type: 'Normal / Vol',
    baseCp: 380,
    rarity: 'starter',
    description: 'Agilité et vivacité parfaites pour optimiser les temps de repos entre deux exercices.',
    isLegendary: false,
    evolvesTo: 'roucoups',
    evolutionXpRequired: 400,
    evolutionStage: 1,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+5% d’XP endurance et dynamisme entre les séries',
    buddyBuffShort: '+5% XP Vivacité',
  },
  {
    id: 'roucoups',
    name: 'Roucoups',
    pokedexNumber: 17,
    emoji: '🦅',
    type: 'Normal / Vol',
    baseCp: 820,
    rarity: 'athlete',
    description: 'Serres puissantes et acuité visuelle pour cibler avec précision chaque groupe musculaire.',
    isLegendary: false,
    evolvesFrom: 'roucool',
    evolvesTo: 'roucarnage',
    evolutionXpRequired: 950,
    evolutionStage: 2,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+8% d’XP endurance et dynamisme',
    buddyBuffShort: '+8% XP Vivacité',
  },
  {
    id: 'roucarnage',
    name: 'Roucarnage',
    pokedexNumber: 18,
    emoji: '🪶',
    type: 'Normal / Vol',
    baseCp: 1720,
    rarity: 'champion',
    description: 'Envergure majestueuse fendant l’air à Mach 2, le roi des cadences d’entraînement rapides.',
    isLegendary: false,
    evolvesFrom: 'roucoups',
    evolutionStage: 3,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+12% d’XP endurance et vitesse de transition entre exercices',
    buddyBuffShort: '+12% XP Vivacité',
  },

  // Famille Pichu / Pikachu (Électrik)
  {
    id: 'pichu',
    name: 'Pichu',
    pokedexNumber: 172,
    emoji: '⚡',
    type: 'Électrik',
    baseCp: 280,
    rarity: 'starter',
    description: 'Petit souriceau énergique dont les petites décharges motivent dès l’échauffement.',
    isLegendary: false,
    evolvesTo: 'pikachu',
    evolutionXpRequired: 350,
    evolutionStage: 1,
    buddyBuffType: 'electrik',
    buddyBuffDescription: '+10% de vitesse d’incubation sur tous vos incubateurs',
    buddyBuffShort: '+10% Vitesse Incubateurs',
  },
  {
    id: 'pikachu',
    name: 'Pikachu',
    pokedexNumber: 25,
    emoji: '⚡',
    type: 'Électrik',
    baseCp: 550,
    rarity: 'starter',
    description: 'Souris électrique et mascotte de Kanto, adore les séries intenses et les tempos rapides !',
    isLegendary: false,
    evolvesFrom: 'pichu',
    evolvesTo: 'raichu',
    evolutionXpRequired: 800,
    evolutionStage: 2,
    buddyBuffType: 'electrik',
    buddyBuffDescription: '+15% de vitesse d’incubation sur tous vos incubateurs',
    buddyBuffShort: '+15% Vitesse Incubateurs',
  },
  {
    id: 'raichu',
    name: 'Raichu',
    pokedexNumber: 26,
    emoji: '🌩️',
    type: 'Électrik',
    baseCp: 1680,
    rarity: 'champion',
    description: 'Décharge jusqu’à 100 000 volts pour foudroyer l’inertie et dynamiter vos entraînements.',
    isLegendary: false,
    evolvesFrom: 'pikachu',
    evolutionStage: 3,
    buddyBuffType: 'electrik',
    buddyBuffDescription: '+25% de vitesse d’incubation sur tous vos incubateurs',
    buddyBuffShort: '+25% Vitesse Incubateurs',
  },

  // Famille Nidoran Fémelle
  {
    id: 'nidoran_f',
    name: 'Nidoran♀',
    pokedexNumber: 29,
    emoji: '🐭',
    type: 'Poison',
    baseCp: 390,
    rarity: 'starter',
    description: 'Petite mais ultra-résistante, s’accroche avec ténacité à chaque répétition.',
    isLegendary: false,
    evolvesTo: 'nidorina',
    evolutionXpRequired: 450,
    evolutionStage: 1,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+5% d’XP sur les exercices de musculation',
    buddyBuffShort: '+5% XP Muscu',
  },
  {
    id: 'nidorina',
    name: 'Nidorina',
    pokedexNumber: 30,
    emoji: '🦏',
    type: 'Poison',
    baseCp: 890,
    rarity: 'athlete',
    description: 'Muscles denses et esprit de meute pour encourager chaque partenaire d’entraînement.',
    isLegendary: false,
    evolvesFrom: 'nidoran_f',
    evolvesTo: 'nidoqueen',
    evolutionXpRequired: 1050,
    evolutionStage: 2,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+8% d’XP sur les exercices de musculation',
    buddyBuffShort: '+8% XP Muscu',
  },
  {
    id: 'nidoqueen',
    name: 'Nidoqueen',
    pokedexNumber: 31,
    emoji: '👑',
    type: 'Poison / Sol',
    baseCp: 1880,
    rarity: 'champion',
    description: 'Armure écailleuse d’une densité rare, reine incontestée de la puissance corporelle.',
    isLegendary: false,
    evolvesFrom: 'nidorina',
    evolutionStage: 3,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+15% d’XP sur tous les exercices de musculation',
    buddyBuffShort: '+15% XP Muscu',
  },

  // Famille Nidoran Mâle
  {
    id: 'nidoran_m',
    name: 'Nidoran♂',
    pokedexNumber: 32,
    emoji: '🦔',
    type: 'Poison',
    baseCp: 400,
    rarity: 'starter',
    description: 'Corne frontale dure comme le diamant, charge tête baissée dans la séance.',
    isLegendary: false,
    evolvesTo: 'nidorino',
    evolutionXpRequired: 450,
    evolutionStage: 1,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+5% d’XP sur les exercices de musculation',
    buddyBuffShort: '+5% XP Muscu',
  },
  {
    id: 'nidorino',
    name: 'Nidorino',
    pokedexNumber: 33,
    emoji: '🐗',
    type: 'Poison',
    baseCp: 910,
    rarity: 'athlete',
    description: 'Énergie débordante ne reculant devant aucun défi de force ou de tonnage.',
    isLegendary: false,
    evolvesFrom: 'nidoran_m',
    evolvesTo: 'nidoking',
    evolutionXpRequired: 1050,
    evolutionStage: 2,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+8% d’XP sur les exercices de musculation',
    buddyBuffShort: '+8% XP Muscu',
  },
  {
    id: 'nidoking',
    name: 'Nidoking',
    pokedexNumber: 34,
    emoji: '🤴',
    type: 'Poison / Sol',
    baseCp: 1920,
    rarity: 'champion',
    description: 'Titan titanesque capable de broyer la roche d’un coup de queue, roi de la fonte.',
    isLegendary: false,
    evolvesFrom: 'nidorino',
    evolutionStage: 3,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+15% d’XP sur tous les exercices de musculation',
    buddyBuffShort: '+15% XP Muscu',
  },

  // Famille Férosinge (Rage & Intensité)
  {
    id: 'ferosinge',
    name: 'Férosinge',
    pokedexNumber: 56,
    emoji: '🐒',
    type: 'Combat',
    baseCp: 440,
    rarity: 'starter',
    description: 'S’énerve si on interrompt sa série, canalise sa rage dans chaque rep.',
    isLegendary: false,
    evolvesTo: 'colossinge',
    evolutionXpRequired: 650,
    evolutionStage: 1,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+8% d’XP musculation sur les séries lourdes',
    buddyBuffShort: '+8% XP Séries Lourdes',
  },
  {
    id: 'colossinge',
    name: 'Colossinge',
    pokedexNumber: 57,
    emoji: '🦍',
    type: 'Combat',
    baseCp: 1320,
    rarity: 'athlete',
    description: 'Ne s’arrête jamais tant que la charge n’est pas montée, cardio et rage illimités.',
    isLegendary: false,
    evolvesFrom: 'ferosinge',
    evolutionStage: 2,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+15% d’XP musculation sur les séries lourdes',
    buddyBuffShort: '+15% XP Séries Lourdes',
  },

  // Famille Caninos (Détermination & Chaleur)
  {
    id: 'caninos',
    name: 'Caninos',
    pokedexNumber: 58,
    emoji: '🐕',
    type: 'Feu',
    baseCp: 510,
    rarity: 'starter',
    description: 'Loyal et infatigable compagnon de salle, toujours prêt à pousser jusqu’à l’échec.',
    isLegendary: false,
    evolvesTo: 'arcanin',
    evolutionXpRequired: 850,
    evolutionStage: 1,
    buddyBuffType: 'feu',
    buddyBuffDescription: '+10% d’XP sur les séances de plus de 30 min',
    buddyBuffShort: '+10% XP Séances 30m+',
  },
  {
    id: 'arcanin',
    name: 'Arcanin',
    pokedexNumber: 59,
    emoji: '🦁',
    type: 'Feu',
    baseCp: 1880,
    rarity: 'champion',
    description: 'Créature majestueuse dont la flamme intérieure insuffle une fierté athlétique exemplaire.',
    isLegendary: false,
    evolvesFrom: 'caninos',
    evolutionStage: 2,
    buddyBuffType: 'feu',
    buddyBuffDescription: '+18% d’XP séances intenses et endurance athlétique',
    buddyBuffShort: '+18% XP Séances Intenses',
  },

  // Famille Abra (Concentration mentale)
  {
    id: 'abra',
    name: 'Abra',
    pokedexNumber: 63,
    emoji: '🔮',
    type: 'Psy',
    baseCp: 390,
    rarity: 'starter',
    description: 'Dort 18 heures par jour pour une récupération neuromusculaire optimale.',
    isLegendary: false,
    evolvesTo: 'kadabra',
    evolutionXpRequired: 450,
    evolutionStage: 1,
    buddyBuffType: 'psy',
    buddyBuffDescription: '+5% de chance d’obtenir un œuf Champion en fin de séance',
    buddyBuffShort: '+5% Drop Œufs Rares',
  },
  {
    id: 'kadabra',
    name: 'Kadabra',
    pokedexNumber: 64,
    emoji: '🥄',
    type: 'Psy',
    baseCp: 950,
    rarity: 'athlete',
    description: 'Plie les cuillères et verrouille la connexion esprit-muscle à chaque contraction.',
    isLegendary: false,
    evolvesFrom: 'abra',
    evolvesTo: 'alakazam',
    evolutionXpRequired: 1150,
    evolutionStage: 2,
    buddyBuffType: 'psy',
    buddyBuffDescription: '+10% de chance d’obtenir un œuf Champion en fin de séance',
    buddyBuffShort: '+10% Drop Œufs Rares',
  },
  {
    id: 'alakazam',
    name: 'Alakazam',
    pokedexNumber: 65,
    emoji: '🧙',
    type: 'Psy',
    baseCp: 1980,
    rarity: 'champion',
    description: 'QI de 5 000 points, programme chaque cycle de surcharge progressive au millimètre.',
    isLegendary: false,
    evolvesFrom: 'kadabra',
    evolutionStage: 3,
    buddyBuffType: 'psy',
    buddyBuffDescription: '+15% de chance de drops rares et concentration neuromusculaire absolue',
    buddyBuffShort: '+15% Drop Œufs Rares',
  },

  // ===========================================================
  // 🟠 ATHLÈTES DE FORCE (Oeufs Athlète 500 XP & Évolutions)
  // ===========================================================
  // Famille Machoc (Musculation pure)
  {
    id: 'machoc',
    name: 'Machoc',
    pokedexNumber: 66,
    emoji: '🥋',
    type: 'Combat',
    baseCp: 510,
    rarity: 'starter',
    description: 'Soulève des rochers pour s’échauffer et ne rate absolument jamais un leg day !',
    isLegendary: false,
    evolvesTo: 'machopeur',
    evolutionXpRequired: 600,
    evolutionStage: 1,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+10% d’XP sur les exercices de musculation',
    buddyBuffShort: '+10% XP Muscu',
  },
  {
    id: 'machopeur',
    name: 'Machopeur',
    pokedexNumber: 67,
    emoji: '💪',
    type: 'Combat',
    baseCp: 1190,
    rarity: 'athlete',
    description: 'Porte une ceinture dorée pour canaliser son extraordinaire masse musculaire.',
    isLegendary: false,
    evolvesFrom: 'machoc',
    evolvesTo: 'mackogneur',
    evolutionXpRequired: 1500,
    evolutionStage: 2,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+15% d’XP sur les exercices de musculation',
    buddyBuffShort: '+15% XP Muscu',
  },
  {
    id: 'mackogneur',
    name: 'Mackogneur',
    pokedexNumber: 68,
    emoji: '🥊',
    type: 'Combat',
    baseCp: 2350,
    rarity: 'champion',
    description: 'Quatre bras herculéens assénant 1 000 coups en deux secondes, l’icône absolue de la musculation.',
    isLegendary: false,
    evolvesFrom: 'machopeur',
    evolutionStage: 3,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+20% d’XP sur tous les exercices de musculation',
    buddyBuffShort: '+20% XP Muscu',
  },

  // Famille Racaillou (Roche & Tonnage)
  {
    id: 'racaillou',
    name: 'Racaillou',
    pokedexNumber: 74,
    emoji: '🪨',
    type: 'Roche / Sol',
    baseCp: 440,
    rarity: 'starter',
    description: 'Boule de granit pure avec deux avant-bras d’acier pour grimper et porter sans faillir.',
    isLegendary: false,
    evolvesTo: 'gravalanch',
    evolutionXpRequired: 500,
    evolutionStage: 1,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+30 XP bonus tous les 2 000 kg soulevés',
    buddyBuffShort: '+30 XP / 2T Volume',
  },
  {
    id: 'gravalanch',
    name: 'Gravalanch',
    pokedexNumber: 75,
    emoji: '⛰️',
    type: 'Roche / Sol',
    baseCp: 1050,
    rarity: 'athlete',
    description: 'Dévale les pentes en roulant sur les obstacles, densité minérale à toute épreuve.',
    isLegendary: false,
    evolvesFrom: 'racaillou',
    evolvesTo: 'grolem',
    evolutionXpRequired: 1300,
    evolutionStage: 2,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+60 XP bonus tous les 2 000 kg soulevés',
    buddyBuffShort: '+60 XP / 2T Volume',
  },
  {
    id: 'grolem',
    name: 'Grolem',
    pokedexNumber: 76,
    emoji: '🌋',
    type: 'Roche / Sol',
    baseCp: 2150,
    rarity: 'champion',
    description: 'Masse géologique impénétrable capable de résister aux explosions et aux charges records.',
    isLegendary: false,
    evolvesFrom: 'gravalanch',
    evolutionStage: 3,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+100 XP bonus tous les 2 000 kg soulevés',
    buddyBuffShort: '+100 XP / 2T Volume',
  },

  // Famille Fantominus (Détermination & Mental)
  {
    id: 'fantominus',
    name: 'Fantominus',
    pokedexNumber: 92,
    emoji: '👻',
    type: 'Spectre / Poison',
    baseCp: 390,
    rarity: 'starter',
    description: 'Nappe gazeuse insaisissable qui s’infiltre dans votre esprit pour balayer le doute.',
    isLegendary: false,
    evolvesTo: 'spectrum',
    evolutionXpRequired: 450,
    evolutionStage: 1,
    buddyBuffType: 'psy',
    buddyBuffDescription: '+5% d’XP détermination mentale',
    buddyBuffShort: '+5% XP Mental',
  },
  {
    id: 'spectrum',
    name: 'Spectrum',
    pokedexNumber: 93,
    emoji: '🔮',
    type: 'Spectre / Poison',
    baseCp: 930,
    rarity: 'athlete',
    description: 'Mains flottantes indépendantes prêtes à assister chaque barre jusqu’au verrouillage.',
    isLegendary: false,
    evolvesFrom: 'fantominus',
    evolvesTo: 'ectoplasma',
    evolutionXpRequired: 1150,
    evolutionStage: 2,
    buddyBuffType: 'psy',
    buddyBuffDescription: '+8% d’XP détermination mentale',
    buddyBuffShort: '+8% XP Mental',
  },
  {
    id: 'ectoplasma',
    name: 'Ectoplasma',
    pokedexNumber: 94,
    emoji: '😈',
    type: 'Spectre / Poison',
    baseCp: 1950,
    rarity: 'champion',
    description: 'Sourire provocateur qui vous pousse à aller chercher la répétition de trop sans hésiter.',
    isLegendary: false,
    evolvesFrom: 'spectrum',
    evolutionStage: 3,
    buddyBuffType: 'psy',
    buddyBuffDescription: '+15% d’XP détermination et surpassement mental',
    buddyBuffShort: '+15% XP Mental',
  },

  // Famille Onix (Structure & Colonne)
  {
    id: 'onix',
    name: 'Onix',
    pokedexNumber: 95,
    emoji: '🪨',
    type: 'Roche / Sol',
    baseCp: 950,
    rarity: 'athlete',
    description: 'Serpent colossal de roche brute, symbole d’une structure posturale inébranlable.',
    isLegendary: false,
    evolvesTo: 'steelix',
    evolutionXpRequired: 1300,
    evolutionStage: 1,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+50 XP tous les 2 000 kg de volume déplacé',
    buddyBuffShort: '+50 XP / 2T Volume',
  },
  {
    id: 'steelix',
    name: 'Steelix',
    pokedexNumber: 208,
    emoji: '🔩',
    type: 'Acier / Sol',
    baseCp: 2200,
    rarity: 'champion',
    description: 'Corps en acier trempé forgé par la pression des profondeurs et la fonte des salles.',
    isLegendary: false,
    evolvesFrom: 'onix',
    evolutionStage: 2,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+120 XP tous les 2 000 kg de volume déplacé',
    buddyBuffShort: '+120 XP / 2T Volume',
  },

  // Spécialistes du Combat & des Arts Martiaux
  {
    id: 'tygnon',
    name: 'Tygnon',
    pokedexNumber: 106,
    emoji: '🥊',
    type: 'Combat',
    baseCp: 1200,
    rarity: 'athlete',
    description: 'Spécialiste de la frappe explosive, ses directs fendent l’air à vitesse supersonique.',
    isLegendary: false,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+12% d’XP sur les exercices du haut du corps (pectoraux, bras, épaules)',
    buddyBuffShort: '+12% XP Haut du Corps',
  },
  {
    id: 'kicklee',
    name: 'Kicklee',
    pokedexNumber: 107,
    emoji: '🦵',
    type: 'Combat',
    baseCp: 1190,
    rarity: 'athlete',
    description: 'Jambes flexibles en acier trempé capables de détruire un mur en un seul coup de pied.',
    isLegendary: false,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+12% d’XP sur les exercices du bas du corps (squat, fentes, mollets)',
    buddyBuffShort: '+12% XP Leg Day',
  },
  {
    id: 'kapoera',
    name: 'Kapoera',
    pokedexNumber: 237,
    emoji: '🤸',
    type: 'Combat',
    baseCp: 1170,
    rarity: 'athlete',
    description: 'Tournoie sur la tête avec une agilité acrobatique et un gainage ventral parfait.',
    isLegendary: false,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+10% d’XP sur les exercices au poids du corps et abdominaux',
    buddyBuffShort: '+10% XP Gainage & Calisthénie',
  },

  // Famille Rhinocorne (Puissance & Charge)
  {
    id: 'rhinocorne',
    name: 'Rhinocorne',
    pokedexNumber: 111,
    emoji: '🦏',
    type: 'Sol / Roche',
    baseCp: 680,
    rarity: 'starter',
    description: 'Bâti en blocs de pierre, ne s’arrête jamais une fois lancé vers l’objectif.',
    isLegendary: false,
    evolvesTo: 'rhinoferos',
    evolutionXpRequired: 850,
    evolutionStage: 1,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+40 XP par palier de 2 000 kg soulevés',
    buddyBuffShort: '+40 XP / 2T Volume',
  },
  {
    id: 'rhinoferos',
    name: 'Rhinoféros',
    pokedexNumber: 112,
    emoji: '🦏',
    type: 'Sol / Roche',
    baseCp: 1720,
    rarity: 'champion',
    description: 'Corne capable de forer le métal le plus dur, posture d’ancrage indestructible.',
    isLegendary: false,
    evolvesFrom: 'rhinocorne',
    evolutionStage: 2,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+90 XP par palier de 2 000 kg soulevés',
    buddyBuffShort: '+90 XP / 2T Volume',
  },

  // Famille Insécateur / Cizayox
  {
    id: 'insecateur',
    name: 'Insécateur',
    pokedexNumber: 123,
    emoji: '🦗',
    type: 'Insecte / Vol',
    baseCp: 1240,
    rarity: 'athlete',
    description: 'Lames tranchantes et réflexes ultra-rapides pour fendre les charges à tempo soutenu.',
    isLegendary: false,
    evolvesTo: 'cizayox',
    evolutionXpRequired: 1200,
    evolutionStage: 1,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+10% d’XP sur les séries dynamiques et tempos explosifs',
    buddyBuffShort: '+10% XP Explosivité',
  },
  {
    id: 'cizayox',
    name: 'Cizayox',
    pokedexNumber: 212,
    emoji: '🔩',
    type: 'Acier / Insecte',
    baseCp: 2190,
    rarity: 'champion',
    description: 'Pinces d’acier trempé capables de broyer n’importe quel haltère, précision chirurgicale.',
    isLegendary: false,
    evolvesFrom: 'insecateur',
    evolutionStage: 2,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+18% d’XP vitesse, force et rigueur d’exécution',
    buddyBuffShort: '+18% XP Rigueur & Force',
  },

  // Insectes de combat
  {
    id: 'scarabrute',
    name: 'Scarabrute',
    pokedexNumber: 127,
    emoji: '🪲',
    type: 'Insecte',
    baseCp: 1260,
    rarity: 'athlete',
    description: 'Pinces surpuissantes capables de soulever 100 fois son propre poids à la cage.',
    isLegendary: false,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+12% d’XP sur les exercices de dos et tirages',
    buddyBuffShort: '+12% XP Dos & Tirages',
  },
  {
    id: 'scarhino',
    name: 'Scarhino',
    pokedexNumber: 214,
    emoji: '🪲',
    type: 'Insecte / Combat',
    baseCp: 1380,
    rarity: 'athlete',
    description: 'Corne unique capable de projeter un adversaire de 100 kg au-dessus des arbres.',
    isLegendary: false,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+14% d’XP sur le développé couché et les mouvements de poussée',
    buddyBuffShort: '+14% XP Développés',
  },
  {
    id: 'tauros',
    name: 'Tauros',
    pokedexNumber: 128,
    emoji: '🐂',
    type: 'Normal',
    baseCp: 1300,
    rarity: 'athlete',
    description: 'Trois queues fouettant l’air pour stimuler une charge furieuse dans chaque superset.',
    isLegendary: false,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+10% d’XP endurance musculaire inépuisable',
    buddyBuffShort: '+10% XP Endurance Muscu',
  },

  // Famille Magicarpe / Léviator (La métamorphose ultime du sportif)
  {
    id: 'magicarpe',
    name: 'Magicarpe',
    pokedexNumber: 129,
    emoji: '🐟',
    type: 'Eau',
    baseCp: 150,
    rarity: 'starter',
    description: 'Trempette inoffensive en apparence, symbole de celui qui débute tout en bas de l’échelle.',
    isLegendary: false,
    evolvesTo: 'leviator',
    evolutionXpRequired: 1000,
    evolutionStage: 1,
    buddyBuffType: 'eau',
    buddyBuffDescription: 'Persévérance de fer : +5 XP d’encouragement par série complétée',
    buddyBuffShort: '+5 XP / Série',
  },
  {
    id: 'leviator',
    name: 'Léviator',
    pokedexNumber: 130,
    emoji: '🐉',
    type: 'Eau / Vol',
    baseCp: 2250,
    rarity: 'champion',
    description: 'Transformation spectaculaire récompensant des mois de persévérance acharnée.',
    isLegendary: false,
    evolvesFrom: 'magicarpe',
    evolutionStage: 2,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+20% d’XP global récompensant l’effort d’avoir fait évoluer la carpe !',
    buddyBuffShort: '+20% XP Puissance Suprême',
  },

  // ===========================================================
  // 🟣 CHAMPIONS D’ENDURANCE (Oeufs Champion 1 000 XP & Évolutions)
  // ===========================================================
  // Famille Évoli (Évolutions multiples)
  {
    id: 'evoli',
    name: 'Évoli',
    pokedexNumber: 133,
    emoji: '🦊',
    type: 'Normal',
    baseCp: 460,
    rarity: 'starter',
    description: 'Potentiel d’évolution infini, s’adapte avec souplesse à tous vos cycles d’entraînement.',
    isLegendary: false,
    evolutionStage: 1,
    possibleEvolutions: ['aquali', 'voltali', 'pyroli'],
    evolutionXpRequired: 750,
    buddyBuffType: 'combat',
    buddyBuffDescription: '+8% d’XP équilibré sur tous les exercices',
    buddyBuffShort: '+8% XP Équilibré',
  },
  {
    id: 'aquali',
    name: 'Aquali',
    pokedexNumber: 134,
    emoji: '🧜',
    type: 'Eau',
    baseCp: 1820,
    rarity: 'champion',
    description: 'Cellules assimilables à l’eau pour dissoudre les courbatures et optimiser l’hydratation.',
    isLegendary: false,
    evolvesFrom: 'evoli',
    evolutionStage: 2,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+15% d’XP récupération et hydratation musculaire',
    buddyBuffShort: '+15% XP & Récupération',
  },
  {
    id: 'voltali',
    name: 'Voltali',
    pokedexNumber: 135,
    emoji: '⚡',
    type: 'Électrik',
    baseCp: 1830,
    rarity: 'champion',
    description: 'Poils hérissés prêts à foudroyer l’inertie et booster l’incubation de vos œufs.',
    isLegendary: false,
    evolvesFrom: 'evoli',
    evolutionStage: 2,
    buddyBuffType: 'electrik',
    buddyBuffDescription: '+20% de vitesse d’incubation sur tous vos incubateurs',
    buddyBuffShort: '+20% Vitesse Incubateurs',
  },
  {
    id: 'pyroli',
    name: 'Pyroli',
    pokedexNumber: 136,
    emoji: '🔥',
    type: 'Feu',
    baseCp: 1850,
    rarity: 'champion',
    description: 'Température corporelle de 900°C pour brûler les calories et chauffer chaque groupe musculaire.',
    isLegendary: false,
    evolvesFrom: 'evoli',
    evolutionStage: 2,
    buddyBuffType: 'feu',
    buddyBuffDescription: '+15% d’XP sur les séances de force et haute intensité',
    buddyBuffShort: '+15% XP Force & Cardio',
  },

  // Poids Lourds Titans
  {
    id: 'lokhlass',
    name: 'Lokhlass',
    pokedexNumber: 131,
    emoji: '🌊',
    type: 'Eau / Glace',
    baseCp: 1780,
    rarity: 'champion',
    description: 'Endurance inépuisable naviguant à travers l’effort intense sans jamais faiblir.',
    isLegendary: false,
    buddyBuffType: 'eau',
    buddyBuffDescription: '+12% d’XP endurance et résistance au surentraînement',
    buddyBuffShort: '+12% XP Anti-Fatigue',
  },
  {
    id: 'ptera',
    name: 'Ptéra',
    pokedexNumber: 142,
    emoji: '🦅',
    type: 'Roche / Vol',
    baseCp: 1820,
    rarity: 'champion',
    description: 'Féroce titan préhistorique à l’explosivité et au mordant inégalés.',
    isLegendary: false,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+10% d’XP vitesse et puissance explosive',
    buddyBuffShort: '+10% XP Explosivité',
  },
  {
    id: 'ronflex',
    name: 'Ronflex',
    pokedexNumber: 143,
    emoji: '💤',
    type: 'Normal',
    baseCp: 2020,
    rarity: 'champion',
    description: 'Masse brute colossale, capable de bloquer une route et de soulever 10 tonnes sans trembler !',
    isLegendary: false,
    buddyBuffType: 'roche',
    buddyBuffDescription: '+80 XP bonus tous les 2 000 kg et anabolisme serein',
    buddyBuffShort: '+80 XP / 2T Volume',
  },

  // Famille Minidraco / Draco / Dracolosse (Dragon)
  {
    id: 'minidraco',
    name: 'Minidraco',
    pokedexNumber: 147,
    emoji: '🐉',
    type: 'Dragon',
    baseCp: 620,
    rarity: 'champion',
    description: 'Génétique d’élite qui annonce un futur titan redoutable pour la Ligue.',
    isLegendary: false,
    evolvesTo: 'draco',
    evolutionXpRequired: 950,
    evolutionStage: 1,
    buddyBuffType: 'psy',
    buddyBuffDescription: 'Génétique d’élite : +10% d’XP global sur toutes vos séances',
    buddyBuffShort: '+10% XP Élite',
  },
  {
    id: 'draco',
    name: 'Draco',
    pokedexNumber: 148,
    emoji: '🐲',
    type: 'Dragon',
    baseCp: 1420,
    rarity: 'champion',
    description: 'Aura mystique capable de contrôler le climat et de stabiliser votre rythme cardiaque.',
    isLegendary: false,
    evolvesFrom: 'minidraco',
    evolvesTo: 'dracolosse',
    evolutionXpRequired: 1900,
    evolutionStage: 2,
    buddyBuffType: 'psy',
    buddyBuffDescription: 'Grâce athlétique : +15% d’XP global sur toutes vos séances',
    buddyBuffShort: '+15% XP Élite',
  },
  {
    id: 'dracolosse',
    name: 'Dracolosse',
    pokedexNumber: 149,
    emoji: '🐉',
    type: 'Dragon / Vol',
    baseCp: 2550,
    rarity: 'champion',
    description: 'Titan légendaire capable de voler autour du globe en 16 heures, la consécration du sportif.',
    isLegendary: false,
    evolvesFrom: 'draco',
    evolutionStage: 3,
    buddyBuffType: 'psy',
    buddyBuffDescription: 'Titan Gardien : +22% d’XP global sur toutes vos séances d’entraînement',
    buddyBuffShort: '+22% XP Titan Gardien',
  },

  // ===========================================================
  // ⭐ POKÉMON LÉGENDAIRES (Oeufs 2 500 - 3 500 XP) — DÉFIS SPÉCIFIQUES
  // ===========================================================
  {
    id: 'artikodin',
    name: 'Artikodin',
    pokedexNumber: 144,
    emoji: '❄️',
    type: 'Glace / Vol',
    baseCp: 2850,
    rarity: 'legendary',
    description: 'Oiseau légendaire du blizzard, gardien du sang-froid et de la force pure des 10 000 kg !',
    isLegendary: true,
    unlockedByChallenge: 'Force de Ronflex (10 Tonnes)',
    buddyBuffType: 'eau',
    buddyBuffDescription: '+20% d’XP global et récupération musculaire cryogénique',
    buddyBuffShort: '+20% XP Cryo',
  },
  {
    id: 'electhor',
    name: 'Électhor',
    pokedexNumber: 145,
    emoji: '⚡',
    type: 'Électrik / Vol',
    baseCp: 2900,
    rarity: 'legendary',
    description: 'Oiseau légendaire de la foudre qui décharge son énergie sur la cage et les poulies haute/basse !',
    isLegendary: true,
    unlockedByChallenge: 'Champion du Rack 900',
    buddyBuffType: 'electrik',
    buddyBuffDescription: '+35% de vitesse d’incubation sur tous vos incubateurs',
    buddyBuffShort: '+35% Vitesse Incubateurs',
  },
  {
    id: 'sulfura',
    name: 'Sulfura',
    pokedexNumber: 146,
    emoji: '🔥',
    type: 'Feu / Vol',
    baseCp: 2950,
    rarity: 'legendary',
    description: 'Oiseau légendaire du feu, consumant l’effort dans une brûlure musculaire absolue sur 50 séries !',
    isLegendary: true,
    unlockedByChallenge: 'Attaque Combo (50 Séries)',
    buddyBuffType: 'feu',
    buddyBuffDescription: '+25% d’XP sur toutes vos séances et feu sacré du sport',
    buddyBuffShort: '+25% XP Feu Sacré',
  },
  {
    id: 'mewtwo',
    name: 'Mewtwo',
    pokedexNumber: 150,
    emoji: '🧬',
    type: 'Psy Suprême',
    baseCp: 3500,
    rarity: 'legendary',
    description: 'Création génétique suprême d’une puissance incommensurable, conquis avec les 8 Badges de Kanto !',
    isLegendary: true,
    unlockedByChallenge: 'Badge Terre (8 Badges Conquis)',
    buddyBuffType: 'psy',
    buddyBuffDescription: '+30% d’XP global et domination mentale totale de l’arène',
    buddyBuffShort: '+30% XP Domination',
  },
  {
    id: 'mew',
    name: 'Mew',
    pokedexNumber: 151,
    emoji: '🌟',
    type: 'Psy Fabuleux',
    baseCp: 3250,
    rarity: 'legendary',
    description: 'Pokémon fabuleux d’origine contenant le code génétique de tous les plus grands champions.',
    isLegendary: true,
    unlockedByChallenge: 'Maître du Conseil 4 (20 Séances)',
    buddyBuffType: 'psy',
    buddyBuffDescription: '+25% d’XP global et harmonie métabolique absolue',
    buddyBuffShort: '+25% XP Harmonie',
  },
  {
    id: 'lugia',
    name: 'Lugia',
    pokedexNumber: 249,
    emoji: '🌊',
    type: 'Psy / Vol',
    baseCp: 3400,
    rarity: 'legendary',
    description: 'Gardien des mers légendaire capable de calmer les tempêtes par sa seule force tranquille.',
    isLegendary: true,
    unlockedByChallenge: 'Grand Maître Athlète (50 Séances)',
    buddyBuffType: 'eau',
    buddyBuffDescription: '+28% d’XP global et souffle protecteur d’endurance',
    buddyBuffShort: '+28% XP Gardien',
  },
  {
    id: 'ho_oh',
    name: 'Ho-Oh',
    pokedexNumber: 250,
    emoji: '🌈',
    type: 'Feu / Vol',
    baseCp: 3450,
    rarity: 'legendary',
    description: 'Oiseau arc-en-ciel mythique promesse de renaissance et de longévité athlétique éternelle.',
    isLegendary: true,
    unlockedByChallenge: 'Titan de Johto (30 000 kg soulevés)',
    buddyBuffType: 'feu',
    buddyBuffDescription: '+30% d’XP global et flamme de persévérance infinie',
    buddyBuffShort: '+30% XP Renaissance',
  },
];

// Configuration des raretés d'œufs
export const EGG_RARITY_CONFIG: Record<
  EggRarity,
  { name: string; requiredXp: number; emoji: string; color: string; bg: string }
> = {
  starter: {
    name: 'Œuf Découverte',
    requiredXp: 200,
    emoji: '🟢',
    color: '#10B981',
    bg: '#10231B',
  },
  athlete: {
    name: 'Œuf Athlète',
    requiredXp: 500,
    emoji: '🟠',
    color: '#F97316',
    bg: '#251A13',
  },
  champion: {
    name: 'Œuf Champion',
    requiredXp: 1000,
    emoji: '🟣',
    color: '#A855F7',
    bg: '#22152D',
  },
  legendary: {
    name: 'Œuf Légendaire',
    requiredXp: 2500,
    emoji: '⭐',
    color: '#EAB308',
    bg: '#2B2310',
  },
};

// -------------------------------------------------------------
// DÉTERMINATION DES 4 ESPACES D'INCUBATION
// -------------------------------------------------------------
export function computeIncubatorSlots(
  totalXp: number,
  totalSessions: number,
  totalVolumeKg: number,
  eggs: PokemonEgg[],
  maxUnlockedSlot: number = 1
): IncubatorSlot[] {
  // Slot 1 : Incubateur Basique (Infini)
  const slot1Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 1) || null;
  const slot1: IncubatorSlot = {
    slot_number: 1,
    name: 'Incubateur Basique',
    emoji: '🟢',
    is_unlocked: true,
    unlock_condition: 'Débloqué par défaut dès le départ',
    egg: slot1Egg,
  };

  // Slot 2 : Super-Incubateur (Badge Cascade 500 XP ou 5 séances)
  const slot2Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 2) || null;
  const slot2Unlocked = totalXp >= 500 || totalSessions >= 5 || maxUnlockedSlot >= 2 || Boolean(slot2Egg);
  const slot2: IncubatorSlot = {
    slot_number: 2,
    name: 'Super-Incubateur',
    emoji: '💧',
    is_unlocked: slot2Unlocked,
    unlock_condition: 'Badge Cascade (500 XP) ou 5 séances terminées',
    egg: slot2Egg,
  };

  // Slot 3 : Hyper-Incubateur (Badge Prisme 2200 XP ou 15 séances)
  const slot3Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 3) || null;
  const slot3Unlocked = totalXp >= 2200 || totalSessions >= 15 || maxUnlockedSlot >= 3 || Boolean(slot3Egg);
  const slot3: IncubatorSlot = {
    slot_number: 3,
    name: 'Hyper-Incubateur',
    emoji: '🌈',
    is_unlocked: slot3Unlocked,
    unlock_condition: 'Badge Prisme (2 200 XP) ou 15 séances terminées',
    egg: slot3Egg,
  };

  // Slot 4 : Incubateur Maître (Badge Terre 10500 XP ou 10 Tonnes)
  const slot4Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 4) || null;
  const slot4Unlocked = totalXp >= 10500 || totalVolumeKg >= 10000 || maxUnlockedSlot >= 4 || Boolean(slot4Egg);
  const slot4: IncubatorSlot = {
    slot_number: 4,
    name: 'Incubateur Maître',
    emoji: '🌍',
    is_unlocked: slot4Unlocked,
    unlock_condition: 'Badge Terre (10 500 XP) ou 10 000 kg soulevés',
    egg: slot4Egg,
  };

  return [slot1, slot2, slot3, slot4];
}

// -------------------------------------------------------------
// GESTION EN BASE DE DONNÉES (SQLITE HORS-LIGNE)
// -------------------------------------------------------------

/**
 * Initialise l'œuf de bienvenue au premier démarrage si la base est vide
 */
export async function ensureStarterEggInitialized(): Promise<void> {
  const db = await getDatabase();
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(id) as count FROM pokemon_eggs'
  );

  if ((countRow?.count || 0) === 0) {
    const now = new Date().toISOString();
    // 1er œuf placé dans l'incubateur 1
    await db.runAsync(
      `INSERT INTO pokemon_eggs (id, name, rarity, required_xp, current_xp, status, incubator_slot, obtained_from, obtained_at, is_legendary, current_pokemon_xp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        'egg_starter_welcome',
        'Œuf Découverte',
        'starter',
        200,
        0,
        'incubating',
        1,
        'Bienvenue sur Vitax !',
        now,
      ]
    );

    // 2e œuf de réserve dans l'inventaire
    await db.runAsync(
      `INSERT INTO pokemon_eggs (id, name, rarity, required_xp, current_xp, status, incubator_slot, obtained_from, obtained_at, is_legendary, current_pokemon_xp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        'egg_athlete_gift',
        'Œuf Athlète',
        'athlete',
        500,
        0,
        'inventory',
        null,
        'Cadeau d’Athlète Débutant',
        now,
      ]
    );
  }
}

/**
 * Récupère tous les œufs enregistrés
 */
export async function getAllPokemonEggs(): Promise<PokemonEgg[]> {
  await ensureStarterEggInitialized();
  const db = await getDatabase();
  return await db.getAllAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs ORDER BY CASE status WHEN 'incubating' THEN 1 WHEN 'inventory' THEN 2 ELSE 3 END, obtained_at DESC"
  );
}

/**
 * Place un œuf dans un espace d'incubation libre
 */
export async function placeEggInSlot(eggId: string, slotNumber: number): Promise<boolean> {
  const db = await getDatabase();

  const existingInSlot = await db.getFirstAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs WHERE incubator_slot = ? AND status = 'incubating' AND id != ?",
    [slotNumber, eggId]
  );
  if (existingInSlot) {
    return false;
  }

  await db.runAsync(
    "UPDATE pokemon_eggs SET status = 'incubating', incubator_slot = ? WHERE id = ?",
    [slotNumber, eggId]
  );

  try {
    const rawMax = await AsyncStorage.getItem('@vitax_max_unlocked_incubator');
    const currMax = rawMax ? parseInt(rawMax, 10) : 1;
    if (slotNumber > currMax) {
      await AsyncStorage.setItem('@vitax_max_unlocked_incubator', String(slotNumber));
    }
  } catch {}

  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après placement d’œuf:', syncErr);
  }

  return true;
}

/**
 * Retire un œuf de l'incubateur pour le remettre dans l'inventaire
 */
export async function removeEggFromSlot(eggId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE pokemon_eggs SET status = 'inventory', incubator_slot = NULL WHERE id = ?",
    [eggId]
  );

  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après retrait d’œuf:', syncErr);
  }
}

/**
 * Ajoute un nouvel œuf à l'inventaire
 */
export async function addPokemonEgg(
  rarity: EggRarity,
  obtainedFrom: string,
  specificPokemonId?: string
): Promise<PokemonEgg> {
  const db = await getDatabase();
  const config = EGG_RARITY_CONFIG[rarity];
  const eggId = `egg_${rarity}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const isLegendary = rarity === 'legendary' ? 1 : 0;

  let assignedPokemon: PokemonSpecies | undefined;
  if (specificPokemonId) {
    assignedPokemon = POKEMON_SPECIES.find((p) => p.id === specificPokemonId);
  }

  const eggName = assignedPokemon
    ? `Œuf de ${assignedPokemon.name}`
    : config.name;

  await db.runAsync(
    `INSERT INTO pokemon_eggs (id, name, rarity, required_xp, current_xp, status, incubator_slot, obtained_from, obtained_at, pokemon_id, pokemon_name, pokemon_emoji, pokemon_type, is_legendary, current_pokemon_xp)
     VALUES (?, ?, ?, ?, 0, 'inventory', NULL, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      eggId,
      eggName,
      rarity,
      config.requiredXp,
      obtainedFrom,
      now,
      assignedPokemon?.id || null,
      assignedPokemon?.name || null,
      assignedPokemon?.emoji || null,
      assignedPokemon?.type || null,
      isLegendary,
    ]
  );

  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après ajout œuf:', syncErr);
  }

  return {
    id: eggId,
    name: eggName,
    rarity,
    required_xp: config.requiredXp,
    current_xp: 0,
    status: 'inventory',
    incubator_slot: null,
    obtained_from: obtainedFrom,
    obtained_at: now,
    pokemon_id: assignedPokemon?.id || null,
    pokemon_name: assignedPokemon?.name || null,
    pokemon_emoji: assignedPokemon?.emoji || null,
    pokemon_type: assignedPokemon?.type || null,
    is_legendary: isLegendary,
    current_pokemon_xp: 0,
  };
}

// -------------------------------------------------------------
// OPTION A : DROP D'ŒUFS AUTOMATIQUE EN FIN DE SÉANCE
// -------------------------------------------------------------

export interface WorkoutEggDropResult {
  egg: PokemonEgg | null;
  reason?: 'dropped' | 'inventory_full' | 'insufficient_effort';
}

/**
 * Détermine et ajoute l'œuf gagné à la fin d'une séance terminée
 * - Réserve max : 9 œufs non-éclos (inventory + incubating)
 * - Rareté indexée sur l'intensité réelle :
 *   * Légère (< 30 min ou < 8 séries) : starter (200 XP)
 *   * Intense (50 min+ ou 15 séries+ ou volume >= 5 000 kg) : champion (1 000 XP)
 *   * Standard : athlete (500 XP)
 */
export async function determineWorkoutEggDrop(sessionStats: {
  durationSeconds: number;
  completedSets: number;
  totalVolumeKg: number;
  programName?: string | null;
}): Promise<WorkoutEggDropResult> {
  const db = await getDatabase();
  const existingEggs = await db.getAllAsync<PokemonEgg>('SELECT * FROM pokemon_eggs');
  const unhatchedCount = existingEggs.filter((e) => e.status !== 'hatched').length;

  if (unhatchedCount >= MAX_UNHATCHED_EGGS) {
    return { egg: null, reason: 'inventory_full' };
  }

  // Si moins d'une série ou aucun effort enregistré
  if (sessionStats.completedSets <= 0 && sessionStats.durationSeconds < 180) {
    return { egg: null, reason: 'insufficient_effort' };
  }

  // Déterminer la rareté selon les critères d'intensité
  let rarity: EggRarity = 'athlete';
  if (sessionStats.durationSeconds < 1800 && sessionStats.completedSets < 8) {
    rarity = 'starter';
  } else if (
    sessionStats.durationSeconds >= 3000 ||
    sessionStats.completedSets >= 15 ||
    sessionStats.totalVolumeKg >= 5000
  ) {
    rarity = 'champion';
  } else {
    rarity = 'athlete';
  }

  // Bonus : si le Compagnon Actif est de type Psy, petite chance de surclasser la rareté
  try {
    const buddy = await getActiveBuddy();
    if (buddy?.species?.buddyBuffType === 'psy' && rarity === 'athlete' && Math.random() < 0.2) {
      rarity = 'champion';
    }
  } catch {}

  const reasonLabel = sessionStats.programName
    ? `Fin de séance : ${sessionStats.programName}`
    : `Séance terminée (${sessionStats.completedSets} séries, ${Math.round(sessionStats.durationSeconds / 60)} min)`;

  const droppedEgg = await addPokemonEgg(rarity, reasonLabel);
  return { egg: droppedEgg, reason: 'dropped' };
}

// -------------------------------------------------------------
// OPTION A : SYSTÈME DE COMPAGNON ACTIF ("BUDDY POKÉMON")
// -------------------------------------------------------------

export interface ActiveBuddyInfo {
  egg: PokemonEgg;
  species: PokemonSpecies;
}

export interface ActiveBuddyBuffInfo {
  type: 'combat' | 'electrik' | 'feu' | 'roche' | 'eau' | 'plante' | 'psy';
  label: string;
  description: string;
  multiplier: number;
  shortLabel: string;
}

/**
 * Récupère le Pokémon actuellement défini comme Compagnon Actif
 */
export async function getActiveBuddy(): Promise<ActiveBuddyInfo | null> {
  try {
    const buddyEggId = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_BUDDY);
    if (!buddyEggId) return null;

    const db = await getDatabase();
    const egg = await db.getFirstAsync<PokemonEgg>(
      "SELECT * FROM pokemon_eggs WHERE id = ? AND status = 'hatched'",
      [buddyEggId]
    );
    if (!egg || !egg.pokemon_id) return null;

    const species = POKEMON_SPECIES.find((s) => s.id === egg.pokemon_id);
    if (!species) return null;

    return { egg, species };
  } catch (err) {
    console.warn('Erreur getActiveBuddy:', err);
    return null;
  }
}

/**
 * Définit ou retire le Compagnon Actif
 */
export async function setActiveBuddy(eggId: string | null): Promise<void> {
  if (eggId) {
    await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_BUDDY, eggId);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_BUDDY);
  }
}

/**
 * Récupère le buff sportif passif du compagnon actif
 */
export async function getActiveBuddyBuff(): Promise<ActiveBuddyBuffInfo | null> {
  const buddy = await getActiveBuddy();
  if (!buddy || !buddy.species) return null;

  const species = buddy.species;
  const buffType = species.buddyBuffType || 'combat';

  let multiplier = 1.0;
  switch (buffType) {
    case 'combat':
      multiplier = 1.10;
      break;
    case 'electrik':
      multiplier = 1.15;
      break;
    case 'feu':
      multiplier = 1.10;
      break;
    case 'roche':
      multiplier = 1.0;
      break;
    case 'eau':
      multiplier = 1.05;
      break;
    case 'plante':
      multiplier = 1.15;
      break;
    case 'psy':
      multiplier = 1.0;
      break;
  }

  return {
    type: buffType,
    label: species.name,
    description: species.buddyBuffDescription || 'Compagnon d’entraînement fidèle',
    shortLabel: species.buddyBuffShort || species.name,
    multiplier,
  };
}

// -------------------------------------------------------------
// OPTION A : SYSTÈME D'ÉVOLUTION SPORTIVE
// -------------------------------------------------------------

/**
 * Vérifie si un Pokémon éclos peut évoluer
 */
export function canPokemonEvolve(egg: PokemonEgg): {
  canEvolve: boolean;
  currentXp: number;
  requiredXp: number;
  nextSpecies?: PokemonSpecies;
  possibleSpecies?: PokemonSpecies[];
} {
  if (egg.status !== 'hatched' || !egg.pokemon_id) {
    return { canEvolve: false, currentXp: 0, requiredXp: 0 };
  }

  const species = POKEMON_SPECIES.find((s) => s.id === egg.pokemon_id);
  if (!species) {
    return { canEvolve: false, currentXp: 0, requiredXp: 0 };
  }

  // Évolutions multiples (Évoli)
  if (species.possibleEvolutions && species.possibleEvolutions.length > 0) {
    const requiredXp = species.evolutionXpRequired || 750;
    const currentXp = egg.current_pokemon_xp || 0;
    const possibleSpecies = species.possibleEvolutions
      .map((id) => POKEMON_SPECIES.find((s) => s.id === id))
      .filter((s): s is PokemonSpecies => Boolean(s));

    return {
      canEvolve: currentXp >= requiredXp,
      currentXp,
      requiredXp,
      possibleSpecies,
    };
  }

  if (!species.evolvesTo) {
    return { canEvolve: false, currentXp: egg.current_pokemon_xp || 0, requiredXp: 0 };
  }

  const nextSpecies = POKEMON_SPECIES.find((s) => s.id === species.evolvesTo);
  const requiredXp = species.evolutionXpRequired || 500;
  const currentXp = egg.current_pokemon_xp || 0;

  return {
    canEvolve: currentXp >= requiredXp,
    currentXp,
    requiredXp,
    nextSpecies,
  };
}

/**
 * Fait évoluer un Pokémon possédé vers son stade supérieur
 */
export async function evolvePokemon(
  eggId: string,
  targetSpeciesId?: string
): Promise<{
  success: boolean;
  evolvedEgg?: PokemonEgg;
  previousSpecies?: PokemonSpecies;
  evolvedSpecies?: PokemonSpecies;
  error?: string;
}> {
  const db = await getDatabase();
  const egg = await db.getFirstAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs WHERE id = ? AND status = 'hatched'",
    [eggId]
  );

  if (!egg || !egg.pokemon_id) {
    return { success: false, error: 'Pokémon introuvable' };
  }

  const currentSpecies = POKEMON_SPECIES.find((s) => s.id === egg.pokemon_id);
  if (!currentSpecies) {
    return { success: false, error: 'Espèce introuvable' };
  }

  // Déterminer la nouvelle espèce
  let newSpeciesId = currentSpecies.evolvesTo;
  if (currentSpecies.possibleEvolutions && currentSpecies.possibleEvolutions.length > 0) {
    if (targetSpeciesId && currentSpecies.possibleEvolutions.includes(targetSpeciesId)) {
      newSpeciesId = targetSpeciesId;
    } else {
      newSpeciesId = currentSpecies.possibleEvolutions[0];
    }
  }

  if (!newSpeciesId) {
    return { success: false, error: 'Ce Pokémon a déjà atteint sa forme finale' };
  }

  const targetSpecies = POKEMON_SPECIES.find((s) => s.id === newSpeciesId);
  if (!targetSpecies) {
    return { success: false, error: 'Nouvelle espèce non reconnue' };
  }

  const requiredXp = currentSpecies.evolutionXpRequired || 500;
  const currentXp = egg.current_pokemon_xp || 0;
  if (currentXp < requiredXp) {
    return {
      success: false,
      error: `XP d’entraînement insuffisant (${currentXp}/${requiredXp} XP nécessaires)`,
    };
  }

  // Nouveau CP avec boost d'évolution (+500 à +1000 CP selon base)
  const cpGain = Math.floor(Math.random() * 80) + 50;
  const newCp = Math.max((egg.pokemon_cp || 0) + 500, targetSpecies.baseCp + cpGain);
  const remainingXp = Math.max(0, currentXp - requiredXp);

  await db.runAsync(
    `UPDATE pokemon_eggs
     SET pokemon_id = ?,
         pokemon_name = ?,
         pokemon_emoji = ?,
         pokemon_type = ?,
         pokemon_cp = ?,
         current_pokemon_xp = ?
     WHERE id = ?`,
    [
      targetSpecies.id,
      targetSpecies.name,
      targetSpecies.emoji,
      targetSpecies.type,
      newCp,
      remainingXp,
      egg.id,
    ]
  );

  const evolvedEgg: PokemonEgg = {
    ...egg,
    pokemon_id: targetSpecies.id,
    pokemon_name: targetSpecies.name,
    pokemon_emoji: targetSpecies.emoji,
    pokemon_type: targetSpecies.type,
    pokemon_cp: newCp,
    current_pokemon_xp: remainingXp,
  };

  // Synchronisation Cloud immédiate de l'évolution
  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après évolution:', syncErr);
  }

  return {
    success: true,
    evolvedEgg,
    previousSpecies: currentSpecies,
    evolvedSpecies: targetSpecies,
  };
}

// -------------------------------------------------------------
// DISTRIBUTION D'XP D'ENTRAÎNEMENT & ÉCLOSIONS
// -------------------------------------------------------------

/**
 * Distribue l'XP d'entraînement à tous les œufs en cours d'incubation,
 * applique les buffs du Compagnon Actif et nourrit les Pokémon en XP d'évolution
 */
export async function distributeWorkoutXpToIncubators(
  xpEarned: number
): Promise<{
  updatedEggs: PokemonEgg[];
  newlyHatched: EggHatchResult[];
}> {
  await ensureStarterEggInitialized();
  const db = await getDatabase();

  // Vérifier le buff du Compagnon Actif pour les incubateurs
  let effectiveIncubatorXp = xpEarned;
  try {
    const buddyBuff = await getActiveBuddyBuff();
    if (buddyBuff?.type === 'electrik') {
      effectiveIncubatorXp = Math.round(xpEarned * buddyBuff.multiplier);
    }
  } catch (bErr) {
    console.warn('Erreur lecture buddy buff pour incubateurs:', bErr);
  }

  const incubatingEggs = await db.getAllAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs WHERE status = 'incubating'"
  );

  const newlyHatched: EggHatchResult[] = [];
  const updatedEggs: PokemonEgg[] = [];

  for (const egg of incubatingEggs) {
    const newXp = egg.current_xp + effectiveIncubatorXp;
    const isReadyToHatch = newXp >= egg.required_xp;

    if (isReadyToHatch) {
      let chosenSpecies: PokemonSpecies | undefined;
      if (egg.pokemon_id) {
        chosenSpecies = POKEMON_SPECIES.find((p) => p.id === egg.pokemon_id);
      }

      if (!chosenSpecies) {
        // Tirage aléatoire parmi les espèces de base (stage 1 ou sans stage)
        const candidates = POKEMON_SPECIES.filter(
          (p) =>
            p.rarity === egg.rarity &&
            !p.isLegendary &&
            (!p.evolutionStage || p.evolutionStage === 1)
        );
        chosenSpecies =
          candidates[Math.floor(Math.random() * candidates.length)] ||
          POKEMON_SPECIES[0];
      }

      // Bonus CP aléatoire (+0 à +80 CP)
      const cpBonus = Math.floor(Math.random() * 80);
      const finalCp = chosenSpecies.baseCp + cpBonus;
      const now = new Date().toISOString();

      await db.runAsync(
        `UPDATE pokemon_eggs 
         SET status = 'hatched', 
             current_xp = ?, 
             incubator_slot = NULL, 
             hatched_at = ?,
             pokemon_id = ?,
             pokemon_name = ?,
             pokemon_emoji = ?,
             pokemon_type = ?,
             pokemon_cp = ?,
             is_legendary = ?,
             current_pokemon_xp = 0
         WHERE id = ?`,
        [
          egg.required_xp,
          now,
          chosenSpecies.id,
          chosenSpecies.name,
          chosenSpecies.emoji,
          chosenSpecies.type,
          finalCp,
          chosenSpecies.isLegendary ? 1 : 0,
          egg.id,
        ]
      );

      const hatchedResult: EggHatchResult = {
        egg: {
          ...egg,
          current_xp: egg.required_xp,
          status: 'hatched',
          incubator_slot: null,
          hatched_at: now,
          pokemon_id: chosenSpecies.id,
          pokemon_name: chosenSpecies.name,
          pokemon_emoji: chosenSpecies.emoji,
          pokemon_type: chosenSpecies.type,
          pokemon_cp: finalCp,
          is_legendary: chosenSpecies.isLegendary ? 1 : 0,
          current_pokemon_xp: 0,
        },
        pokemonName: chosenSpecies.name,
        pokemonEmoji: chosenSpecies.emoji,
        pokemonType: chosenSpecies.type,
        pokemonCp: finalCp,
        isLegendary: chosenSpecies.isLegendary,
        description: chosenSpecies.description,
      };

      newlyHatched.push(hatchedResult);
      updatedEggs.push(hatchedResult.egg);
    } else {
      await db.runAsync(
        'UPDATE pokemon_eggs SET current_xp = ? WHERE id = ?',
        [newXp, egg.id]
      );

      updatedEggs.push({
        ...egg,
        current_xp: newXp,
      });
    }
  }

  // -----------------------------------------------------------
  // Distribution de l'XP d'évolution aux Pokémon éclos possédés
  // - Compagnon Actif : 100% de l'XP d'entraînement
  // - Reste de l'équipe : 25% de l'XP d'entraînement
  // -----------------------------------------------------------
  try {
    const activeBuddy = await getActiveBuddy();
    const hatchedEggs = await db.getAllAsync<PokemonEgg>(
      "SELECT * FROM pokemon_eggs WHERE status = 'hatched'"
    );

    for (const p of hatchedEggs) {
      const isBuddy = activeBuddy && activeBuddy.egg.id === p.id;
      const gainedXp = isBuddy ? xpEarned : Math.round(xpEarned * 0.25);
      if (gainedXp > 0) {
        const nextXp = (p.current_pokemon_xp || 0) + gainedXp;
        await db.runAsync(
          'UPDATE pokemon_eggs SET current_pokemon_xp = ? WHERE id = ?',
          [nextXp, p.id]
        );
      }
    }
  } catch (evoErr) {
    console.warn('Erreur distribution XP évolution aux Pokémon:', evoErr);
  }

  // Synchronisation Cloud immédiate
  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après gain XP œufs:', syncErr);
  }

  return { updatedEggs, newlyHatched };
}

// -------------------------------------------------------------
// DÉFIS LÉGENDAIRES & SYNCHRONISATION
// -------------------------------------------------------------

/**
 * Synchronise les défis légendaires et offre les œufs associés aux challenges remplis
 */
export async function syncLegendaryChallengeEggs(stats: {
  totalSessions: number;
  totalSetsCount: number;
  totalVolumeKg: number;
  totalXp: number;
  hasRack900Session: boolean;
}): Promise<PokemonEgg[]> {
  const db = await getDatabase();
  const existingEggs = await db.getAllAsync<PokemonEgg>('SELECT * FROM pokemon_eggs');
  const awardedEggs: PokemonEgg[] = [];

  const checkAndAward = async (
    challengeKey: string,
    pokemonId: string,
    obtainedReason: string,
    condition: boolean
  ) => {
    if (!condition) return;

    const alreadyHas = existingEggs.some(
      (e) => e.pokemon_id === pokemonId || (e.obtained_from && e.obtained_from.includes(challengeKey))
    );

    if (!alreadyHas) {
      const awarded = await addPokemonEgg('legendary', obtainedReason, pokemonId);
      awardedEggs.push(awarded);
    }
  };

  // 1. Défi Champion du Rack 900 ➔ Électhor ⚡
  await checkAndAward(
    'Rack 900',
    'electhor',
    'Défi Débloqué : Champion du Rack 900',
    stats.hasRack900Session
  );

  // 2. Défi Force de Ronflex (10 Tonnes) ➔ Artikodin ❄️
  await checkAndAward(
    '10 Tonnes',
    'artikodin',
    'Défi Débloqué : Force de Ronflex (10 Tonnes)',
    stats.totalVolumeKg >= 10000
  );

  // 3. Défi Attaque Combo (50 Séries) ➔ Sulfura 🔥
  await checkAndAward(
    '50 Séries',
    'sulfura',
    'Défi Débloqué : Attaque Combo (50 Séries)',
    stats.totalSetsCount >= 50
  );

  // 4. Défi Badge Terre / 8 Badges (10 500 XP) ➔ Mewtwo 🧬
  await checkAndAward(
    'Badge Terre',
    'mewtwo',
    'Défi Débloqué : Badge Terre (8 Badges de Kanto)',
    stats.totalXp >= 10500
  );

  // 5. Défi Maître du Conseil 4 (20 Séances) ➔ Mew 🌟
  await checkAndAward(
    'Conseil 4',
    'mew',
    'Défi Débloqué : Maître du Conseil 4 (20 Séances)',
    stats.totalSessions >= 20
  );

  // S'il n'y a plus aucun œuf en réserve (moins de 2 œufs non éclos), offrir un œuf de motivation
  const unhatchedCount = existingEggs.filter((e) => e.status !== 'hatched').length;
  if (unhatchedCount < 2 && stats.totalSessions >= 1) {
    const rarityToAward: EggRarity = stats.totalSessions >= 8 ? 'champion' : 'athlete';
    const egg = await addPokemonEgg(
      rarityToAward,
      `Récompense de constance (Séance #${stats.totalSessions})`
    );
    awardedEggs.push(egg);
  }

  return awardedEggs;
}
