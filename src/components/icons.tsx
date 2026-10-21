// Generated from the original app's icon set (module 1250) by climateking-re/tools/icons.py
import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

export type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function AlexaIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#00CAFF" strokeWidth={2.4} />
      <Path d="M12 7.2a4.8 4.8 0 0 1 3.4 8.2" stroke="#00CAFF" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function ArrowsHorizontalIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7.5 8L3.5 12l4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16.5 8l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowsVerticalIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4v16" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M8 7.5L12 3.5l4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 16.5l4 4 4-4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AutoIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M18 3.2v3.8h-3.8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19.5 12a7.5 7.5 0 0 1-12.9 5.2" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M6 20.8V17h3.8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BellIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8.5a6 6 0 1 0-12 0c0 4-1.4 5.4-2 6.1-.4.5 0 1.1.6 1.1h14.8c.6 0 1-.6.6-1.1-.6-.7-2-2.1-2-6.1z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.7 19.5a2.5 2.5 0 0 0 4.6 0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BoltIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13 3L5 13.5h5.5L11 21l8-10.5h-5.5L13 3z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={16} rx={3} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M3.5 9.5h17" stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M8 3.5v3M16 3.5v3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={8.5} cy={14} r={1} fill={stroke} />
      <Circle cx={12} cy={14} r={1} fill={stroke} />
      <Circle cx={15.5} cy={14} r={1} fill={stroke} />
    </Svg>
  );
}

export function ChartPieIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M12 12V3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 12l7.8 4.5" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color, strokeWidth = 2.4 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronUpIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 15l6-6 6 6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function DoorIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 21h16" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={14} cy={12.5} r={1} fill={stroke} />
    </Svg>
  );
}

export function DropletIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4s5.5 5.8 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.8 12 4 12 4z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function EyeOffIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.9 5.2A9.5 9.5 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.5 6.6A17 17 0 002 12s3.5 7 10 7a9.4 9.4 0 004.3-1" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.9 9.9a3 3 0 004.2 4.2" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={3} y1={3} x2={21} y2={21} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function FanIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8.5h10.5a2.75 2.75 0 1 0-2.75-2.75" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 15.5h13a3 3 0 1 1-3 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FlameIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3c.6 3.2 3.6 4.7 3.6 8.3a3.6 3.6 0 0 1-7.2 0c0-1.3.5-2.2 1.1-3C10.3 9.2 11.5 6.2 12 3z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FlaskIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 3h6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M10 3v6.2L5.4 17.8A1.6 1.6 0 0 0 6.8 20.3h10.4a1.6 1.6 0 0 0 1.4-2.5L14 9.2V3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.8 14.5h8.4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function GlobeIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M3 12h18M12 3c2.6 2.5 4 5.7 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.7-4-9s1.4-6.5 4-9z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GoogleIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
  );
}

export function GridIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={7} height={7} rx={2} stroke={stroke} strokeWidth={strokeWidth} />
      <Rect x={13} y={4} width={7} height={7} rx={2} stroke={stroke} strokeWidth={strokeWidth} />
      <Rect x={4} y={13} width={7} height={7} rx={2} stroke={stroke} strokeWidth={strokeWidth} />
      <Rect x={13} y={13} width={7} height={7} rx={2} stroke={stroke} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function HelpIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.2-2.6 3.8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={17} r={1} fill={stroke} />
    </Svg>
  );
}

export function HomeIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 11L12 4l8.5 7" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5.5 9.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ImageIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={4.5} width={17} height={15} rx={3} stroke={stroke} strokeWidth={strokeWidth} />
      <Circle cx={9} cy={9.5} r={1.6} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M5 17l4.2-4.2a2 2 0 0 1 2.7 0L17 18" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14.5 15.5l1.8-1.8a2 2 0 0 1 2.7 0l1.5 1.4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function InfoIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={strokeWidth} />
      <Line x1={12} y1={11} x2={12} y2={16} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={12} cy={7.8} r={1} fill={stroke} />
    </Svg>
  );
}

export function LightbulbIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3a6 6 0 0 0-3.7 10.7c.6.5 1 1 1.2 1.8l.2.7h4.6l.2-.7c.2-.8.6-1.3 1.2-1.8A6 6 0 0 0 12 3z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M9.5 19h5M10.5 21.2h3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ListIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={7} r={1} fill={stroke} />
      <Circle cx={5} cy={12} r={1} fill={stroke} />
      <Circle cx={5} cy={17} r={1} fill={stroke} />
      <Line x1={9} y1={7} x2={20} y2={7} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={9} y1={12} x2={20} y2={12} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={9} y1={17} x2={20} y2={17} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function MessageIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 6.5A1.5 1.5 0 0 0 19.5 5h-15A1.5 1.5 0 0 0 3 6.5v8A1.5 1.5 0 0 0 4.5 16H7v3.4L11.6 16h7.9A1.5 1.5 0 0 0 21 14.5z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx={8.5} cy={10.5} r={1} fill={stroke} />
      <Circle cx={12} cy={10.5} r={1} fill={stroke} />
      <Circle cx={15.5} cy={10.5} r={1} fill={stroke} />
    </Svg>
  );
}

export function MinusIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function MoonIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 14.2A8 8 0 0 1 9.8 4 7.2 7.2 0 1 0 20 14.2z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PencilIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16.5 4.5l3 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 20l1.2-4.2L17 4a1.8 1.8 0 0 1 2.5 2.5L7.2 18.8 4 20z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5.5v13a1 1 0 0 0 1.54.84l10.2-6.5a1 1 0 0 0 0-1.68L9.54 4.66A1 1 0 0 0 8 5.5z" fill={stroke} />
    </Svg>
  );
}

export function PlugIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 3v3.5M15 3v3.5" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M6.5 6.5h11v3a5.5 5.5 0 0 1-11 0v-3z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 15v6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PowerIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5v8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7.4 7.4a6.5 6.5 0 1 0 9.2 0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function QrIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={strokeWidth} />
      <Rect x={14} y={3} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={strokeWidth} />
      <Rect x={3} y={14} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M14 14h3v3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20.5 14v3.5M14 20.5h3.5M20.5 20.5h0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SaveIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M8 3v5h7V3M8 21v-7h8v7" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ScenesIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 3.5l1.7 4.3 4.3 1.7-4.3 1.7L11 15.5 9.3 11.2 5 9.5l4.3-1.7L11 3.5z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={stroke} strokeWidth={strokeWidth} />
      <Line x1={16.5} y1={16.5} x2={21} y2={21} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SettingsIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ShareIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={12} r={2.6} stroke={stroke} strokeWidth={strokeWidth} />
      <Circle cx={18} cy={6} r={2.6} stroke={stroke} strokeWidth={strokeWidth} />
      <Circle cx={18} cy={18} r={2.6} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SlidersIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7.5h8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M16 7.5h4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={14} cy={7.5} r={2.2} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M4 16.5h4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 16.5h8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={10} cy={16.5} r={2.2} stroke={stroke} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function SnowflakeIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={3} x2={12} y2={21} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={4.2} y1={7.5} x2={19.8} y2={16.5} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={19.8} y1={7.5} x2={4.2} y2={16.5} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function StarIcon({ size = 24, color, strokeWidth = 2, filled = false }: IconProps & { filled?: boolean }) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.2l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.9l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L12 3.2z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" fill={filled ? stroke : 'none'} />
    </Svg>
  );
}

export function TrashIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.2 7l.9 12.1A1.7 1.7 0 0 0 8.8 20.5h6.4a1.7 1.7 0 0 0 1.7-1.4L17.8 7" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={10} y1={11} x2={10} y2={17} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={14} y1={11} x2={14} y2={17} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function UserIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function UsersIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={stroke} strokeWidth={strokeWidth} />
      <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M16 5.4a3.2 3.2 0 0 1 0 5.2" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M17.6 13.4A5.5 5.5 0 0 1 20.5 19" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function WifiIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = color ?? theme.colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 11a11 11 0 0 1 15 0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7.5 14a7 7 0 0 1 9 0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M10.2 16.8a3 3 0 0 1 3.6 0" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={12} cy={19.5} r={1} fill={stroke} />
    </Svg>
  );
}

