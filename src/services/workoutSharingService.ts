import { Share, Platform, Alert } from 'react-native';
import { WorkoutSessionWithSets, WorkoutSetDetail } from '../types';
import { DailyWorkoutSummary } from '../database/workoutRepository';
import { getExerciseUnitInfo } from '../utils/exerciseUnits';

const APP_URL = 'https://vitaxsport.vercel.app';

/**
 * Formate une durée en secondes en texte lisible (ex: 45 min, 1h 15min)
 */
export function formatWorkoutDuration(sec?: number): string {
  if (!sec || sec <= 0) return '1 min';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}min`;
  }
  if (mins === 0) {
    return `${s}s`;
  }
  return `${mins} min${s > 0 && mins < 5 ? ` ${s}s` : ''}`;
}

/**
 * Génère le texte de partage pour une séance spécifique
 * 100% axé sur les performances athlétiques et les exercices réels (aucun Pokémon).
 */
export function formatWorkoutShareText(
  session: WorkoutSessionWithSets,
  athleteName?: string
): string {
  const durationText = formatWorkoutDuration(session.duration_seconds);
  const dateFormatted = new Date(session.date).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Regrouper les séries par exercice
  const exerciseMap = new Map<string, { name: string; sets: WorkoutSetDetail[] }>();
  (session.sets || []).forEach((set) => {
    let entry = exerciseMap.get(set.exercise_id);
    if (!entry) {
      entry = { name: set.exercise_name, sets: [] };
      exerciseMap.set(set.exercise_id, entry);
    }
    if (set.completed) {
      entry.sets.push(set);
    }
  });

  let exerciseBreakdownText = '';
  if (exerciseMap.size > 0) {
    exerciseBreakdownText = '\n📋 Exercices réalisés :\n';
    exerciseMap.forEach((entry) => {
      const unit = getExerciseUnitInfo({ name: entry.name });
      const setsDetails = entry.sets
        .map((s) => unit.formatSet(s.weight, s.reps))
        .join(', ');

      exerciseBreakdownText += `• ${entry.name} (${entry.sets.length} série${entry.sets.length > 1 ? 's' : ''})\n`;
      exerciseBreakdownText += `  └ ${setsDetails}\n`;
    });
  }

  let notesText = '';
  if (session.notes && session.notes.trim()) {
    notesText = `\n💬 Note : « ${session.notes.trim()} »\n`;
  }

  return (
    `🏋️ Vitax Sport — Séance Terminée !\n` +
    `⚡ ${session.program_name || 'Séance libre'}\n` +
    `📅 ${dateFormatted}\n` +
    `⏱ Durée : ${durationText} • 💪 Volume : ${session.total_volume.toLocaleString()} kg • ✓ ${session.total_sets} séries\n` +
    exerciseBreakdownText +
    notesText +
    `\n👤 Athlète : ${athleteName || 'Sportif Vitax'}\n` +
    `🏆 Rejoins-moi sur Vitax : ${APP_URL}`
  );
}

/**
 * Génère le texte de partage du bilan complet de la journée
 * Regroupe tous les exercices de toutes les séances ouvertes aujourd'hui.
 */
export function formatDailyWorkoutShareText(
  summary: DailyWorkoutSummary,
  athleteName?: string
): string {
  const durationText = formatWorkoutDuration(summary.totalDurationSeconds);

  let exercisesText = '';
  if (summary.exercises.length > 0) {
    exercisesText = `\n📋 Tous les exercices de la journée (${summary.exercises.length} mouvements) :\n`;
    summary.exercises.forEach((ex) => {
      const unit = getExerciseUnitInfo({ name: ex.exerciseName });
      const setsStr = ex.sets
        .map((s) => unit.formatSet(s.weight, s.reps))
        .join(', ');

      const maxLabel =
        ex.maxWeightKg > 0
          ? `max ${ex.maxWeightKg} kg`
          : 'PDC';

      exercisesText += `• ${ex.exerciseName} (${ex.totalSets} séries | ${maxLabel})\n`;
      exercisesText += `  └ ${setsStr}\n`;
    });
  }

  const multiSessionHeader =
    summary.sessionsCount > 1
      ? `🏋️ Vitax Sport — Bilan Complet du Jour (${summary.sessionsCount} séances) 📅`
      : `🏋️ Vitax Sport — Bilan d’Entraînement du Jour 📅`;

  return (
    `${multiSessionHeader}\n` +
    `📅 Date : ${summary.formattedDate}\n` +
    `🔥 ${summary.sessionsCount} séance${summary.sessionsCount > 1 ? 's' : ''} cumulée${summary.sessionsCount > 1 ? 's' : ''} aujourd'hui\n` +
    `⏱ Durée totale : ${durationText}\n` +
    `💪 Volume cumulé : ${summary.totalVolumeKg.toLocaleString()} kg\n` +
    `✓ Séries validées : ${summary.totalSets} séries au total\n` +
    exercisesText +
    `\n👤 Athlète : ${athleteName || 'Sportif Vitax'}\n` +
    `🏆 Suis ma progression sur Vitax : ${APP_URL}`
  );
}

/**
 * Ouvre la feuille de partage native ou copie dans le presse-papier
 */
export async function shareWorkoutContent(
  title: string,
  message: string
): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message);
      Alert.alert(
        'Récapitulatif copié ! 📋',
        'Le résumé complet de votre entraînement a été copié. Vous pouvez le coller directement sur WhatsApp, Instagram ou vos réseaux !'
      );
      return true;
    }

    const res = await Share.share({
      title,
      message,
    });
    return res.action !== Share.dismissedAction;
  } catch (err) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        Alert.alert(
          'Récapitulatif copié ! 📋',
          'Le résumé complet de votre entraînement a été copié dans le presse-papier.'
        );
        return true;
      } catch {}
    }
    console.error('Erreur partage:', err);
    return false;
  }
}
