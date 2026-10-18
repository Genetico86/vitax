/**
 * Module dédié à la synchronisation Cloud des entraînements, courses et catalogue personnalisé (Fiche 1.9).
 */
export {
  STORAGE_KEY_ACTIVE_WORKOUT_DRAFT,
  syncWorkoutSessionToCloud,
  fetchWorkoutSessionsFromCloud,
  syncRunningSessionsToCloud,
  deleteRunningSessionFromCloud,
  fetchRunningSessionsFromCloud,
  syncCustomCatalogToCloud,
  deleteCustomEntityFromCloud,
  fetchCustomCatalogFromCloud,
  syncActiveWorkoutDraftToCloud,
  clearActiveWorkoutDraftFromCloud,
  fetchActiveWorkoutDraftFromCloud,
} from '../cloudSyncService';
