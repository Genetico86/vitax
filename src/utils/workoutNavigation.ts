/**
 * Utilitaire de gestion des transitions et de navigation entre les exercices d'une séance active.
 * Empêche la clôture prématurée de la séance lorsqu'un exercice individuel est validé.
 */

export interface WorkoutNavigationResult {
  nextIndex: number;
  isAllWorkoutCompleted: boolean;
  hasRemainingExercises: boolean;
  actionType: 'next_exercise' | 'previous_uncompleted' | 'finish_workout';
  buttonLabel: string;
}

/**
 * Calcule intelligemment l'exercice suivant à exécuter lors de la validation d'un exercice.
 *
 * @param exercises Liste des exercices de la séance active avec leurs séries
 * @param currentIndex Index de l'exercice venant d'être validé
 */
export function computeNextWorkoutNavigation(
  exercises: { sets: { completed: boolean }[] }[],
  currentIndex: number
): WorkoutNavigationResult {
  if (!exercises || exercises.length === 0) {
    return {
      nextIndex: -1,
      isAllWorkoutCompleted: true,
      hasRemainingExercises: false,
      actionType: 'finish_workout',
      buttonLabel: 'Terminer la séance 🏆',
    };
  }

  // 1. Est-ce que tous les exercices de la séance ont toutes leurs séries cochées ?
  const isAllWorkoutCompleted = exercises.every(
    (ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed)
  );

  if (isAllWorkoutCompleted) {
    return {
      nextIndex: -1,
      isAllWorkoutCompleted: true,
      hasRemainingExercises: false,
      actionType: 'finish_workout',
      buttonLabel: 'Terminer la séance 🏆',
    };
  }

  // 2. Chercher en priorité le prochain exercice non terminé qui suit currentIndex
  const nextUncompletedAfter = exercises.findIndex(
    (ex, i) => i > currentIndex && (!ex.sets.length || !ex.sets.every((s) => s.completed))
  );

  if (nextUncompletedAfter !== -1) {
    return {
      nextIndex: nextUncompletedAfter,
      isAllWorkoutCompleted: false,
      hasRemainingExercises: true,
      actionType: 'next_exercise',
      buttonLabel: 'Exercice suivant ➔',
    };
  }

  // 3. S'il n'y a pas d'exercice non terminé après, mais qu'il y a un exercice suivant dans la liste
  if (currentIndex + 1 < exercises.length) {
    return {
      nextIndex: currentIndex + 1,
      isAllWorkoutCompleted: false,
      hasRemainingExercises: true,
      actionType: 'next_exercise',
      buttonLabel: 'Exercice suivant ➔',
    };
  }

  // 4. Si nous sommes sur le dernier exercice et qu'il reste un exercice antérieur non terminé
  const previousUncompleted = exercises.findIndex(
    (ex, i) => i < currentIndex && (!ex.sets.length || !ex.sets.every((s) => s.completed))
  );

  if (previousUncompleted !== -1) {
    return {
      nextIndex: previousUncompleted,
      isAllWorkoutCompleted: false,
      hasRemainingExercises: true,
      actionType: 'previous_uncompleted',
      buttonLabel: 'Exercice restant ➔',
    };
  }

  return {
    nextIndex: -1,
    isAllWorkoutCompleted: true,
    hasRemainingExercises: false,
    actionType: 'finish_workout',
    buttonLabel: 'Terminer la séance 🏆',
  };
}
