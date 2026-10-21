// Onboarding illustrations, transcribed element-for-element from the original
// ClimateHubArt / RemoteReachArt / FamilyHomeArt components (modules 1849–1851).
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

type ArtProps = { size?: number };

const HUB = { x: 160, y: 158 };
const NODES = [
  { x: 70, y: 96 },
  { x: 250, y: 96 },
  { x: 72, y: 216 },
  { x: 248, y: 216 },
  { x: 160, y: 252 },
];

export function ClimateHubArt({ size = 280 }: ArtProps) {
  const { theme } = useUnistyles();
  const { primary, surface, primaryMuted, accent } = theme.colors;
  return (
    <Svg viewBox="0 0 320 320" width={size} height={size}>
      <Circle cx={160} cy={160} r={132} fill={primaryMuted} opacity={0.55} />
      <Circle cx={160} cy={160} r={132} fill="none" stroke={primary} strokeWidth={1} opacity={0.18} />
      {NODES.map(n => (
        <Line
          key={`l-${n.x}-${n.y}`}
          x1={HUB.x}
          y1={HUB.y}
          x2={n.x}
          y2={n.y}
          stroke={primary}
          strokeWidth={1.5}
          opacity={0.35}
          strokeDasharray="3 6"
        />
      ))}
      {NODES.map(n => (
        <Circle key={`n-${n.x}-${n.y}`} cx={n.x} cy={n.y} r={22} fill={surface} stroke={primary} strokeWidth={2} />
      ))}
      <Circle cx={70} cy={96} r={8} fill={accent} opacity={0.9} />
      <Rect x={242} y={88} width={16} height={16} rx={4} fill={accent} opacity={0.9} />
      <Rect x={62} y={210} width={20} height={13} rx={3} fill={accent} opacity={0.9} />
      <Rect x={240} y={208} width={16} height={16} rx={4} fill={accent} opacity={0.9} />
      <Rect x={150} y={239} width={20} height={27} rx={5} fill={accent} />
      <Rect x={156} y={244} width={8} height={2.4} rx={1.2} fill={surface} />
      <Path d="M 78 160 L 160 202 L 160 214 L 78 172 Z" fill={primary} opacity={0.2} />
      <Path d="M 160 202 L 242 160 L 242 172 L 160 214 Z" fill={primary} opacity={0.12} />
      <Path d="M 160 118 L 242 160 L 160 202 L 78 160 Z" fill={surface} stroke={primary} strokeWidth={2.5} strokeLinejoin="round" />
      <Path
        d="M 160 132 L 224 160 L 160 188 L 96 160 Z"
        fill="none"
        stroke={primary}
        strokeWidth={1.6}
        opacity={0.5}
        strokeLinejoin="round"
      />
      <Path d="M 160 140 L 214 160 L 160 180 L 106 160 Z" fill={primaryMuted} opacity={0.7} />
      <Line x1={143.8} y1={146} x2={176.2} y2={146} stroke={primary} strokeWidth={1.3} opacity={0.4} strokeLinecap="round" />
      <Line x1={133} y1={150} x2={187} y2={150} stroke={primary} strokeWidth={1.3} opacity={0.4} strokeLinecap="round" />
      <Path d="M 150 162 L 152.5 153 L 160 159 L 167.5 153 L 170 162 Z" fill={accent} />
      <Path d="M 154 173 Q 160 167 166 173" fill="none" stroke={primary} strokeWidth={1.3} opacity={0.55} strokeLinecap="round" />
      <Path d="M 157 174 Q 160 170.5 163 174" fill="none" stroke={primary} strokeWidth={1.3} opacity={0.55} strokeLinecap="round" />
      <Circle cx={160} cy={175.5} r={1.6} fill={primary} opacity={0.7} />
    </Svg>
  );
}

export function RemoteReachArt({ size = 280 }: ArtProps) {
  const { theme } = useUnistyles();
  const { primary, surface, primaryMuted, accent } = theme.colors;
  return (
    <Svg viewBox="0 0 320 320" width={size} height={size}>
      <Circle cx={160} cy={160} r={118} fill="none" stroke={primary} strokeWidth={1.5} opacity={0.35} strokeDasharray="5 9" />
      <Circle cx={206} cy={208} r={78} fill={primaryMuted} opacity={0.7} />
      <Circle cx={206} cy={208} r={78} fill="none" stroke={primary} strokeWidth={2.5} />
      <Path d="M168 176c14 6 10 22 26 22s20-14 34-8" fill="none" stroke={primary} strokeWidth={2} opacity={0.35} strokeLinecap="round" />
      <Path d="M160 222c18-4 22 12 40 8s18-16 36-10" fill="none" stroke={primary} strokeWidth={2} opacity={0.35} strokeLinecap="round" />
      <Circle cx={78} cy={120} r={34} fill={surface} stroke={primary} strokeWidth={2.5} />
      <Path d="M64 122l14-12 14 12" fill="none" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Rect x={68} y={122} width={20} height={16} rx={2} fill="none" stroke={accent} strokeWidth={2.5} />
      <Rect x={150} y={92} width={26} height={20} rx={5} fill={surface} stroke={primary} strokeWidth={2.5} />
      <Rect x={120} y={96} width={24} height={12} rx={2} fill={primaryMuted} stroke={primary} strokeWidth={2} />
      <Rect x={182} y={96} width={24} height={12} rx={2} fill={primaryMuted} stroke={primary} strokeWidth={2} />
      <Path d="M150 124c-8 4-12 12-12 20" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M160 128c-10 5-16 16-16 28" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}

export function FamilyHomeArt({ size = 280 }: ArtProps) {
  const { theme } = useUnistyles();
  const { primary, surface, primaryMuted, accent } = theme.colors;
  return (
    <Svg viewBox="0 0 320 320" width={size} height={size}>
      <Path d="M0 248h44v-58h30v58h26v-86h34v86h30v-40h26v40h40v-70h28v70h42v-48h30v48H0z" fill={primaryMuted} opacity={0.8} />
      <Rect x={96} y={40} width={128} height={224} rx={26} fill={surface} stroke={primary} strokeWidth={2.5} />
      <Rect x={108} y={56} width={104} height={192} rx={16} fill={primaryMuted} opacity={0.45} />
      <Rect x={146} y={48} width={28} height={4} rx={2} fill={primary} opacity={0.4} />
      <Rect x={120} y={80} width={80} height={34} rx={9} fill={surface} stroke={accent} strokeWidth={2.5} />
      <Line x1={132} y1={92} x2={184} y2={92} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={132} y1={102} x2={168} y2={102} stroke={accent} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      <Rect x={120} y={124} width={80} height={34} rx={9} fill={surface} stroke={primary} strokeWidth={2} opacity={0.8} />
      <Line x1={132} y1={136} x2={184} y2={136} stroke={primary} strokeWidth={2.5} strokeLinecap="round" opacity={0.45} />
      <Line x1={132} y1={146} x2={168} y2={146} stroke={primary} strokeWidth={2} strokeLinecap="round" opacity={0.3} />
      <Rect x={120} y={168} width={80} height={34} rx={9} fill={surface} stroke={primary} strokeWidth={2} opacity={0.8} />
      <Line x1={132} y1={180} x2={184} y2={180} stroke={primary} strokeWidth={2.5} strokeLinecap="round" opacity={0.45} />
      <Line x1={132} y1={190} x2={168} y2={190} stroke={primary} strokeWidth={2} strokeLinecap="round" opacity={0.3} />
      <Circle cx={132} cy={228} r={9} fill={accent} opacity={0.9} />
      <Circle cx={152} cy={228} r={9} fill={primary} opacity={0.4} />
      <Circle cx={172} cy={228} r={9} fill={primary} opacity={0.25} />
    </Svg>
  );
}
