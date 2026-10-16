import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { BodyWeightLog } from '../../../types';

interface WeightHistoryListProps {
  logs: BodyWeightLog[];
  weightUnit: string;
  onEditLog: (item: BodyWeightLog) => void;
  onDeleteLog: (id: string, weight: number, date: string) => void;
}

export const WeightHistoryList: React.FC<WeightHistoryListProps> = ({
  logs,
  weightUnit,
  onEditLog,
  onDeleteLog,
}) => {
  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>📋 Historique des Pesées</Text>
        <Text style={styles.logsCountHint}>
          {logs.length} entrée{logs.length > 1 ? 's' : ''}
        </Text>
      </View>

      {logs.length === 0 ? (
        <Card style={styles.emptyGoalCard}>
          <Text style={styles.emptyGoalSub}>
            Aucune pesée enregistrée. Appuyez sur « + Pesée » pour débuter votre suivi.
          </Text>
        </Card>
      ) : (
        logs.map((item, index) => {
          const prevItem = logs[index + 1];
          const delta = prevItem ? Math.round((item.weight - prevItem.weight) * 10) / 10 : null;

          return (
            <Card key={item.id} style={styles.logItemCard}>
              <View style={styles.logItemRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => onEditLog(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.logItemWeight}>
                      {item.weight} {weightUnit}
                    </Text>
                    {item.body_fat_percentage && (
                      <Badge
                        label={`${item.body_fat_percentage}% MG`}
                        color="rgba(6, 182, 212, 0.15)"
                        textColor="#06B6D4"
                      />
                    )}
                    {delta !== null && delta !== 0 && (
                      <Badge
                        label={`${delta > 0 ? '+' : ''}${delta} kg`}
                        color={delta > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'}
                        textColor={delta > 0 ? '#F87171' : '#4ADE80'}
                      />
                    )}
                  </View>
                  <Text style={styles.logItemDate}>
                    {item.date} {item.note ? `• ${item.note}` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onEditLog(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.deleteLogBtn, { marginRight: 6 }]}
                >
                  <Text style={styles.deleteLogIcon}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onDeleteLog(item.id, item.weight, item.date)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.deleteLogBtn}
                >
                  <Text style={styles.deleteLogIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  logsCountHint: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  emptyGoalCard: {
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#111824',
  },
  emptyGoalSub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  logItemCard: {
    backgroundColor: '#111927',
    marginBottom: 8,
    padding: 12,
  },
  logItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logItemWeight: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  logItemDate: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  deleteLogBtn: {
    padding: 6,
    opacity: 0.7,
  },
  deleteLogIcon: {
    fontSize: 14,
  },
});
