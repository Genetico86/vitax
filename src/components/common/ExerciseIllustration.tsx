import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
  Ellipse,
} from 'react-native-svg';
import { Colors } from '../../constants/colors';

// -------------------------------------------------------------
// TICKER GLOBAL PARTAGÉ (25 FPS)
// Toutes les animations partagent une seule boucle ultra-légère (0% surcharge)
// -------------------------------------------------------------
let globalFrame = 0;
const subscribers = new Set<(f: number) => void>();
let tickerTimer: any = null;

function subscribeToMotion(callback: (f: number) => void) {
  subscribers.add(callback);
  if (subscribers.size === 1) {
    tickerTimer = setInterval(() => {
      globalFrame = (globalFrame + 1) % 80;
      subscribers.forEach((cb) => cb(globalFrame));
    }, 40); // 25 FPS, cycle complet de 3.2s
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  };
}

export interface ExerciseIllustrationProps {
  targetMuscle?: string;
  exerciseId?: string;
  size?: number;
  interactive?: boolean;
  exerciseName?: string;
}

export const ExerciseIllustration: React.FC<ExerciseIllustrationProps> = ({
  targetMuscle = 'Pectoraux',
  exerciseId = '',
  size = 56,
  interactive = true,
  exerciseName,
}) => {
  const [frame, setFrame] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToMotion((f) => setFrame(f));
    return unsubscribe;
  }, []);

  // Progression harmonique sinusoïdale 0 ➔ 1 ➔ 0
  // p = 0 : Position initiale / étirement
  // p = 1 : Contraction maximale / effort de pointe
  const p = (Math.sin((frame / 80) * 2 * Math.PI - Math.PI / 2) + 1) / 2;
  const isEccentric = frame < 40;

  // Couleurs du groupe musculaire
  const getColors = () => {
    switch (targetMuscle) {
      case 'Pectoraux':
        return { start: '#FF5500', end: '#E11D48', bg: '#23141E', accent: '#FF5500' };
      case 'Dos':
        return { start: '#06B6D4', end: '#3B82F6', bg: '#0F1E30', accent: '#06B6D4' };
      case 'Épaules':
        return { start: '#F59E0B', end: '#D97706', bg: '#241D12', accent: '#F59E0B' };
      case 'Biceps':
        return { start: '#10B981', end: '#059669', bg: '#10221A', accent: '#10B981' };
      case 'Triceps':
        return { start: '#8B5CF6', end: '#6D28D9', bg: '#1D172E', accent: '#8B5CF6' };
      case 'Jambes':
        return { start: '#EC4899', end: '#BE185D', bg: '#25121F', accent: '#EC4899' };
      case 'Abdominaux':
        return { start: '#14B8A6', end: '#0D9488', bg: '#0E2122', accent: '#14B8A6' };
      case 'Cardio':
        return { start: '#06B6D4', end: '#0284C7', bg: '#082F49', accent: '#38BDF8' };
      default:
        return { start: '#FF5500', end: '#F97316', bg: '#201614', accent: '#FF5500' };
    }
  };

  const { start, end, bg, accent } = getColors();
  const gradId = `gif_grad_${targetMuscle.replace(/\s+/g, '')}_${size}`;

  // -------------------------------------------------------------
  // RENDU DU MOUVEMENT VECTORIEL REPRÉSENTATIF (GIF ANIMÉ)
  // -------------------------------------------------------------
  const renderMovementGraphic = (currentP: number) => {
    const id = exerciseId.toLowerCase();

    // 0A. COURSE À PIED EXTÉRIEURE
    if (id.includes('running_outdoor')) {
      const legSpread = (currentP - 0.5) * 36;
      const armSpread = -legSpread * 0.8;
      const bobY = Math.abs(Math.sin(currentP * Math.PI)) * 5;

      return (
        <G>
          {/* Sol extérieur / Piste de running */}
          <Line x1="8" y1="78" x2="92" y2="78" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <Line x1="16" y1="84" x2="84" y2="84" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="8 6" />

          {/* Lignes de vitesse / vent */}
          <Line x1="10" y1="34" x2="22" y2="34" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity={0.6} />
          <Line x1="6" y1="44" x2="18" y2="44" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity={0.4} />

          {/* Tête et buste de l'athlète */}
          <Circle cx="50" cy={20 - bobY} r="6.5" fill="#94A3B8" />
          <Line x1="50" y1={26 - bobY} x2="45" y2={52 - bobY} stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" />

          {/* Bras en balancier */}
          <Line x1="49" y1={33 - bobY} x2={49 + armSpread} y2={45 - bobY} stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
          <Line x1="49" y1={33 - bobY} x2={49 - armSpread} y2={45 - bobY} stroke="#64748B" strokeWidth="3.5" strokeLinecap="round" />

          {/* Jambes en foulée dynamique */}
          <Line x1="45" y1={52 - bobY} x2={36 - legSpread * 0.75} y2={64 - bobY * 0.5} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
          <Line x1={36 - legSpread * 0.75} y1={64 - bobY * 0.5} x2={26 - legSpread} y2={76} stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />

          <Line x1="45" y1={52 - bobY} x2={52 + legSpread * 0.75} y2={64 - bobY * 0.5} stroke={`url(#${gradId})`} strokeWidth="5.5" strokeLinecap="round" />
          <Line x1={52 + legSpread * 0.75} y1={64 - bobY * 0.5} x2={60 + legSpread} y2={74} stroke="#CBD5E1" strokeWidth="4.5" strokeLinecap="round" />
        </G>
      );
    }

    // 0A-bis. TAPIS DE COURSE & MARCHE (COURSE / MARCHE ACTIVE / MARCHE DU FERMIER)
    if (id.includes('treadmill') || id.includes('tapis') || id.includes('course') || id.includes('running') || id.includes('walking') || id.includes('marche')) {
      const legSpread = (currentP - 0.5) * 32;
      const armSpread = -legSpread * 0.75;
      const bobY = Math.abs(Math.sin(currentP * Math.PI)) * 4;

      return (
        <G>
          <Path d="M 14 74 L 84 70 L 86 78 L 16 82 Z" fill="#334155" />
          <Line x1="16" y1="82" x2="86" y2="78" stroke="#0EA5E9" strokeWidth="2.5" strokeDasharray="6 4" />
          <Line x1="72" y1="71" x2="78" y2="38" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
          <Rect x="72" y="32" width="14" height="8" rx="2" fill="#0284C7" />
          <Line x1="66" y1="44" x2="78" y2="40" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />

          <Circle cx="46" cy={22 - bobY} r="6.5" fill="#94A3B8" />
          <Line x1="46" y1={28 - bobY} x2="42" y2={52 - bobY} stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" />

          <Line x1="45" y1={34 - bobY} x2={45 + armSpread} y2={46 - bobY} stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
          <Line x1="45" y1={34 - bobY} x2={45 - armSpread} y2={46 - bobY} stroke="#64748B" strokeWidth="3.5" strokeLinecap="round" />

          <Line x1="42" y1={52 - bobY} x2={34 - legSpread * 0.7} y2={64 - bobY * 0.5} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
          <Line x1={34 - legSpread * 0.7} y1={64 - bobY * 0.5} x2={26 - legSpread} y2={74} stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />

          <Line x1="42" y1={52 - bobY} x2={48 + legSpread * 0.7} y2={64 - bobY * 0.5} stroke={`url(#${gradId})`} strokeWidth="5.5" strokeLinecap="round" />
          <Line x1={48 + legSpread * 0.7} y1={64 - bobY * 0.5} x2={56 + legSpread} y2={72} stroke="#CBD5E1" strokeWidth="4.5" strokeLinecap="round" />
        </G>
      );
    }

    // 0B. VÉLO ELLIPTIQUE
    if (id.includes('elliptical') || id.includes('velo') || id.includes('elliptique')) {
      const pedalAngle = currentP * 2 * Math.PI;
      const p1X = 50 + Math.cos(pedalAngle) * 16;
      const p1Y = 72 + Math.sin(pedalAngle) * 7;
      const p2X = 50 - Math.cos(pedalAngle) * 16;
      const p2Y = 72 - Math.sin(pedalAngle) * 7;
      const leverAngle = Math.cos(pedalAngle) * 12;

      return (
        <G>
          <Rect x="16" y="80" width="68" height="6" rx="3" fill="#334155" />
          <Circle cx="30" cy="70" r="11" stroke="#475569" strokeWidth="3" fill="none" />
          <Line x1="30" y1="70" x2="70" y2="70" stroke="#334155" strokeWidth="4" />

          <Line x1="60" y1="26" x2={58 - leverAngle} y2="68" stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="66" y1="26" x2={64 + leverAngle} y2="68" stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round" />

          <Rect x={p1X - 6} y={p1Y - 2} width="12" height="4" rx="2" fill={`url(#${gradId})`} />
          <Rect x={p2X - 6} y={p2Y - 2} width="12" height="4" rx="2" fill="#64748B" />

          <Circle cx="48" cy="24" r="6.5" fill="#94A3B8" />
          <Line x1="48" y1={30} x2="46" y2="54" stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" />

          <Line x1="46" y1="36" x2="60" y2="34" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />

          <Line x1="46" y1="54" x2={p1X} y2={p1Y} stroke={`url(#${gradId})`} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="46" y1="54" x2={p2X} y2={p2Y} stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    }

    // 0C. HIP THRUST (FESSIERS)
    if (id.includes('hip_thrust')) {
      const hipLift = currentP * 20;
      return (
        <G>
          <Rect x="16" y="52" width="22" height="26" rx="3" fill="#334155" />
          <Circle cx="26" cy="46" r="6" fill="#94A3B8" />
          <Line x1="28" y1="50" x2="52" y2={66 - hipLift} stroke={`url(#${gradId})`} strokeWidth="7.5" strokeLinecap="round" />
          <Line x1="52" y1={66 - hipLift} x2="72" y2="58" stroke={`url(#${gradId})`} strokeWidth="6" strokeLinecap="round" />
          <Line x1="72" y1="58" x2="72" y2="84" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <Line x1="36" y1={64 - hipLift} x2="68" y2={64 - hipLift} stroke="#F8FAFC" strokeWidth="3.5" strokeLinecap="round" />
          <Circle cx="52" cy={64 - hipLift} r="6" fill={accent} opacity={0.7 * currentP} />
        </G>
      );
    }

    // 1. DÉVELOPPÉ COUCHÉ & DÉVELOPPÉ INCLINÉ
    if (id.includes('bench') || id.includes('incline')) {
      const barY = 28 + currentP * 24; // De 28 (bras tendus) à 52 (sur la poitrine)
      const elbowSpread = currentP * 10;

      return (
        <G>
          {/* Banc de musculation */}
          <Rect x="16" y="58" width="68" height="7" rx="3" fill="#334155" />
          <Line x1="28" y1="65" x2="24" y2="82" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <Line x1="72" y1="65" x2="76" y2="82" stroke="#475569" strokeWidth="4" strokeLinecap="round" />

          {/* Tête et torse de l'athlète sur le banc */}
          <Circle cx="26" cy="52" r="6" fill="#94A3B8" />
          <Rect x="32" y="50" width="34" height="10" rx="4" fill="#64748B" />

          {/* Jambes de l'athlète posées au sol */}
          <Line x1="64" y1="56" x2="74" y2="76" stroke="#475569" strokeWidth="4" strokeLinecap="round" />

          {/* Pectoraux en contraction au bas du mouvement */}
          {currentP > 0.6 && (
            <Ellipse cx="45" cy="50" rx="9" ry={3 + currentP * 3} fill={accent} opacity={0.6 * currentP} />
          )}

          {/* Bras gauche et droit articulés */}
          <Line x1="38" y1="54" x2={34 - elbowSpread} y2={42 + currentP * 10} stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1={34 - elbowSpread} y1={42 + currentP * 10} x2="38" y2={barY} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          <Line x1="52" y1="54" x2={56 + elbowSpread} y2={42 + currentP * 10} stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1={56 + elbowSpread} y1={42 + currentP * 10} x2="52" y2={barY} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          {/* Barre olympique mobile */}
          <Line x1="10" y1={barY} x2="90" y2={barY} stroke="#F8FAFC" strokeWidth="3.5" strokeLinecap="round" />

          {/* Disques de fonte qui bougent avec la barre */}
          <Rect x="14" y={barY - 13} width="6" height="26" rx="2" fill={`url(#${gradId})`} />
          <Rect x="21" y={barY - 9} width="5" height="18" rx="2" fill={`url(#${gradId})`} />
          <Rect x="80" y={barY - 13} width="6" height="26" rx="2" fill={`url(#${gradId})`} />
          <Rect x="74" y={barY - 9} width="5" height="18" rx="2" fill={`url(#${gradId})`} />

          {/* Flèches de mouvement */}
          <Line x1="50" y1="20" x2="50" y2="25" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </G>
      );
    }

    // 2. SQUAT & PRESSE & FENTES
    if (id.includes('squat') || id.includes('leg_press') || id.includes('lunges') || targetMuscle === 'Jambes') {
      const dy = currentP * 22; // Descente en flexion profonde
      const barY = 24 + dy;

      return (
        <G>
          {/* Montants de la cage à squat */}
          <Line x1="16" y1="12" x2="16" y2="88" stroke="#334155" strokeWidth="3.5" />
          <Line x1="84" y1="12" x2="84" y2="88" stroke="#334155" strokeWidth="3.5" />
          <Line x1="10" y1="88" x2="90" y2="88" stroke="#475569" strokeWidth="3" strokeLinecap="round" />

          {/* Tête & buste de l'athlète descendant en squat */}
          <Circle cx="50" cy={18 + dy} r="6.5" fill="#94A3B8" />
          <Line x1="50" y1={24 + dy} x2="50" y2={46 + dy * 1.1} stroke="#64748B" strokeWidth="7" strokeLinecap="round" />

          {/* Cuisses fléchies (articulation hanche ➔ genou) */}
          <Line x1="50" y1={46 + dy * 1.1} x2={40 - currentP * 8} y2={64 + dy * 0.3} stroke={`url(#${gradId})`} strokeWidth="5.5" strokeLinecap="round" />
          <Line x1="50" y1={46 + dy * 1.1} x2={60 + currentP * 8} y2={64 + dy * 0.3} stroke={`url(#${gradId})`} strokeWidth="5.5" strokeLinecap="round" />

          {/* Tibias (genou ➔ pied) */}
          <Line x1={40 - currentP * 8} y1={64 + dy * 0.3} x2="38" y2="88" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1={60 + currentP * 8} y1={64 + dy * 0.3} x2="62" y2="88" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />

          {/* Barre de squat chargée sur le dos */}
          <Line x1="10" y1={barY} x2="90" y2={barY} stroke="#F8FAFC" strokeWidth="3.5" strokeLinecap="round" />
          <Rect x="14" y={barY - 14} width="6" height="28" rx="2" fill={`url(#${gradId})`} />
          <Rect x="80" y={barY - 14} width="6" height="28" rx="2" fill={`url(#${gradId})`} />
        </G>
      );
    }

    // 3. POULIE HAUTE (TIRAGE VERTICAL & PULL-OVER)
    if (id.includes('lat_pulldown') || id.includes('straight_arm') || (targetMuscle === 'Dos' && id.includes('pulldown'))) {
      const barY = 22 + currentP * 28; // Tirage vers les clavicules

      return (
        <G>
          {/* Roue de poulie haute */}
          <Circle cx="50" cy="12" r="7" stroke="#64748B" strokeWidth="2.5" fill="none" />
          <Circle cx="50" cy="12" r="2.5" fill="#64748B" />

          {/* Câble d'acier mobile */}
          <Line x1="50" y1="19" x2="50" y2={barY} stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 2" />

          {/* Barre large de tirage poitrine */}
          <Path d={`M 18 ${barY + 4} Q 50 ${barY} 82 ${barY + 4}`} stroke="#F8FAFC" strokeWidth="4.5" strokeLinecap="round" fill="none" />

          {/* Athlète assis sous la poulie */}
          <Circle cx="50" cy="48" r="6.5" fill="#94A3B8" />
          <Line x1="50" y1="54" x2="50" y2="76" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <Line x1="36" y1="78" x2="64" y2="78" stroke="#334155" strokeWidth="4" />

          {/* Dorsaux en contraction V-Taper */}
          {currentP > 0.5 && (
            <Path d={`M 40 56 Q 50 54 60 56 L 56 68 L 44 68 Z`} fill={accent} opacity={0.65 * currentP} />
          )}

          {/* Bras tirant la barre vers le bas */}
          <Line x1="45" y1="54" x2={34 - currentP * 4} y2={38 + currentP * 16} stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1={34 - currentP * 4} y1={38 + currentP * 16} x2="26" y2={barY + 3} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          <Line x1="55" y1="54" x2={66 + currentP * 4} y2={38 + currentP * 16} stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1={66 + currentP * 4} y1={38 + currentP * 16} x2="74" y2={barY + 3} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    }

    // 4. TRACTIONS EN PRONATION
    if (id.includes('pullups')) {
      const bodyY = 48 - currentP * 26; // Montée du corps jusqu'au menton au-dessus de la barre

      return (
        <G>
          {/* Barre fixe du rack */}
          <Line x1="12" y1="16" x2="88" y2="16" stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
          <Line x1="22" y1="16" x2="22" y2="40" stroke="#334155" strokeWidth="3" />
          <Line x1="78" y1="16" x2="78" y2="40" stroke="#334155" strokeWidth="3" />

          {/* Mains fixes sur la barre */}
          <Circle cx="32" cy="16" r="3.5" fill="#E2E8F0" />
          <Circle cx="68" cy="16" r="3.5" fill="#E2E8F0" />

          {/* Corps de l'athlète en ascension */}
          <Circle cx="50" cy={bodyY} r="6.5" fill="#94A3B8" />
          <Line x1="50" y1={bodyY + 6} x2="50" y2={bodyY + 28} stroke={`url(#${gradId})`} strokeWidth="7.5" strokeLinecap="round" />

          {/* Bras articulés en traction */}
          <Line x1="45" y1={bodyY + 8} x2={30 + (1 - currentP) * 4} y2={bodyY - 2 + currentP * 16} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
          <Line x1={30 + (1 - currentP) * 4} y1={bodyY - 2 + currentP * 16} x2="32" y2="16" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          <Line x1="55" y1={bodyY + 8} x2={70 - (1 - currentP) * 4} y2={bodyY - 2 + currentP * 16} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
          <Line x1={70 - (1 - currentP) * 4} y1={bodyY - 2 + currentP * 16} x2="68" y2="16" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          {/* Jambes de l'athlète */}
          <Line x1="50" y1={bodyY + 28} x2="48" y2={bodyY + 46} stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
        </G>
      );
    }

    // 5. ROWING (POULIE BASSE, BARRE & HALTÈRE)
    if (id.includes('row')) {
      const handleX = 68 - currentP * 24; // Bras tirant le câble vers l'estomac

      return (
        <G>
          {/* Poulie basse */}
          <Circle cx="16" cy="72" r="7" stroke="#64748B" strokeWidth="2.5" fill="none" />
          <Line x1="22" y1="70" x2={handleX} y2="54" stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 2" />

          {/* Buste penché dos droit */}
          <Circle cx="38" cy="36" r="6.5" fill="#94A3B8" />
          <Line x1="38" y1="42" x2="32" y2="70" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />

          {/* Coudes tirés vers l'arrière */}
          <Line x1="38" y1="48" x2={38 - currentP * 14} y2="52" stroke="#94A3B8" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1={38 - currentP * 14} y1="52" x2={handleX} y2="54" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />

          {/* Poignée en V */}
          <Circle cx={handleX} cy="54" r="4.5" fill={accent} />
        </G>
      );
    }

    // 6. CURL BICEPS (BARRE EZ & POULIE BASSE)
    if (id.includes('curl') || targetMuscle === 'Biceps') {
      const handY = 70 - currentP * 34; // Flexion du coude : mains montent vers les épaules

      return (
        <G>
          {/* Buste debout */}
          <Circle cx="50" cy="20" r="6.5" fill="#94A3B8" />
          <Line x1="50" y1="26" x2="50" y2="56" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <Line x1="47" y1="56" x2="45" y2="86" stroke="#475569" strokeWidth="5" />
          <Line x1="53" y1="56" x2="55" y2="86" stroke="#475569" strokeWidth="5" />

          {/* Coudes fixes aux flancs */}
          <Circle cx="41" cy="48" r="3.5" fill="#475569" />
          <Circle cx="59" cy="48" r="3.5" fill="#475569" />

          {/* Biceps en contraction au sommet */}
          {currentP > 0.5 && (
            <>
              <Circle cx="41" cy="42" r={3 + currentP * 3.5} fill={accent} opacity={0.7 * currentP} />
              <Circle cx="59" cy="42" r={3 + currentP * 3.5} fill={accent} opacity={0.7 * currentP} />
            </>
          )}

          {/* Avant-bras qui fléchissent */}
          <Line x1="41" y1="48" x2="41" y2={handY} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
          <Line x1="59" y1="48" x2="59" y2={handY} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          {/* Barre d'haltère ou poignée de câble */}
          <Line x1="28" y1={handY} x2="72" y2={handY} stroke="#F8FAFC" strokeWidth="4" strokeLinecap="round" />
          <Rect x="24" y={handY - 7} width="6" height="14" rx="2" fill={`url(#${gradId})`} />
          <Rect x="70" y={handY - 7} width="6" height="14" rx="2" fill={`url(#${gradId})`} />
        </G>
      );
    }

    // 7. TRICEPS PUSHDOWN & BARRE AU FRONT
    if (id.includes('pushdown') || id.includes('tricep') || targetMuscle === 'Triceps') {
      const handY = 44 + currentP * 32; // Extension des coudes vers le bas

      return (
        <G>
          {/* Poulie haute */}
          <Circle cx="50" cy="12" r="7" stroke="#64748B" strokeWidth="2.5" fill="none" />
          <Line x1="50" y1="19" x2="50" y2="38" stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 2" />

          {/* Athlète debout buste légèrement penché */}
          <Circle cx="40" cy="24" r="6" fill="#94A3B8" />
          <Line x1="40" y1="30" x2="44" y2="58" stroke="#64748B" strokeWidth="7.5" strokeLinecap="round" />

          {/* Bras fixe le long du corps */}
          <Line x1="42" y1="36" x2="44" y2="50" stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />

          {/* Triceps arrière en contraction à l'extension */}
          {currentP > 0.6 && (
            <Line x1="40" y1="40" x2="42" y2="48" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          )}

          {/* Avant-bras poussant vers le bas */}
          <Line x1="44" y1="50" x2="50" y2={handY} stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />

          {/* Corde ou barre triceps */}
          <Line x1="42" y1={handY} x2="58" y2={handY} stroke={accent} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    }

    // 8. ÉLÉVATIONS LATÉRALES (HALTÈRES & POULIE)
    if (id.includes('lateral') || id.includes('face_pull')) {
      const armAngle = currentP * 32; // Élévation des bras jusqu'à l'horizontale

      return (
        <G>
          {/* Buste debout droit */}
          <Circle cx="50" cy="22" r="6.5" fill="#94A3B8" />
          <Line x1="50" y1="28" x2="50" y2="60" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <Line x1="46" y1="60" x2="44" y2="86" stroke="#475569" strokeWidth="4.5" />
          <Line x1="54" y1="60" x2="56" y2="86" stroke="#475569" strokeWidth="4.5" />

          {/* Épaules deltoïdes en tension */}
          <Circle cx="43" cy="34" r={3.5 + currentP * 2} fill={accent} />
          <Circle cx="57" cy="34" r={3.5 + currentP * 2} fill={accent} />

          {/* Bras s'élevant sur les côtés comme des ailes */}
          <Line x1="43" y1="34" x2={43 - currentP * 24} y2={64 - armAngle} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
          <Line x1="57" y1="34" x2={57 + currentP * 24} y2={64 - armAngle} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          {/* Haltères tenus au bout des mains */}
          <Rect x={39 - currentP * 24} y={60 - armAngle} width="7" height="12" rx="2" fill={`url(#${gradId})`} />
          <Rect x={55 + currentP * 24} y={60 - armAngle} width="7" height="12" rx="2" fill={`url(#${gradId})`} />
        </G>
      );
    }

    // 9. DÉVELOPPÉ MILITAIRE À LA BARRE
    if (id.includes('overhead')) {
      const barY = 44 - currentP * 26; // De 44 (clavicules) à 18 (bras tendus au-dessus)

      return (
        <G>
          {/* Athlète debout gainé */}
          <Circle cx="50" cy="34" r="6.5" fill="#94A3B8" />
          <Line x1="50" y1="40" x2="50" y2="66" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <Line x1="46" y1="66" x2="44" y2="88" stroke="#475569" strokeWidth="4.5" />
          <Line x1="54" y1="66" x2="56" y2="88" stroke="#475569" strokeWidth="4.5" />

          {/* Bras poussant au ciel */}
          <Line x1="44" y1="42" x2="38" y2={barY + 6} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
          <Line x1="56" y1="42" x2="62" y2={barY + 6} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

          {/* Barre chargée au sommet */}
          <Line x1="12" y1={barY} x2="88" y2={barY} stroke="#F8FAFC" strokeWidth="3.5" strokeLinecap="round" />
          <Rect x="16" y={barY - 12} width="6" height="24" rx="2" fill={`url(#${gradId})`} />
          <Rect x="78" y={barY - 12} width="6" height="24" rx="2" fill={`url(#${gradId})`} />
        </G>
      );
    }

    // 10. DIPS AUX BARRES PARALLÈLES
    if (id.includes('dips')) {
      const bodyY = 32 + currentP * 18; // Descente du corps entre les barres

      return (
        <G>
          {/* Barres parallèles */}
          <Line x1="16" y1="52" x2="42" y2="52" stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
          <Line x1="58" y1="52" x2="84" y2="52" stroke="#64748B" strokeWidth="5" strokeLinecap="round" />

          {/* Corps en appui descendant */}
          <Circle cx="50" cy={bodyY} r="6.5" fill="#94A3B8" />
          <Line x1="50" y1={bodyY + 6} x2="50" y2={bodyY + 28} stroke={`url(#${gradId})`} strokeWidth="7.5" strokeLinecap="round" />

          {/* Bras sur les barres fléchissant à 90° */}
          <Line x1="45" y1={bodyY + 10} x2="33" y2="52" stroke="#CBD5E1" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="55" y1={bodyY + 10} x2="67" y2="52" stroke="#CBD5E1" strokeWidth="4.5" strokeLinecap="round" />
        </G>
      );
    }

    // 11. POMPES & GAINAGE
    if (id.includes('pushups') || id.includes('plank')) {
      const chestY = 48 + currentP * 18; // Descente vers le sol

      return (
        <G>
          {/* Ligne de sol */}
          <Line x1="10" y1="78" x2="90" y2="78" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

          {/* Tête & corps en planche */}
          <Circle cx="26" cy={chestY - 6} r="5.5" fill="#94A3B8" />
          <Line x1="28" y1={chestY} x2="74" y2="68" stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" />

          {/* Bras fléchissant */}
          <Line x1="34" y1={chestY + 2} x2="36" y2="78" stroke="#E2E8F0" strokeWidth="4" strokeLinecap="round" />

          {/* Pieds au sol */}
          <Circle cx="76" cy="74" r="3.5" fill="#64748B" />
        </G>
      );
    }

    // 11B. GAINAGE LOMBAIRE SUPERMAN (SANS MATÉRIEL)
    if (id.includes('superman')) {
      const lift = currentP * 14;
      return (
        <G>
          <Line x1="10" y1="78" x2="90" y2="78" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="24" cy={66 - lift} r="5.5" fill="#94A3B8" />
          <Line x1="26" y1={68 - lift} x2="14" y2={60 - lift * 1.2} stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
          <Path d={`M 26 ${70 - lift} Q 50 73 74 ${70 - lift * 0.8}`} stroke={`url(#${gradId})`} strokeWidth="7" fill="none" strokeLinecap="round" />
          <Line x1="74" y1={70 - lift * 0.8} x2="86" y2={64 - lift * 1.2} stroke="#94A3B8" strokeWidth="4.5" strokeLinecap="round" />
          {currentP > 0.4 && (
            <Circle cx="50" cy="62" r={3 + currentP * 4} fill={accent} opacity={0.7 * currentP} />
          )}
        </G>
      );
    }

    // 11C. MOUNTAIN CLIMBERS (GRIMPEURS SANS MATÉRIEL)
    if (id.includes('mountain') || id.includes('climber')) {
      const kneeX = 40 + currentP * 18;
      const kneeY = 70 - currentP * 12;
      return (
        <G>
          <Line x1="10" y1="80" x2="90" y2="80" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="26" cy="46" r="5.5" fill="#94A3B8" />
          <Line x1="28" y1="50" x2="34" y2="80" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
          <Line x1="28" y1="50" x2="70" y2="64" stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" />
          <Line x1="70" y1="64" x2="80" y2="78" stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="70" y1="64" x2={kneeX} y2={kneeY} stroke={`url(#${gradId})`} strokeWidth="5.5" strokeLinecap="round" />
          <Line x1={kneeX} y1={kneeY} x2={kneeX - 6} y2="78" stroke="#E2E8F0" strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    }

    // 12. SOULEVÉ DE TERRE / DEADLIFT
    if (id.includes('deadlift')) {
      const barY = 72 - currentP * 28;
      const hipY = 58 - currentP * 8;
      const headY = 40 - currentP * 16;
      const headX = 42 + currentP * 8;

      return (
        <G>
          <Line x1="12" y1="84" x2="88" y2="84" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <Line x1="48" y1="84" x2={44 + currentP * 4} y2={hipY} stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          <Circle cx={headX} cy={headY} r="6.5" fill="#94A3B8" />
          <Line x1={headX} y1={headY + 6} x2={44 + currentP * 4} y2={hipY} stroke={`url(#${gradId})`} strokeWidth="7.5" strokeLinecap="round" />
          <Line x1={headX - 1} y1={headY + 12} x2="50" y2={barY} stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
          <Line x1="14" y1={barY} x2="86" y2={barY} stroke="#F8FAFC" strokeWidth="3.5" strokeLinecap="round" />
          <Rect x="18" y={barY - 13} width="6.5" height="26" rx="2" fill={`url(#${gradId})`} />
          <Rect x="75.5" y={barY - 13} width="6.5" height="26" rx="2" fill={`url(#${gradId})`} />
        </G>
      );
    }

    // 13. ÉCARTÉ À LA POULIE / HALTÈRES (CABLE FLY)
    if (id.includes('fly')) {
      const spread = (1 - currentP) * 22;
      const handLX = 44 - spread;
      const handRX = 56 + spread;

      return (
        <G>
          <Line x1="14" y1="36" x2={handLX} y2="52" stroke="#64748B" strokeWidth="2" strokeDasharray="3 2" />
          <Line x1="86" y1="36" x2={handRX} y2="52" stroke="#64748B" strokeWidth="2" strokeDasharray="3 2" />
          <Circle cx="50" cy="22" r="6.5" fill="#94A3B8" />
          <Line x1="50" y1="28" x2="50" y2="60" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <Line x1="46" y1="60" x2="42" y2="86" stroke="#475569" strokeWidth="4.5" />
          <Line x1="54" y1="60" x2="58" y2="86" stroke="#475569" strokeWidth="4.5" />
          {currentP > 0.5 && (
            <Circle cx="50" cy="40" r={4 + currentP * 5} fill={accent} opacity={0.65 * currentP} />
          )}
          <Line x1="45" y1="36" x2={handLX} y2="52" stroke={`url(#${gradId})`} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="55" y1="36" x2={handRX} y2="52" stroke={`url(#${gradId})`} strokeWidth="4.5" strokeLinecap="round" />
          <Circle cx={handLX} cy="52" r="3.5" fill="#F8FAFC" />
          <Circle cx={handRX} cy="52" r="3.5" fill="#F8FAFC" />
        </G>
      );
    }

    // 14. RELEVÉ DE JAMBES SUSPENDU
    if (id.includes('hanging') || id.includes('leg_raise')) {
      const legEndX = 50 + currentP * 24;
      const legEndY = 78 - currentP * 24;

      return (
        <G>
          <Line x1="20" y1="16" x2="80" y2="16" stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />
          <Circle cx="44" cy="16" r="3" fill="#E2E8F0" />
          <Circle cx="56" cy="16" r="3" fill="#E2E8F0" />
          <Circle cx="50" cy="28" r="6" fill="#94A3B8" />
          <Line x1="44" y1="16" x2="47" y2="28" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="56" y1="16" x2="53" y2="28" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="50" y1="34" x2="50" y2="54" stroke="#64748B" strokeWidth="7.5" strokeLinecap="round" />
          {currentP > 0.4 && (
            <Rect x="46" y="38" width="8" height="14" rx="3" fill={accent} opacity={0.7 * currentP} />
          )}
          <Line x1="50" y1="54" x2={legEndX} y2={legEndY} stroke={`url(#${gradId})`} strokeWidth="5" strokeLinecap="round" />
        </G>
      );
    }

    // 15. CRUNCH POULIE HAUTE & ABDOMINAUX
    if (id.includes('crunch') || targetMuscle === 'Abdominaux') {
      const headY = 32 + currentP * 18;
      const headX = 46 - currentP * 8;

      return (
        <G>
          <Circle cx="50" cy="12" r="6" stroke="#64748B" strokeWidth="2.5" fill="none" />
          <Line x1="50" y1="18" x2={headX + 4} y2={headY - 2} stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 2" />
          <Line x1="16" y1="84" x2="84" y2="84" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <Line x1="60" y1="84" x2="60" y2="62" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          <Circle cx={headX} cy={headY} r="6" fill="#94A3B8" />
          <Path d={`M 60 62 Q 54 48 ${headX} ${headY + 6}`} stroke={`url(#${gradId})`} strokeWidth="7" fill="none" strokeLinecap="round" />
          {currentP > 0.5 && (
            <Circle cx="52" cy="56" r={3 + currentP * 4} fill={accent} opacity={0.7 * currentP} />
          )}
        </G>
      );
    }

    // 16. MOLLETS (CALF RAISES)
    if (id.includes('calf')) {
      const ankleLift = currentP * 14;

      return (
        <G>
          <Line x1="14" y1="84" x2="86" y2="84" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <Rect x="30" y="80" width="40" height="4" rx="2" fill="#475569" />
          <Circle cx="50" cy={20 - ankleLift} r="6.5" fill="#94A3B8" />
          <Line x1="50" y1={26 - ankleLift} x2="50" y2={52 - ankleLift} stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <Line x1="47" y1={52 - ankleLift} x2="47" y2={68 - ankleLift} stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <Line x1="53" y1={52 - ankleLift} x2="53" y2={68 - ankleLift} stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <Ellipse cx="47" cy={71 - ankleLift * 0.8} rx={3 + currentP * 2} ry={6} fill={`url(#${gradId})`} />
          <Ellipse cx="53" cy={71 - ankleLift * 0.8} rx={3 + currentP * 2} ry={6} fill={`url(#${gradId})`} />
          <Line x1="47" y1={76 - ankleLift} x2="47" y2="80" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
          <Line x1="53" y1={76 - ankleLift} x2="53" y2="80" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    }

    // 17. PAR DÉFAUT : HALTÈRE DYNAMIQUE ROTATIF AVEC ONDE DE CONTRACTION
    const rot = currentP * 40 - 20;
    return (
      <G transform={`rotate(${rot} 50 50)`}>
        <Line x1="22" y1="50" x2="78" y2="50" stroke="#E2E8F0" strokeWidth="4.5" strokeLinecap="round" />
        <Rect x="16" y="32" width="10" height="36" rx="3" fill={`url(#${gradId})`} />
        <Rect x="23" y="38" width="6" height="24" rx="2" fill={`url(#${gradId})`} />
        <Rect x="74" y="32" width="10" height="36" rx="3" fill={`url(#${gradId})`} />
        <Rect x="71" y="38" width="6" height="24" rx="2" fill={`url(#${gradId})`} />
        <Circle cx="50" cy="50" r={4 + currentP * 4} fill={accent} opacity={0.6 * currentP} />
      </G>
    );
  };

  // Coaching cues pour le modal agrandi
  const getCoachingCues = () => {
    const id = exerciseId.toLowerCase();
    if (id.includes('bench')) {
      return {
        title: 'Développé Couché',
        phase1: 'Phase Excentrique : Descendez la barre jusqu’au milieu des pectoraux avec coudes à 45°.',
        phase2: 'Phase Concentrique : Poussez explosivement sans décoller les fesses du banc.',
        breathing: 'Inspirez à la descente • Expirez sur la poussée',
      };
    }
    if (id.includes('squat')) {
      return {
        title: 'Squat Arrière',
        phase1: 'Phase Excentrique : Poussez les hanches vers l’arrière, descendez jusqu’aux cuisses parallèles.',
        phase2: 'Phase Concentrique : Poussez fort dans les talons en gardant la poitrine fière.',
        breathing: 'Bloquez le gainage en bas • Expirez lors de la remontée',
      };
    }
    if (id.includes('deadlift')) {
      return {
        title: 'Soulevé de Terre',
        phase1: 'Phase Concentrique : Poussez le sol avec les talons, gardez la barre collée aux tibias et verrouillez le bassin.',
        phase2: 'Phase Excentrique : Poussez les fessiers vers l’arrière en gardant le dos neutre.',
        breathing: 'Inspirez et bloquez l’air avant de tirer • Expirez au sommet',
      };
    }
    if (id.includes('fly')) {
      return {
        title: 'Écarté Pectoraux / Câble',
        phase1: 'Phase Excentrique : Ouvrez les bras en gardant les coudes semi-fléchis pour étirer les pectoraux.',
        phase2: 'Phase Concentrique : Resserrez les poignées devant vous en écrasant les pectoraux au centre.',
        breathing: 'Inspirez à l’ouverture • Expirez en resserrant',
      };
    }
    if (id.includes('lat_pulldown') || id.includes('pullups')) {
      return {
        title: 'Tirage Dos / Tractions',
        phase1: 'Phase Excentrique : Laissez les bras s’étirer vers le haut en contrôlant la charge.',
        phase2: 'Phase Concentrique : Tirez les coudes vers le bas et resserrez les omoplates.',
        breathing: 'Inspirez en haut • Expirez en tirant vers la poitrine',
      };
    }
    if (id.includes('curl')) {
      return {
        title: 'Curl Biceps',
        phase1: 'Phase Concentrique : Fléchissez les avant-bras sans donner d’élan avec le bassin.',
        phase2: 'Phase Excentrique : Redescendez lentement pour un étirement optimal.',
        breathing: 'Expirez à la montée • Inspirez à la descente',
      };
    }
    if (id.includes('pushdown')) {
      return {
        title: 'Extension Triceps',
        phase1: 'Phase Concentrique : Verrouillez les coudes aux côtes et tendez les bras vers le bas.',
        phase2: 'Phase Excentrique : Remontez jusqu’à un angle de 90° sans avancer les coudes.',
        breathing: 'Expirez en bas • Inspirez en remontant',
      };
    }
    if (id.includes('hanging') || id.includes('leg_raise') || id.includes('crunch')) {
      return {
        title: 'Abdominaux & Gainage',
        phase1: 'Phase Concentrique : Enroulez le bassin et rapprochez les côtes du pubis.',
        phase2: 'Phase Excentrique : Contrôlez la redescente sans cambrer le dos.',
        breathing: 'Expirez en contractant • Inspirez en revenant',
      };
    }
    if (id.includes('running_outdoor')) {
      return {
        title: 'Course à Pied Extérieure',
        phase1: 'Foulée dynamique : Pose médio-pied sous le centre de gravité, cadence idéale ~170-180 ppm.',
        phase2: 'Consigne Posture : Buste droit légèrement incliné vers l’avant depuis les chevilles, regard à 15-20m.',
        breathing: 'Rythme respiratoire calé sur la foulée (ex: 3 foulées inspiration, 3 foulées expiration)',
      };
    }
    if (id.includes('treadmill') || id.includes('tapis') || id.includes('course') || id.includes('running')) {
      return {
        title: 'Tapis de Course / Running',
        phase1: 'Phase Aérobie : Regard droit devant, posez le médio-pied et maintenez un tempo régulier.',
        phase2: 'Consigne Posture : Buste gainé, épaules relâchées et bras oscillant le long du corps.',
        breathing: 'Inspirez sur 3 foulées • Expirez sur 3 foulées',
      };
    }
    if (id.includes('elliptical') || id.includes('velo') || id.includes('elliptique')) {
      return {
        title: 'Vélo Elliptique',
        phase1: 'Phase Mouvement : Poussez avec les jambes et tirez avec les poignées sans choc articulaire.',
        phase2: 'Consigne Posture : Talons bien à plat sur les pédales et sangle abdominale engagée.',
        breathing: 'Respirez avec profondeur et constance',
      };
    }
    if (id.includes('superman')) {
      return {
        title: 'Gainage Lombaire Superman',
        phase1: 'Phase Concentrique : Décollez simultanément le torse et les jambes tendues sans à-coups.',
        phase2: 'Phase Isométrique : Maintenez 2 secondes la contraction des érecteurs du rachis et fessiers.',
        breathing: 'Expirez en décollant • Inspirez en reposant',
      };
    }
    if (id.includes('mountain') || id.includes('climber')) {
      return {
        title: 'Mountain Climbers',
        phase1: 'Rythme Dynamique : Ramenez vivement les genoux vers la poitrine en alternance.',
        phase2: 'Consigne Posture : Bassin stable et aligné avec les épaules, sans rebondir.',
        breathing: 'Respirez de façon rythmée et soutenue',
      };
    }
    return {
      title: exerciseName || targetMuscle,
      phase1: 'Phase 1 : Contrôlez le tempo de descente pendant 2 secondes.',
      phase2: 'Phase 2 : Contractez le muscle cible au sommet du mouvement.',
      breathing: 'Respirez avec fluidité et maintenez un gainage solide.',
    };
  };

  const cues = getCoachingCues();

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.28),
            backgroundColor: bg,
          },
        ]}
        onPress={() => interactive && setModalVisible(true)}
        activeOpacity={interactive ? 0.75 : 1}
        disabled={!interactive}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={start} stopOpacity="1" />
              <Stop offset="1" stopColor={end} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {renderMovementGraphic(p)}
        </Svg>

        {/* Badge GIF animé avec point vert clignotant */}
        {size >= 46 && (
          <View style={styles.gifBadge}>
            <View style={[styles.gifDot, { opacity: frame % 20 < 12 ? 1 : 0.4 }]} />
            <Text style={styles.gifText}>GIF</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* MODAL AGRANDI DU GIF DU MOUVEMENT */}
      {interactive && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              {/* En-tête */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalBadgeText}>DÉMONSTRATION DU MOUVEMENT</Text>
                  <Text style={styles.modalTitle}>{cues.title}</Text>
                  <Text style={styles.modalSubtitle}>
                    {targetMuscle} • Animation en boucle
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Grand Lecteur GIF Vectoriel */}
              <View style={[styles.largePlayerBox, { backgroundColor: bg }]}>
                <Svg width={220} height={220} viewBox="0 0 100 100">
                  <Defs>
                    <LinearGradient id={`${gradId}_large`} x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={start} stopOpacity="1" />
                      <Stop offset="1" stopColor={end} stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  {renderMovementGraphic(p)}
                </Svg>

                {/* Indicateur de phase en direct */}
                <View style={styles.phaseIndicatorPill}>
                  <Text style={styles.phaseEmoji}>{isEccentric ? '⬇️' : '⬆️'}</Text>
                  <Text style={styles.phaseText}>
                    {isEccentric ? 'Phase Excentrique (Descente)' : 'Phase Concentrique (Effort)'}
                  </Text>
                </View>
              </View>

              {/* Instructions de coaching anatomique */}
              <View style={styles.cuesContainer}>
                <View style={styles.cueRow}>
                  <Text style={styles.cueIcon}>🔄</Text>
                  <Text style={styles.cueText}>{cues.phase1}</Text>
                </View>
                <View style={styles.cueRow}>
                  <Text style={styles.cueIcon}>💥</Text>
                  <Text style={styles.cueText}>{cues.phase2}</Text>
                </View>
                <View style={styles.cueRow}>
                  <Text style={styles.cueIcon}>🫁</Text>
                  <Text style={styles.cueTextHighlight}>{cues.breathing}</Text>
                </View>
              </View>

              {/* Bouton Fermer */}
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalDoneBtnText}>Fermer la démonstration</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  gifBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gifDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
    marginRight: 3,
  },
  gifText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 16,
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '800',
  },
  largePlayerBox: {
    width: 240,
    height: 240,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
    position: 'relative',
    marginBottom: 16,
  },
  phaseIndicatorPill: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  phaseEmoji: {
    fontSize: 12,
    marginRight: 6,
  },
  phaseText: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  cuesContainer: {
    width: '100%',
    backgroundColor: '#131D2E',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2C42',
  },
  cueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cueIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  cueText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  cueTextHighlight: {
    flex: 1,
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '700',
    lineHeight: 16,
  },
  modalDoneBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
