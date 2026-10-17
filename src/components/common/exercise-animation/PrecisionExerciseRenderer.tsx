import React from 'react';
import {
  Path,
  Rect,
  Circle,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
  Ellipse,
  Text as SvgText,
} from 'react-native-svg';
import {
  ExerciseBiomechanicCategory,
  BiomechanicsMetadata,
} from './biomechanicalEngine';

interface PrecisionExerciseRendererProps {
  category: ExerciseBiomechanicCategory;
  progress: number; // 0 (haut/départ) à 1 (bas/étirement maximal)
  muscleTension: number; // 0 à 1 (intensité de l'effort)
  showTrajectory?: boolean;
  showAngleProtractor?: boolean;
  colorTheme: BiomechanicsMetadata['colorTheme'];
  isLargeView?: boolean;
  gradPrefix?: string;
}

export const PrecisionExerciseRenderer: React.FC<PrecisionExerciseRendererProps> = ({
  category,
  progress,
  muscleTension,
  showTrajectory = true,
  showAngleProtractor = true,
  colorTheme,
  isLargeView = false,
  gradPrefix = 'bio',
}) => {
  const p = Math.max(0, Math.min(1, progress));
  const t = Math.max(0, Math.min(1, muscleTension));
  const gradId = `${gradPrefix}_grad_${category}`;
  const muscleGlowId = `${gradPrefix}_glow_${category}`;
  const chromeGradId = `${gradPrefix}_chrome`;

  // Palette stylisée athlétique
  const bodySkin = '#94A3B8';
  const bodyDark = '#475569';
  const bodyHighlight = '#CBD5E1';
  const metalSteel = '#64748B';
  const metalLight = '#E2E8F0';
  const benchColor = '#1E293B';
  const benchPad = '#0F172A';

  const glowColor = colorTheme.accent || '#FF5500';

  // Rendu selon la catégorie
  const renderGraphic = () => {
    switch (category) {
      // -------------------------------------------------------------
      // 1. DÉVELOPPÉ COUCHÉ (BENCH PRESS) - VUE PROFIL BIOMÉCANIQUE
      // -------------------------------------------------------------
      case 'bench_press': {
        // Trajectoire en J : de la verticale des épaules (x=46, y=28) vers le sternum (x=50, y=56)
        const barX = 46 + p * 4;
        const barY = 28 + p * 28;
        const elbowX = 38 - p * 4;
        const elbowY = 46 + p * 8;

        return (
          <G>
            {/* Ligne de sol */}
            <Line x1="10" y1="88" x2="90" y2="88" stroke="#1E293B" strokeWidth="2.5" />

            {/* Banc de musculation & montants de sécurité */}
            <Rect x="20" y="58" width="56" height="7" rx="3" fill={benchColor} />
            <Rect x="20" y="57" width="56" height="3" rx="1.5" fill={benchPad} />
            <Line x1="28" y1="65" x2="28" y2="88" stroke={metalSteel} strokeWidth="4" />
            <Line x1="68" y1="65" x2="68" y2="88" stroke={metalSteel} strokeWidth="4" />

            {/* Pied de l'athlète ancré au sol */}
            <Path d="M 68 59 L 75 74 L 75 88 L 84 88" stroke={bodyDark} strokeWidth="4" strokeLinecap="round" fill="none" />

            {/* Corps athlétique allongé avec cambrure lombaire naturelle */}
            <Circle cx="28" cy="52" r="6.5" fill={bodySkin} />
            {/* Torse sculpté avec arche de banc */}
            <Path
              d="M 33 54 Q 40 49 50 50 Q 58 53 66 59 L 64 62 L 34 60 Z"
              fill={bodyDark}
            />

            {/* PECTORAL EN SURBRILLANCE DYNAMIQUE */}
            <Path
              d="M 44 48 Q 50 47 54 52 L 48 56 Z"
              fill={`url(#${muscleGlowId})`}
              opacity={0.4 + t * 0.6}
            />

            {/* Bras biomécanique articulé (Épaule ➔ Coude ➔ Poignet) */}
            {/* Épaule */}
            <Circle cx="40" cy="52" r="3.5" fill={bodySkin} />
            {/* Bras supérieur (Humerus) */}
            <Line x1="40" y1="52" x2={elbowX} y2={elbowY} stroke={bodySkin} strokeWidth="5.5" strokeLinecap="round" />
            {/* Articulation du coude */}
            <Circle cx={elbowX} cy={elbowY} r="3" fill={bodyHighlight} />
            {/* Avant-bras vertical (Radius) */}
            <Line x1={elbowX} y1={elbowY} x2={barX} y2={barY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />

            {/* Barre olympique & disques de fonte */}
            <Line x1="8" y1={barY} x2="84" y2={barY} stroke={metalLight} strokeWidth="4" strokeLinecap="round" />
            {/* Disque olympique 20kg */}
            <Rect x="14" y={barY - 14} width="7" height="28" rx="2" fill={`url(#${gradId})`} />
            <Rect x="12" y={barY - 9} width="2" height="18" rx="1" fill="#FFFFFF" opacity={0.6} />
            <Rect x="21" y={barY - 10} width="4" height="20" rx="1.5" fill={`url(#${gradId})`} />

            {/* Trajectoire laser en J */}
            {showTrajectory && (
              <G opacity={0.85}>
                <Path
                  d="M 46 28 Q 47 42 50 56"
                  stroke={glowColor}
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                <Circle cx={barX} cy={barY} r="3" fill={glowColor} />
              </G>
            )}

            {/* Rapporteur d'angle sur le coude (Vue étendue) */}
            {isLargeView && showAngleProtractor && (
              <G opacity={0.9}>
                <Circle cx={elbowX} cy={elbowY} r="8" stroke={glowColor} strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <SvgText x={elbowX - 16} y={elbowY + 12} fill="#F8FAFC" fontSize="7" fontWeight="bold">
                  45°
                </SvgText>
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 2. DÉVELOPPÉ INCLINÉ (INCLINE BENCH)
      // -------------------------------------------------------------
      case 'incline_press': {
        const barX = 48 + p * 3;
        const barY = 24 + p * 24;
        const elbowX = 40 - p * 4;
        const elbowY = 44 + p * 8;

        return (
          <G>
            {/* Banc incliné à 30° */}
            <Line x1="14" y1="88" x2="86" y2="88" stroke="#1E293B" strokeWidth="2.5" />
            {/* Dossier incliné */}
            <Line x1="24" y1="68" x2="48" y2="38" stroke={benchColor} strokeWidth="7" strokeLinecap="round" />
            <Line x1="24" y1="68" x2="48" y2="38" stroke={benchPad} strokeWidth="4" strokeLinecap="round" />
            <Line x1="24" y1="68" x2="40" y2="68" stroke={benchPad} strokeWidth="5" strokeLinecap="round" />
            <Line x1="36" y1="68" x2="36" y2="88" stroke={metalSteel} strokeWidth="4" />

            {/* Athlète adossé */}
            <Circle cx="44" cy="32" r="6" fill={bodySkin} />
            <Line x1="42" y1="36" x2="28" y2="66" stroke={bodyDark} strokeWidth="8" strokeLinecap="round" />
            <Line x1="28" y1="66" x2="46" y2="66" stroke={bodyDark} strokeWidth="6" strokeLinecap="round" />
            <Line x1="46" y1="66" x2="52" y2="88" stroke={bodyDark} strokeWidth="4.5" strokeLinecap="round" />

            {/* Haut des pectoraux sous tension */}
            <Path
              d="M 38 40 Q 44 42 45 48 L 40 50 Z"
              fill={`url(#${muscleGlowId})`}
              opacity={0.4 + t * 0.6}
            />

            {/* Bras articulé */}
            <Circle cx="38" cy="42" r="3.5" fill={bodySkin} />
            <Line x1="38" y1="42" x2={elbowX} y2={elbowY} stroke={bodySkin} strokeWidth="5" strokeLinecap="round" />
            <Circle cx={elbowX} cy={elbowY} r="3" fill={bodyHighlight} />
            <Line x1={elbowX} y1={elbowY} x2={barX} y2={barY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />

            {/* Haltère ou barre chargée */}
            <Line x1="12" y1={barY} x2="80" y2={barY} stroke={metalLight} strokeWidth="3.5" strokeLinecap="round" />
            <Rect x="16" y={barY - 12} width="6" height="24" rx="2" fill={`url(#${gradId})`} />
            <Rect x="70" y={barY - 12} width="6" height="24" rx="2" fill={`url(#${gradId})`} />

            {showTrajectory && (
              <G opacity={0.85}>
                <Line x1="48" y1="24" x2="51" y2="48" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" />
                <Circle cx={barX} cy={barY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 3. SQUAT & PRESSE (SQUAT PROFILE BIOMÉCANIQUE)
      // -------------------------------------------------------------
      case 'squat': {
        // En squat : descente des hanches vers l'arrière et le bas
        // p = 0 : debout, p = 1 : flexion parallèle
        const hipX = 46 - p * 12;
        const hipY = 44 + p * 20;
        const kneeX = 58 + p * 4;
        const kneeY = 66 + p * 2;
        const ankleX = 56;
        const ankleY = 86;
        const barY = 22 + p * 22;
        const headX = 58 - p * 8;
        const headY = 16 + p * 22;

        return (
          <G>
            {/* Sol du plateau */}
            <Line x1="10" y1="88" x2="90" y2="88" stroke="#1E293B" strokeWidth="2.5" />
            {/* Marqueur du médio-pied (ligne de gravité) */}
            {showTrajectory && (
              <Line x1={ankleX} y1="12" x2={ankleX} y2="88" stroke="rgba(236, 72, 153, 0.25)" strokeWidth="1.5" strokeDasharray="4 4" />
            )}

            {/* Pied ancré à plat */}
            <Path d="M 50 88 L 66 88 L 64 85 L 54 85 Z" fill={bodyDark} />

            {/* Mollet / Tibia (Cheville ➔ Genou) */}
            <Line x1={ankleX} y1={ankleY} x2={kneeX} y2={kneeY} stroke={bodyDark} strokeWidth="6" strokeLinecap="round" />

            {/* Cuisse / Quadriceps (Genou ➔ Hanche) avec volume musculaire */}
            <Line x1={kneeX} y1={kneeY} x2={hipX} y2={hipY} stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />
            {/* Surlignage Quadriceps & Fessier sous tension */}
            <Line
              x1={kneeX}
              y1={kneeY}
              x2={hipX}
              y2={hipY}
              stroke={`url(#${muscleGlowId})`}
              strokeWidth="5"
              strokeLinecap="round"
              opacity={0.4 + t * 0.6}
            />

            {/* Buste / Colonne vertébrale neutre à 60° (Hanche ➔ Épaules) */}
            <Line x1={hipX} y1={hipY} x2={headX - 4} y2={headY + 8} stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />

            {/* Fessier profil */}
            <Circle cx={hipX - 1} cy={hipY} r="5.5" fill={`url(#${muscleGlowId})`} opacity={0.3 + t * 0.7} />

            {/* Tête & regard fier à l'horizon */}
            <Circle cx={headX} cy={headY} r="6" fill={bodySkin} />

            {/* Barre olympique chargée sur les trapèzes / deltoïdes arrière */}
            <Line x1="18" y1={barY} x2="86" y2={barY} stroke={metalLight} strokeWidth="4" strokeLinecap="round" />
            {/* Disques olympiques 20kg */}
            <Rect x="20" y={barY - 14} width="7" height="28" rx="2" fill={`url(#${gradId})`} />
            <Rect x="18" y={barY - 9} width="2" height="18" rx="1" fill="#FFFFFF" opacity={0.6} />

            {/* Bras soutenant la barre */}
            <Line x1={headX - 6} y1={headY + 10} x2={headX} y2={barY + 4} stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />

            {/* Trajectoire laser verticale parfaite */}
            {showTrajectory && (
              <G opacity={0.9}>
                <Line x1={ankleX} y1="22" x2={ankleX} y2="44" stroke={glowColor} strokeWidth="2.5" strokeDasharray="3 3" />
                <Circle cx={ankleX} cy={barY} r="3.5" fill={glowColor} />
              </G>
            )}

            {/* Indicateur de profondeur "Parallèle" */}
            {isLargeView && showAngleProtractor && p > 0.8 && (
              <G opacity={0.95}>
                <Line x1={hipX - 8} y1={hipY} x2={kneeX + 8} y2={hipY} stroke="#10B981" strokeWidth="1.5" strokeDasharray="2 2" />
                <SvgText x={hipX - 18} y={hipY - 4} fill="#10B981" fontSize="7" fontWeight="bold">
                  Parallèle
                </SvgText>
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 4. SOULEVÉ DE TERRE (DEADLIFT PROFILE)
      // -------------------------------------------------------------
      case 'deadlift': {
        // Départ bas (p=1) : barre au sol (y=74), hanches reculées
        // Arrivée haut (p=0) : debout fière (y=48)
        const barY = 48 + p * 26;
        const barX = 54;
        const hipX = 42 - p * 12;
        const hipY = 50 + p * 12;
        const headX = 48 - p * 8;
        const headY = 22 + p * 14;

        return (
          <G>
            <Line x1="10" y1="88" x2="90" y2="88" stroke="#1E293B" strokeWidth="2.5" />

            {/* Tibia frôlant la barre */}
            <Line x1="52" y1="88" x2="50" y2="68" stroke={bodyDark} strokeWidth="6" strokeLinecap="round" />
            {/* Ischio-jambiers & Fessiers (Genou ➔ Hanche) */}
            <Line x1="50" y1="68" x2={hipX} y2={hipY} stroke={bodySkin} strokeWidth="7.5" strokeLinecap="round" />
            <Line
              x1="50"
              y1="68"
              x2={hipX}
              y2={hipY}
              stroke={`url(#${muscleGlowId})`}
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity={0.3 + t * 0.7}
            />

            {/* Dos droit et rigide (Hanche ➔ Épaule) */}
            <Line x1={hipX} y1={hipY} x2={headX + 2} y2={headY + 12} stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />
            {/* Érecteurs du rachis lombaires sous tension */}
            <Line
              x1={hipX + 2}
              y1={hipY - 2}
              x2={headX}
              y2={headY + 12}
              stroke={`url(#${muscleGlowId})`}
              strokeWidth="4"
              opacity={0.4 + t * 0.6}
            />

            {/* Tête dans le prolongement de la colonne */}
            <Circle cx={headX} cy={headY} r="6" fill={bodySkin} />

            {/* Bras tendus comme des câbles (Épaule ➔ Barre) */}
            <Line x1={headX + 2} y1={headY + 12} x2={barX} y2={barY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />

            {/* Barre olympique au contact des tibias */}
            <Line x1="16" y1={barY} x2="88" y2={barY} stroke={metalLight} strokeWidth="4" strokeLinecap="round" />
            <Rect x="74" y={barY - 14} width="7" height="28" rx="2" fill={`url(#${gradId})`} />
            <Rect x="82" y={barY - 10} width="3" height="20" rx="1.5" fill={`url(#${gradId})`} />

            {showTrajectory && (
              <G opacity={0.9}>
                <Line x1={barX} y1="48" x2={barX} y2="74" stroke={glowColor} strokeWidth="2.5" strokeDasharray="3 3" />
                <Circle cx={barX} cy={barY} r="3.5" fill={glowColor} />
              </G>
            )}

            {isLargeView && (
              <SvgText x="14" y="84" fill="#38BDF8" fontSize="6.5" fontWeight="bold">
                Barre collée aux tibias
              </SvgText>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 5. TIRAGE VERTICAL / TRACTIONS (LAT PULLDOWN / PULL-UPS)
      // -------------------------------------------------------------
      case 'lat_pulldown':
      case 'pullups': {
        const isPullup = category === 'pullups';
        // En tirage : la barre descend vers la poitrine (p=0: haut, p=1: bas)
        // En traction : le corps monte vers la barre
        const barY = isPullup ? 16 : 18 + p * 28;
        const bodyY = isPullup ? 48 - p * 26 : 48;
        const elbowY = isPullup ? bodyY + 12 + (1 - p) * 14 : 32 + p * 20;

        return (
          <G>
            {/* Poulie haute / Barre de traction */}
            <Line x1="10" y1="14" x2="90" y2="14" stroke={metalSteel} strokeWidth="4" strokeLinecap="round" />
            {!isPullup && (
              <>
                <Circle cx="50" cy="14" r="6" stroke={metalSteel} strokeWidth="2" fill="none" />
                <Line x1="50" y1="14" x2="50" y2={barY} stroke={metalLight} strokeWidth="2" strokeDasharray="3 2" />
              </>
            )}

            {/* Athlète vu de dos / 3/4 avec ailes du grand dorsal (V-Taper) */}
            <Circle cx="50" cy={bodyY} r="6.5" fill={bodySkin} />

            {/* Torse sculpté en V-Taper */}
            <Path
              d={`M 38 ${bodyY + 8} L 62 ${bodyY + 8} L 55 ${bodyY + 30} L 45 ${bodyY + 30} Z`}
              fill={bodyDark}
            />

            {/* GRAND DORSAL EN CONTRATION ÉNERGÉTIQUE (AILES) */}
            <Path
              d={`M 40 ${bodyY + 8} Q 32 ${bodyY + 18} 44 ${bodyY + 28} L 48 ${bodyY + 22} Z`}
              fill={`url(#${muscleGlowId})`}
              opacity={0.3 + t * 0.7}
            />
            <Path
              d={`M 60 ${bodyY + 8} Q 68 ${bodyY + 18} 56 ${bodyY + 28} L 52 ${bodyY + 22} Z`}
              fill={`url(#${muscleGlowId})`}
              opacity={0.3 + t * 0.7}
            />

            {/* Bras tirant vers les côtes */}
            {/* Épaule gauche ➔ Coude ➔ Main */}
            <Line x1="42" y1={bodyY + 8} x2="32" y2={elbowY} stroke={bodySkin} strokeWidth="5" strokeLinecap="round" />
            <Line x1="32" y1={elbowY} x2="26" y2={barY + 4} stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />

            {/* Épaule droite ➔ Coude ➔ Main */}
            <Line x1="58" y1={bodyY + 8} x2="68" y2={elbowY} stroke={bodySkin} strokeWidth="5" strokeLinecap="round" />
            <Line x1="68" y1={elbowY} x2="74" y2={barY + 4} stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />

            {/* Barre de tirage cintrée */}
            <Path
              d={`M 18 ${barY + 6} Q 50 ${barY} 82 ${barY + 6}`}
              stroke={metalLight}
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />

            {showTrajectory && (
              <G opacity={0.85}>
                <Line x1="50" y1="18" x2="50" y2="46" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" />
                <Circle cx="50" cy={barY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 6. ROWING (BUSTE PENCHÉ & POULIE BASSE)
      // -------------------------------------------------------------
      case 'rowing': {
        // En rowing : le bras part tendu vers le bas-avant (p=0) et tire vers le nombril (p=1)
        const handX = 64 - p * 20;
        const handY = 64 - p * 12;
        const elbowX = 48 - p * 18;
        const elbowY = 56 - p * 6;

        return (
          <G>
            <Line x1="10" y1="88" x2="90" y2="88" stroke="#1E293B" strokeWidth="2.5" />

            {/* Jambes en appui fléchi stable */}
            <Line x1="36" y1="88" x2="38" y2="70" stroke={bodyDark} strokeWidth="5" strokeLinecap="round" />
            <Line x1="38" y1="70" x2="32" y2="56" stroke={bodyDark} strokeWidth="6" strokeLinecap="round" />

            {/* Buste penché rigide à 45° */}
            <Line x1="32" y1="56" x2="54" y2="34" stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />

            {/* Musculature du dos sous tension (Rhomboïdes & Trapèzes) */}
            <Path
              d="M 36 52 Q 44 42 50 38 L 44 46 Z"
              fill={`url(#${muscleGlowId})`}
              opacity={0.3 + t * 0.7}
            />

            {/* Tête droite */}
            <Circle cx="58" cy="30" r="6" fill={bodySkin} />

            {/* Bras en tirage vers le nombril */}
            <Line x1="48" y1="38" x2={elbowX} y2={elbowY} stroke={bodySkin} strokeWidth="5" strokeLinecap="round" />
            <Line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />

            {/* Charge tirée (Haltère / Barre / Câble) */}
            <Circle cx={handX} cy={handY} r="5" fill={`url(#${gradId})`} />
            <Line x1={handX - 8} y1={handY} x2={handX + 8} y2={handY} stroke={metalLight} strokeWidth="4" strokeLinecap="round" />

            {showTrajectory && (
              <G opacity={0.85}>
                <Path d="M 64 64 Q 56 60 44 52" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" fill="none" />
                <Circle cx={handX} cy={handY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 7. DÉVELOPPÉ MILITAIRE (OVERHEAD PRESS)
      // -------------------------------------------------------------
      case 'overhead_press': {
        const barY = 46 - p * 28; // De 46 (clavicules) à 18 (bras tendus au ciel)
        const headOffset = p > 0.3 && p < 0.7 ? -3 : 0; // Tête reculée pour laisser passer la barre

        return (
          <G>
            <Line x1="12" y1="88" x2="88" y2="88" stroke="#1E293B" strokeWidth="2.5" />

            {/* Athlète debout parfaitement aligné */}
            <Line x1="50" y1="88" x2="50" y2="60" stroke={bodyDark} strokeWidth="6" strokeLinecap="round" />
            <Line x1="50" y1="60" x2="50" y2="38" stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />

            {/* Épaules (Deltoïdes) illuminées */}
            <Circle cx="44" cy="40" r="4.5" fill={`url(#${muscleGlowId})`} opacity={0.4 + t * 0.6} />
            <Circle cx="56" cy="40" r="4.5" fill={`url(#${muscleGlowId})`} opacity={0.4 + t * 0.6} />

            {/* Tête */}
            <Circle cx={50 + headOffset} cy="30" r="6" fill={bodySkin} />

            {/* Bras poussant verticalement */}
            <Line x1="44" y1="40" x2="40" y2={barY + 6} stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />
            <Line x1="56" y1="40" x2="60" y2={barY + 6} stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />

            {/* Barre olympique au-dessus de la tête */}
            <Line x1="12" y1={barY} x2="88" y2={barY} stroke={metalLight} strokeWidth="3.5" strokeLinecap="round" />
            <Rect x="16" y={barY - 12} width="6" height="24" rx="2" fill={`url(#${gradId})`} />
            <Rect x="78" y={barY - 12} width="6" height="24" rx="2" fill={`url(#${gradId})`} />

            {showTrajectory && (
              <G opacity={0.85}>
                <Line x1="50" y1="46" x2="50" y2="18" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" />
                <Circle cx="50" cy={barY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 8. ÉLÉVATIONS LATÉRALES (LATERAL RAISES)
      // -------------------------------------------------------------
      case 'lateral_raise': {
        const armAngle = p * 42; // De 0 (bras le long du corps) à 42 (bras à l'horizontale)
        const leftHandX = 42 - p * 28;
        const leftHandY = 66 - armAngle;
        const rightHandX = 58 + p * 28;
        const rightHandY = 66 - armAngle;

        return (
          <G>
            <Line x1="16" y1="88" x2="84" y2="88" stroke="#1E293B" strokeWidth="2.5" />

            {/* Athlète de face */}
            <Circle cx="50" cy="24" r="6" fill={bodySkin} />
            <Path d="M 44 32 L 56 32 L 53 62 L 47 62 Z" fill={bodyDark} />
            <Line x1="47" y1="62" x2="45" y2="88" stroke={bodyDark} strokeWidth="4.5" />
            <Line x1="53" y1="62" x2="55" y2="88" stroke={bodyDark} strokeWidth="4.5" />

            {/* CAPILLAIRES DELTOÏDES LATÉRAUX EN PLEINE INTENSITÉ */}
            <Circle cx="42" cy="33" r={3.5 + t * 2.5} fill={`url(#${muscleGlowId})`} opacity={0.4 + t * 0.6} />
            <Circle cx="58" cy="33" r={3.5 + t * 2.5} fill={`url(#${muscleGlowId})`} opacity={0.4 + t * 0.6} />

            {/* Bras s'élevant comme des ailes */}
            <Line x1="42" y1="34" x2={leftHandX} y2={leftHandY} stroke={bodySkin} strokeWidth="4.5" strokeLinecap="round" />
            <Line x1="58" y1="34" x2={rightHandX} y2={rightHandY} stroke={bodySkin} strokeWidth="4.5" strokeLinecap="round" />

            {/* Haltères au bout des mains */}
            <Rect x={leftHandX - 4} y={leftHandY - 6} width="8" height="12" rx="2" fill={`url(#${gradId})`} />
            <Rect x={rightHandX - 4} y={rightHandY - 6} width="8" height="12" rx="2" fill={`url(#${gradId})`} />

            {showTrajectory && (
              <G opacity={0.85}>
                <Path d={`M 42 66 Q 28 64 ${leftHandX} ${leftHandY}`} stroke={glowColor} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
                <Path d={`M 58 66 Q 72 64 ${rightHandX} ${rightHandY}`} stroke={glowColor} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 9. CURL BICEPS (BICEPS CURL) - VUE PROFIL BIOMÉCANIQUE
      // -------------------------------------------------------------
      case 'biceps_curl': {
        // Coude fixe aux côtes (x=48, y=48)
        // Avant-bras pivote : main part de (x=50, y=74) jusqu'à (x=44, y=36)
        const elbowX = 48;
        const elbowY = 48;
        const angleRad = (0.5 + p * 0.9) * Math.PI; // Rotation
        const handX = elbowX + Math.sin(angleRad) * 24;
        const handY = elbowY + Math.cos(angleRad) * 24;

        return (
          <G>
            <Line x1="16" y1="88" x2="84" y2="88" stroke="#1E293B" strokeWidth="2.5" />

            {/* Athlète debout profil */}
            <Circle cx="44" cy="20" r="6" fill={bodySkin} />
            <Line x1="44" y1="26" x2="42" y2="56" stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />
            <Line x1="42" y1="56" x2="44" y2="88" stroke={bodyDark} strokeWidth="5.5" strokeLinecap="round" />

            {/* BICEPS EN BOULE DE CONTRACTION HYPERTROPHIÉE */}
            <Circle
              cx="47"
              cy="40"
              r={3 + t * 4}
              fill={`url(#${muscleGlowId})`}
              opacity={0.3 + t * 0.7}
            />

            {/* Bras supérieur cloué au flanc */}
            <Line x1="45" y1="32" x2={elbowX} y2={elbowY} stroke={bodySkin} strokeWidth="6" strokeLinecap="round" />
            {/* Pivot fixe du coude */}
            <Circle cx={elbowX} cy={elbowY} r="3" fill={bodyHighlight} />

            {/* Avant-bras en flexion */}
            <Line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />

            {/* Haltère ou barre EZ tenue en main */}
            <Circle cx={handX} cy={handY} r="6" fill={`url(#${gradId})`} />
            <Line x1={handX - 6} y1={handY - 6} x2={handX + 6} y2={handY + 6} stroke={metalLight} strokeWidth="3" />

            {showTrajectory && (
              <G opacity={0.85}>
                <Path d="M 50 74 Q 60 54 44 36" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" fill="none" />
                <Circle cx={handX} cy={handY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 10. EXTENSION TRICEPS (TRICEPS EXTENSION / PUSHDOWN)
      // -------------------------------------------------------------
      case 'triceps_extension': {
        const elbowX = 46;
        const elbowY = 46;
        // La main descend de 46 (90°) à 76 (extension complète)
        const handX = 52 + p * 4;
        const handY = 48 + p * 28;

        return (
          <G>
            {/* Câble haute poulie */}
            <Circle cx="50" cy="12" r="6" stroke={metalSteel} strokeWidth="2" fill="none" />
            <Line x1="50" y1="12" x2={handX} y2={handY} stroke={metalLight} strokeWidth="1.5" strokeDasharray="3 2" />

            {/* Athlète profil penché à 10° */}
            <Circle cx="40" cy="24" r="6" fill={bodySkin} />
            <Line x1="40" y1="30" x2="38" y2="58" stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />
            <Line x1="38" y1="58" x2="38" y2="88" stroke={bodyDark} strokeWidth="5" />

            {/* TRICEPS EN FORME DE FER À CHEVAL SOUS TENSION */}
            <Path
              d="M 40 36 Q 44 42 43 48 L 41 48 Z"
              fill={`url(#${muscleGlowId})`}
              opacity={0.3 + t * 0.7}
            />

            {/* Bras supérieur fixe */}
            <Line x1="42" y1="34" x2={elbowX} y2={elbowY} stroke={bodySkin} strokeWidth="6" strokeLinecap="round" />
            <Circle cx={elbowX} cy={elbowY} r="3" fill={bodyHighlight} />

            {/* Avant-bras poussant */}
            <Line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />

            {/* Corde triceps ou barre droite */}
            <Line x1={handX - 5} y1={handY} x2={handX + 5} y2={handY} stroke={`url(#${gradId})`} strokeWidth="4.5" strokeLinecap="round" />

            {showTrajectory && (
              <G opacity={0.85}>
                <Line x1="52" y1="48" x2="56" y2="76" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" />
                <Circle cx={handX} cy={handY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 11. DIPS AUX BARRES PARALLÈLES
      // -------------------------------------------------------------
      case 'dips': {
        const bodyY = 32 + p * 20; // Le corps descend de 32 à 52
        const elbowY = 50;

        return (
          <G>
            {/* Barres parallèles du rack */}
            <Line x1="16" y1="52" x2="42" y2="52" stroke={metalSteel} strokeWidth="5" strokeLinecap="round" />
            <Line x1="58" y1="52" x2="84" y2="52" stroke={metalSteel} strokeWidth="5" strokeLinecap="round" />
            <Line x1="20" y1="52" x2="20" y2="88" stroke={metalSteel} strokeWidth="3.5" />
            <Line x1="80" y1="52" x2="80" y2="88" stroke={metalSteel} strokeWidth="3.5" />

            {/* Corps descendant avec buste penché */}
            <Circle cx="50" cy={bodyY} r="6" fill={bodySkin} />
            <Line x1="50" y1={bodyY + 6} x2="48" y2={bodyY + 28} stroke={bodySkin} strokeWidth="7.5" strokeLinecap="round" />

            {/* Pectoraux et triceps en surbrillance */}
            <Circle cx="50" cy={bodyY + 12} r={4 + t * 3} fill={`url(#${muscleGlowId})`} opacity={0.3 + t * 0.7} />

            {/* Jambes repliées vers l'arrière */}
            <Line x1="48" y1={bodyY + 28} x2="44" y2={bodyY + 42} stroke={bodyDark} strokeWidth="5" strokeLinecap="round" />

            {/* Bras articulés en appui sur les barres */}
            <Line x1="46" y1={bodyY + 8} x2="36" y2={elbowY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />
            <Line x1="54" y1={bodyY + 8} x2="64" y2={elbowY} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />

            {showTrajectory && (
              <G opacity={0.85}>
                <Line x1="50" y1="32" x2="50" y2="52" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" />
                <Circle cx="50" cy={bodyY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 12. POMPES (PUSH-UPS)
      // -------------------------------------------------------------
      case 'pushups': {
        const chestY = 48 + p * 18; // Descente de la poitrine vers le sol

        return (
          <G>
            <Line x1="10" y1="82" x2="90" y2="82" stroke="#1E293B" strokeWidth="2.5" />

            {/* Tête & corps en planche parfaite de fer */}
            <Circle cx="26" cy={chestY - 6} r="5.5" fill={bodySkin} />
            <Line x1="28" y1={chestY} x2="74" y2="72" stroke={bodySkin} strokeWidth="7" strokeLinecap="round" />

            {/* Sangle abdominale & pectoraux actifs */}
            <Line
              x1="32"
              y1={chestY + 2}
              x2="56"
              y2={chestY + (72 - chestY) * 0.6}
              stroke={`url(#${muscleGlowId})`}
              strokeWidth="4"
              opacity={0.3 + t * 0.7}
            />

            {/* Bras en flexion à 45° */}
            <Line x1="34" y1={chestY + 2} x2="38" y2="82" stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />
            <Circle cx="76" cy="78" r="3.5" fill={bodyDark} />

            {showTrajectory && (
              <G opacity={0.85}>
                <Line x1="28" y1="48" x2="28" y2="66" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" />
                <Circle cx="28" cy={chestY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 13. ÉCARTÉ POULIE (CABLE FLY)
      // -------------------------------------------------------------
      case 'cable_fly': {
        const spread = (1 - p) * 24;
        const leftHandX = 46 - spread;
        const rightHandX = 54 + spread;

        return (
          <G>
            {/* Câbles de poulie bilatéraux */}
            <Line x1="12" y1="32" x2={leftHandX} y2="52" stroke={metalSteel} strokeWidth="1.5" strokeDasharray="3 2" />
            <Line x1="88" y1="32" x2={rightHandX} y2="52" stroke={metalSteel} strokeWidth="1.5" strokeDasharray="3 2" />

            {/* Athlète buste fier */}
            <Circle cx="50" cy="22" r="6" fill={bodySkin} />
            <Path d="M 45 28 L 55 28 L 53 62 L 47 62 Z" fill={bodyDark} />

            {/* Pectoraux en écrasement central */}
            <Circle cx="50" cy="40" r={4 + t * 4} fill={`url(#${muscleGlowId})`} opacity={0.4 + t * 0.6} />

            {/* Bras en arc de cercle embrassant un arbre */}
            <Path
              d={`M 46 34 Q ${leftHandX - 4} 40 ${leftHandX} 52`}
              stroke={bodySkin}
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d={`M 54 34 Q ${rightHandX + 4} 40 ${rightHandX} 52`}
              stroke={bodySkin}
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />

            {/* Poignées */}
            <Circle cx={leftHandX} cy="52" r="3.5" fill={`url(#${gradId})`} />
            <Circle cx={rightHandX} cy="52" r="3.5" fill={`url(#${gradId})`} />

            {showTrajectory && (
              <G opacity={0.85}>
                <Path d="M 22 52 Q 36 56 46 52" stroke={glowColor} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
                <Path d="M 78 52 Q 64 56 54 52" stroke={glowColor} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 14. HIP THRUST (FESSIERS)
      // -------------------------------------------------------------
      case 'hip_thrust': {
        const hipLift = p * 22; // Hanches montent vers le haut horizontal
        const hipY = 68 - hipLift;

        return (
          <G>
            <Line x1="10" y1="88" x2="90" y2="88" stroke="#1E293B" strokeWidth="2.5" />

            {/* Banc sous les omoplates */}
            <Rect x="16" y="54" width="20" height="24" rx="3" fill={benchColor} />
            <Rect x="16" y="52" width="20" height="4" rx="2" fill={benchPad} />

            {/* Tête avec regard vers les genoux (menton rentré) */}
            <Circle cx="26" cy="48" r="6" fill={bodySkin} />

            {/* Torse (Épaules sur banc ➔ Hanches en pont) */}
            <Line x1="28" y1="54" x2="52" y2={hipY} stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />

            {/* GRAND FESSIER EN EXPLOSION HORIZONTALE */}
            <Circle
              cx="52"
              cy={hipY}
              r={5 + t * 4}
              fill={`url(#${muscleGlowId})`}
              opacity={0.4 + t * 0.6}
            />

            {/* Cuisses ➔ Genoux ➔ Tibias à 90° */}
            <Line x1="52" y1={hipY} x2="72" y2="58" stroke={bodySkin} strokeWidth="7" strokeLinecap="round" />
            <Line x1="72" y1="58" x2="72" y2="88" stroke={bodyDark} strokeWidth="5.5" strokeLinecap="round" />

            {/* Barre avec manchon protecteur */}
            <Line x1="36" y1={hipY - 4} x2="68" y2={hipY - 4} stroke={metalLight} strokeWidth="4.5" strokeLinecap="round" />
            <Rect x="46" y={hipY - 7} width="12" height="6" rx="2" fill="#E2E8F0" />

            {showTrajectory && (
              <G opacity={0.85}>
                <Line x1="52" y1="68" x2="52" y2="46" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" />
                <Circle cx="52" cy={hipY} r="3" fill={glowColor} />
              </G>
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 15. ABDOMINAUX & CRUNCH & RELEVÉ DE JAMBES
      // -------------------------------------------------------------
      case 'core_crunch':
      case 'hanging_leg_raise': {
        if (category === 'hanging_leg_raise') {
          // Relevé suspendu
          const legX = 50 + p * 24;
          const legY = 78 - p * 22;

          return (
            <G>
              {/* Barre de traction */}
              <Line x1="20" y1="16" x2="80" y2="16" stroke={metalSteel} strokeWidth="4" strokeLinecap="round" />
              {/* Athlète suspendu */}
              <Circle cx="50" cy="28" r="6" fill={bodySkin} />
              <Line x1="44" y1="16" x2="48" y2="28" stroke={bodyHighlight} strokeWidth="3.5" />
              <Line x1="56" y1="16" x2="52" y2="28" stroke={bodyHighlight} strokeWidth="3.5" />
              <Line x1="50" y1="34" x2="50" y2="56" stroke={bodySkin} strokeWidth="7.5" strokeLinecap="round" />

              {/* Six-pack illuminé */}
              <Rect x="46" y="38" width="8" height="16" rx="3" fill={`url(#${muscleGlowId})`} opacity={0.4 + t * 0.6} />

              {/* Jambes qui montent */}
              <Line x1="50" y1="56" x2={legX} y2={legY} stroke={bodySkin} strokeWidth="5.5" strokeLinecap="round" />

              {showTrajectory && (
                <Path d="M 50 78 Q 62 76 74 56" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" fill="none" />
              )}
            </G>
          );
        }

        // Crunch au sol
        const headY = 46 - p * 16;
        const headX = 42 - p * 6;

        return (
          <G>
            <Line x1="12" y1="84" x2="88" y2="84" stroke="#1E293B" strokeWidth="2.5" />
            {/* Bassin au sol, jambes pliées */}
            <Line x1="58" y1="84" x2="70" y2="64" stroke={bodyDark} strokeWidth="5.5" strokeLinecap="round" />
            <Line x1="70" y1="64" x2="56" y2="60" stroke={bodyDark} strokeWidth="5.5" strokeLinecap="round" />

            {/* Enroulement de la colonne (Bassin ➔ Sternum) */}
            <Path
              d={`M 56 60 Q 48 56 ${headX} ${headY + 6}`}
              stroke={bodySkin}
              strokeWidth="7.5"
              fill="none"
              strokeLinecap="round"
            />

            {/* Sangle abdominale en contraction maximale */}
            <Circle cx="50" cy="56" r={4 + t * 4} fill={`url(#${muscleGlowId})`} opacity={0.4 + t * 0.6} />

            <Circle cx={headX} cy={headY} r="6" fill={bodySkin} />

            {showTrajectory && (
              <Path d="M 42 46 Q 38 38 36 30" stroke={glowColor} strokeWidth="2" strokeDasharray="3 3" fill="none" />
            )}
          </G>
        );
      }

      // -------------------------------------------------------------
      // 16. COURSE & CARDIO (RUNNING DYNAMIQUE)
      // -------------------------------------------------------------
      case 'running': {
        const stride = (p - 0.5) * 36;
        const armSpread = -stride * 0.8;
        const bobY = Math.abs(Math.sin(p * Math.PI)) * 5;

        return (
          <G>
            {/* Sol et piste */}
            <Line x1="8" y1="82" x2="92" y2="82" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
            <Line x1="16" y1="86" x2="84" y2="86" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="8 6" />

            {/* Lignes aérodynamiques */}
            <Line x1="10" y1="36" x2="22" y2="36" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity={0.6} />
            <Line x1="6" y1="46" x2="18" y2="46" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity={0.4} />

            {/* Tête et buste incliné vers l'avant depuis les chevilles */}
            <Circle cx="50" cy={20 - bobY} r="6.5" fill={bodySkin} />
            <Line x1="50" y1={26 - bobY} x2="45" y2={52 - bobY} stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" />

            {/* Bras en balancier dynamique à 90° */}
            <Line x1="49" y1={33 - bobY} x2={49 + armSpread} y2={45 - bobY} stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />
            <Line x1="49" y1={33 - bobY} x2={49 - armSpread} y2={45 - bobY} stroke={bodyDark} strokeWidth="3.5" strokeLinecap="round" />

            {/* Jambes en foulée médio-pied */}
            <Line x1="45" y1={52 - bobY} x2={36 - stride * 0.75} y2={64 - bobY * 0.5} stroke={bodyDark} strokeWidth="5" strokeLinecap="round" />
            <Line x1={36 - stride * 0.75} y1={64 - bobY * 0.5} x2={26 - stride} y2={80} stroke={bodyDark} strokeWidth="4.5" strokeLinecap="round" />

            <Line x1="45" y1={52 - bobY} x2={52 + stride * 0.75} y2={64 - bobY * 0.5} stroke={`url(#${muscleGlowId})`} strokeWidth="5.5" strokeLinecap="round" />
            <Line x1={52 + stride * 0.75} y1={64 - bobY * 0.5} x2={60 + stride} y2={78} stroke={bodyHighlight} strokeWidth="4.5" strokeLinecap="round" />
          </G>
        );
      }

      // -------------------------------------------------------------
      // 17. MOLLETS (CALF RAISES)
      // -------------------------------------------------------------
      case 'calf_raise': {
        const lift = p * 16;

        return (
          <G>
            <Line x1="14" y1="84" x2="86" y2="84" stroke="#1E293B" strokeWidth="2.5" />
            {/* Marche / Step */}
            <Rect x="26" y="80" width="48" height="6" rx="2" fill={metalSteel} />

            {/* Athlète debout qui monte sur la pointe */}
            <Circle cx="50" cy={20 - lift} r="6" fill={bodySkin} />
            <Line x1="50" y1={26 - lift} x2="50" y2={56 - lift} stroke={bodySkin} strokeWidth="8" strokeLinecap="round" />
            <Line x1="50" y1={56 - lift} x2="50" y2={74 - lift} stroke={bodyDark} strokeWidth="5.5" strokeLinecap="round" />

            {/* MOLLETS SCULPTÉS EN DIAMANT AU SOMMET */}
            <Ellipse
              cx="50"
              cy={72 - lift * 0.8}
              rx={4 + t * 3}
              ry={7}
              fill={`url(#${muscleGlowId})`}
              opacity={0.4 + t * 0.6}
            />

            <Line x1="50" y1={78 - lift} x2="50" y2="82" stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />
          </G>
        );
      }

      // -------------------------------------------------------------
      // 18. SUPERMAN LOMBAIRE
      // -------------------------------------------------------------
      case 'superman': {
        const lift = p * 14;

        return (
          <G>
            <Line x1="10" y1="78" x2="90" y2="78" stroke="#1E293B" strokeWidth="2.5" />
            {/* Tête regardant le tapis */}
            <Circle cx="24" cy={66 - lift} r="5.5" fill={bodySkin} />
            <Line x1="26" y1={68 - lift} x2="14" y2={60 - lift * 1.2} stroke={bodyHighlight} strokeWidth="3.5" strokeLinecap="round" />
            {/* Arc lombaire */}
            <Path
              d={`M 26 ${70 - lift} Q 50 73 74 ${70 - lift * 0.8}`}
              stroke={`url(#${muscleGlowId})`}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <Line x1="74" y1={70 - lift * 0.8} x2="86" y2={64 - lift * 1.2} stroke={bodySkin} strokeWidth="4.5" strokeLinecap="round" />
          </G>
        );
      }

      // -------------------------------------------------------------
      // 19. MOUNTAIN CLIMBERS
      // -------------------------------------------------------------
      case 'mountain_climber': {
        const kneeX = 40 + p * 18;
        const kneeY = 70 - p * 12;

        return (
          <G>
            <Line x1="10" y1="80" x2="90" y2="80" stroke="#1E293B" strokeWidth="2.5" />
            <Circle cx="26" cy="46" r="5.5" fill={bodySkin} />
            <Line x1="28" y1="50" x2="34" y2="80" stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />
            <Line x1="28" y1="50" x2="70" y2="64" stroke={bodySkin} strokeWidth="7" strokeLinecap="round" />
            <Line x1="70" y1="64" x2="80" y2="78" stroke={bodyDark} strokeWidth="4.5" strokeLinecap="round" />
            <Line x1="70" y1="64" x2={kneeX} y2={kneeY} stroke={`url(#${muscleGlowId})`} strokeWidth="5.5" strokeLinecap="round" />
            <Line x1={kneeX} y1={kneeY} x2={kneeX - 6} y2="78" stroke={bodyHighlight} strokeWidth="4" strokeLinecap="round" />
          </G>
        );
      }

      // -------------------------------------------------------------
      // PAR DÉFAUT : HALTÈRE OLYMPIQUE ROTATIF & VAGUE DE CONTRACTION
      // -------------------------------------------------------------
      default: {
        const rot = p * 40 - 20;

        return (
          <G transform={`rotate(${rot} 50 50)`}>
            <Line x1="20" y1="50" x2="80" y2="50" stroke={metalLight} strokeWidth="5" strokeLinecap="round" />
            <Rect x="14" y="30" width="10" height="40" rx="3" fill={`url(#${gradId})`} />
            <Rect x="22" y="36" width="6" height="28" rx="2" fill={`url(#${gradId})`} />
            <Rect x="76" y="30" width="10" height="40" rx="3" fill={`url(#${gradId})`} />
            <Rect x="72" y="36" width="6" height="28" rx="2" fill={`url(#${gradId})`} />
            <Circle cx="50" cy="50" r={4 + t * 6} fill={`url(#${muscleGlowId})`} opacity={0.5 + t * 0.5} />
          </G>
        );
      }
    }
  };

  return (
    <G>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colorTheme.primary} stopOpacity="1" />
          <Stop offset="1" stopColor={colorTheme.secondary} stopOpacity="1" />
        </LinearGradient>

        <LinearGradient id={muscleGlowId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colorTheme.accent} stopOpacity="1" />
          <Stop offset="1" stopColor={colorTheme.glow} stopOpacity="0.85" />
        </LinearGradient>

        <LinearGradient id={chromeGradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F8FAFC" stopOpacity="1" />
          <Stop offset="1" stopColor="#94A3B8" stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {renderGraphic()}
    </G>
  );
};
