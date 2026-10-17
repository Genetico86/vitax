export type LeagueTier = 'pierre' | 'cascade' | 'foudre' | 'volcan' | 'maitre';

export interface LeagueConfig {
  tier: LeagueTier;
  name: string;
  emoji: string;
  color: string;
  minXpRequirement: number;
  promotionSpots: number;
  relegationSpots: number;
}

export interface TrainerProfile {
  id: string;
  username: string;
  friendCode: string; // e.g. "48219" (code unique à 5 chiffres)
  trainerTitle: string;
  avatarPokemonId: string;
  avatarPokemonEmoji: string;
  avatarUrl?: string;
  currentLeague: LeagueTier;
  totalXp: number;
  totalWorkouts: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  trainerTitle: string;
  avatarPokemonEmoji: string;
  avatarUrl?: string;
  weeklyXp: number;
  totalTonnageKg: number;
  cardioMinutes: number;
  workoutsCount: number;
  isCurrentUser: boolean;
  trend: 'up' | 'down' | 'same';
}

export type TradeStatus = 'available' | 'pending' | 'completed' | 'cancelled';

export interface PokemonTradeOffer {
  id: string;
  senderId: string;
  senderName: string;
  senderCode: string;
  offeredPokemon: {
    id: string;
    speciesId: string;
    name: string;
    emoji: string;
    type: string;
    cp: number;
    isLegendary: boolean;
  };
  requestedSpeciesId?: string; // optionnel: souhaite un Pokémon précis
  requestedCriteriaText?: string; // ex: "N'importe quel type Eau ou Feu"
  receiverId?: string;
  receiverName?: string;
  returnedPokemon?: {
    id: string;
    speciesId: string;
    name: string;
    emoji: string;
    type: string;
    cp: number;
    isLegendary: boolean;
  };
  friendsOnly?: boolean; // restreint l'échange aux amis du dresseur
  status: TradeStatus;
  createdAt: string;
  completedAt?: string;
}

export interface FriendEntry {
  friendId: string;
  username: string;
  friendCode: string; // e.g. "48219" (code à 5 chiffres)
  trainerTitle: string;
  avatarPokemonEmoji: string;
  avatarUrl?: string;
  currentLeague: LeagueTier;
  totalXp: number;
  addedAt: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  friendCode: string;
  token?: string;
  isLoggedIn: boolean;
  createdAt: string;
}

export type RaidMetric = 'tonnage_kg' | 'xp_points' | 'cardio_minutes';

export interface RaidParticipant {
  userId: string;
  username: string;
  avatarPokemonEmoji: string;
  avatarUrl?: string;
  contributionValue: number;
  percentage: number;
  isCurrentUser: boolean;
}

export interface CoOpRaidBoss {
  id: string;
  title: string;
  bossName: string;
  bossEmoji: string;
  bossType: string;
  description: string;
  targetMetric: RaidMetric;
  targetMetricLabel: string;
  targetValue: number;
  currentProgress: number;
  startTime: string;
  endTime: string;
  status: 'active' | 'victory' | 'failed';
  rewardEggRarity: 'athlete' | 'champion' | 'legendary';
  rewardDescription: string;
  participants: RaidParticipant[];
  hasClaimedReward?: boolean;
}

export interface FriendChallenge {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarEmoji: string;
  targetFriendCode?: string; // Code ami ciblé ou 'all'
  targetFriendName?: string;
  type: 'exercise' | 'program';
  title: string;
  exerciseId?: string;
  exerciseName?: string;
  programId?: string;
  programName?: string;
  targetWeightKg?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
  targetVolumeKg?: number;
  instructions: string;
  rewardXp: number;
  status: 'active' | 'completed' | 'beaten';
  winnerName?: string;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderCode: string;
  senderAvatarEmoji: string;
  senderAvatarUrl?: string;
  senderTrainerTitle: string;
  receiverId: string;
  receiverCode: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface FriendGift {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarEmoji: string;
  senderAvatarUrl?: string;
  receiverId: string;
  receiverName: string;
  receiverFriendCode: string;
  giftName: string; // Nom du cadeau désigné par l'utilisateur
  targetXpGain: number; // Quantité d'XP à obtenir pour déverrouiller
  startXp: number; // XP de départ du destinataire
  currentProgressXp: number; // Progression actuelle de l'XP
  status: 'active' | 'unlocked' | 'claimed';
  personalMessage?: string;
  createdAt: string;
  unlockedAt?: string;
}

