import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { calculateSessionXp } from '../../services/gamificationService';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

export default function WorkoutSummaryScreen() {
  const lastSession = useWorkoutSessionStore((state) => state.lastCompletedSession);
  const userName = useSettingsStore((state) => state.user_name);
  const xpSummary = lastSession?.session ? calculateSessionXp(lastSession.session) : null;

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const handleGoHistory = () => {
    router.replace('/(tabs)/history');
  };

  const handleShareWorkout = async () => {
    if (!lastSession?.session) return;
    const s = lastSession.session;
    const xp = xpSummary?.totalXp || 100;
    const message = `🏋️ Vitax Musculation — Séance terminée !\n` +
      `⚡ ${s.program_name || 'Séance libre'}\n` +
      `💪 Volume : ${s.total_volume} kg | Séries : ${s.total_sets}\n` +
      `⏱ Durée : ${formatDuration(s.duration_seconds)}\n` +
      `🌟 +${xp} XP gagnés vers mon prochain Badge d'Arène Pokémon !\n` +
      `Suivez mon aventure sur Vitax Musculation !`;
    try {
      await Share.share({ message });
    } catch (err) {
      console.error('Erreur partage séance:', err);
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '1 min';
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    if (mins === 0) return `${remainingSec}s`;
    return `${mins} min ${remainingSec > 0 ? `${remainingSec}s` : ''}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.celebrationHeader}>
          <Text style={styles.trophyEmoji}>🏆</Text>
          <Text style={styles.title}>Progression Enregistrée !</Text>
          <Text style={styles.subtitle}>
            Félicitations {userName ? `${userName} ` : ''}pour vos efforts ! Votre séance et vos performances sont sauvegardées
            dans votre base locale.
          </Text>
        </View>

        {/* Carte de Récompense XP */}
        {xpSummary && (
          <Card style={styles.xpCard}>
            <View style={styles.xpHeader}>
              <View style={styles.xpIconBox}>
                <Text style={styles.xpIconEmoji}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.xpTag}>RÉCOMPENSE XP</Text>
                <Text style={styles.xpTotalText}>+{xpSummary.totalXp} XP</Text>
              </View>
            </View>

            <View style={styles.xpBreakdown}>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>🏅 Séance complétée</Text>
                <Text style={styles.xpValue}>+{xpSummary.completionXp} XP</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>
                  ⚔️ Séries d’effort ({lastSession?.session.total_sets ?? 0} × 15)
                </Text>
                <Text style={styles.xpValue}>+{xpSummary.setsXp} XP</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>
                  🏋️ Volume soulevé ({lastSession?.session.total_volume ?? 0} kg)
                </Text>
                <Text style={styles.xpValue}>+{xpSummary.volumeXp} XP</Text>
              </View>
            </View>

            <View style={styles.pokemonFooterRow}>
              <Text style={styles.pokemonFooterIcon}>🔴</Text>
              <Text style={styles.pokemonFooterText}>
                Points cumulés vers votre prochain Badge d’Arène Pokémon !
              </Text>
            </View>
          </Card>
        )}

        {/* 🐣 CÉLÉBRATION : UN OU PLUSIEURS OEUFS ONT ÉCLOS ! */}
        {lastSession?.hatchedPokemon && lastSession.hatchedPokemon.length > 0 && (
          <View style={styles.hatchCelebrationContainer}>
            {lastSession.hatchedPokemon.map((hatched, idx) => (
              <Card key={idx} style={styles.hatchCard}>
                <View style={styles.hatchHeader}>
                  <Text style={styles.hatchSparkleEmoji}>✨</Text>
                  <Text style={styles.hatchHeaderTitle}>
                    UN POKÉMON A ÉCLOS DE L’EFFORT !
                  </Text>
                  <Text style={styles.hatchSparkleEmoji}>✨</Text>
                </View>

                <View style={styles.hatchedAvatarCircle}>
                  <Text style={styles.hatchedAvatarEmoji}>
                    {hatched.pokemonEmoji}
                  </Text>
                </View>

                <Text style={styles.hatchedName}>{hatched.pokemonName}</Text>

                <View style={styles.hatchedMetaRow}>
                  <View style={styles.hatchedTypePill}>
                    <Text style={styles.hatchedTypeText}>{hatched.pokemonType}</Text>
                  </View>
                  <View style={styles.hatchedCpPill}>
                    <Text style={styles.hatchedCpText}>CP {hatched.pokemonCp}</Text>
                  </View>
                  {hatched.isLegendary && (
                    <View style={styles.hatchedLegendaryPill}>
                      <Text style={styles.hatchedLegendaryText}>⭐ LÉGENDAIRE</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.hatchedDesc}>{hatched.description}</Text>

                <View style={styles.hatchedPokedexCheck}>
                  <Text style={styles.hatchedPokedexCheckText}>
                    ✓ Ajouté à votre Pokédex Vitax
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* 🥚 PROGRESSION DES INCUBATEURS EN COURS */}
        {lastSession?.incubatingEggsProgress &&
          lastSession.incubatingEggsProgress.length > 0 && (
            <Card style={styles.incubatorProgressCard}>
              <View style={styles.incubatorProgressHeader}>
                <Text style={styles.incubatorProgressTitle}>
                  🥚 Progression des Incubateurs
                </Text>
                <Text style={styles.incubatorProgressSubtitle}>
                  +{xpSummary?.totalXp || 0} XP injectés dans vos œufs actifs
                </Text>
              </View>

              {lastSession.incubatingEggsProgress.map((egg) => {
                const pct = Math.min(
                  100,
                  Math.round((egg.current_xp / egg.required_xp) * 100)
                );
                const remaining = Math.max(0, egg.required_xp - egg.current_xp);

                return (
                  <View key={egg.id} style={styles.eggProgressRow}>
                    <View style={styles.eggProgressInfo}>
                      <Text style={styles.eggProgressName}>
                        #{egg.incubator_slot} {egg.name}
                      </Text>
                      <Text style={styles.eggProgressXp}>
                        {egg.current_xp} / {egg.required_xp} XP ({pct}%)
                      </Text>
                    </View>

                    <View style={styles.progressTrackSmall}>
                      <View
                        style={[
                          styles.progressFillSmall,
                          {
                            width: `${pct}%`,
                            backgroundColor:
                              egg.is_legendary === 1 ? '#EAB308' : Colors.primary,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.eggRemainingText}>
                      Encore {remaining} XP avant l’éclosion
                    </Text>
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.openIncubatorsLink}
                onPress={() => router.replace('/(tabs)/history?tab=pokemon')}
              >
                <Text style={styles.openIncubatorsLinkText}>
                  Voir mes Incubateurs & Pokédex ❯
                </Text>
              </TouchableOpacity>
            </Card>
          )}

        <Card style={styles.summaryCard}>
          <Text style={styles.cardHeader}>
            {lastSession?.session.program_name || 'SÉANCE D’ENTRAÎNEMENT'}
          </Text>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Volume Total</Text>
              <Text style={styles.metricValueHighlight}>
                {lastSession?.session.total_volume ?? 0} kg
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Séries Réalisées</Text>
              <Text style={styles.metricValue}>
                {lastSession?.session.total_sets ?? 0} séries
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Durée de l’effort</Text>
              <Text style={styles.metricValue}>
                {formatDuration(lastSession?.session.duration_seconds)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Mode Stockage</Text>
              <Text style={[styles.metricValue, { color: Colors.success }]}>
                100% Hors-ligne ✓
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.tipText}>
            💡 Vos nouvelles charges et répétitions sont dès maintenant enregistrées dans vos
            courbes de progression et seront pré-remplies lors de votre prochaine séance !
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Partager ma séance 📣"
            variant="primary"
            size="md"
            onPress={handleShareWorkout}
            style={{ marginBottom: 10 }}
          />
          <Button
            title="Consulter l’Arène & le Raid Co-op 🏟️"
            variant="outline"
            size="md"
            onPress={() => router.push('/arena')}
            style={{ marginBottom: 10 }}
          />
          <Button
            title="Voir ma courbe de progression 📈"
            variant="secondary"
            size="md"
            onPress={handleGoHistory}
            style={{ marginBottom: 10 }}
          />
          <Button
            title="Retour à l'accueil"
            variant="secondary"
            size="sm"
            onPress={handleGoHome}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  celebrationHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  trophyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  xpCard: {
    marginBottom: 16,
    padding: 18,
    backgroundColor: '#111D2E',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  xpIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  xpIconEmoji: {
    fontSize: 22,
  },
  xpTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  xpTotalText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  xpBreakdown: {
    backgroundColor: '#0B1320',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  xpValue: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pokemonFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#172436',
  },
  pokemonFooterIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  pokemonFooterText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    flex: 1,
  },
  summaryCard: {
    marginBottom: 28,
    padding: 20,
    backgroundColor: '#121B2B',
  },
  cardHeader: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  metricItem: {
    width: '50%',
  },
  metricLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  metricValueHighlight: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E2C42',
    marginVertical: 16,
  },
  tipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  actions: {
    width: '100%',
  },
  hatchCelebrationContainer: {
    marginBottom: 20,
    gap: 12,
  },
  hatchCard: {
    backgroundColor: '#1C1917',
    borderWidth: 2,
    borderColor: '#EAB308',
    padding: 20,
    alignItems: 'center',
    borderRadius: 16,
  },
  hatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hatchSparkleEmoji: {
    fontSize: 18,
    marginHorizontal: 6,
  },
  hatchHeaderTitle: {
    color: '#EAB308',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hatchedAvatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#292524',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  hatchedAvatarEmoji: {
    fontSize: 44,
  },
  hatchedName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  hatchedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  hatchedTypePill: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hatchedTypeText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  hatchedCpPill: {
    backgroundColor: '#78350F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hatchedCpText: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '800',
  },
  hatchedLegendaryPill: {
    backgroundColor: '#EAB308',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hatchedLegendaryText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },
  hatchedDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  hatchedPokedexCheck: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hatchedPokedexCheckText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  incubatorProgressCard: {
    backgroundColor: '#1E293B',
    marginBottom: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
  },
  incubatorProgressHeader: {
    marginBottom: 12,
  },
  incubatorProgressTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  incubatorProgressSubtitle: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  eggProgressRow: {
    marginBottom: 12,
  },
  eggProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eggProgressName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  eggProgressXp: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrackSmall: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillSmall: {
    height: '100%',
    borderRadius: 3,
  },
  eggRemainingText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  openIncubatorsLink: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 6,
  },
  openIncubatorsLinkText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
