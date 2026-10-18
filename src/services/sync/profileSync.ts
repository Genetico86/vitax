/**
 * Module dédié à la synchronisation Cloud du profil athlète, poids, objectifs et réglages (Fiche 1.9).
 */
export {
  STORAGE_KEY_DELETED_IDS,
  getDeletedIdsSet,
  markIdAsDeleted,
  syncDeletedIdsToCloud,
  fetchAndMergeDeletedIdsFromCloud,
  getActiveUserId,
  syncBodyWeightsToCloud,
  deleteWeightLogFromCloud,
  syncBodyWeightToCloud,
  fetchBodyWeightsFromCloud,
  syncFitnessGoalsToCloud,
  deleteFitnessGoalFromCloud,
  syncFitnessGoalToCloud,
  fetchFitnessGoalsFromCloud,
  syncUserSettingsToCloud,
  fetchUserSettingsFromCloud,
} from '../cloudSyncService';
