import { Airflow, AxisState, FanSpeed, Mode } from '../devices/types';

// Gree key map + enum tables, exactly as the original module 1475.
export const GREE_PARAM = {
  power: 'Pow',
  mode: 'Mod',
  targetTemp: 'SetTem',
  tempUnit: 'TemUn',
  currentTemp: 'TemSen',
  fanSpeed: 'WdSpd',
  quiet: 'Quiet',
  turbo: 'Tur',
  swingVertical: 'SwUpDn',
  swingHorizontal: 'SwingLfRig',
  eco: 'SvSt',
  sleep: 'SwhSlp',
  health: 'Health',
  xfan: 'Blo',
  light: 'Lig',
} as const;

export const STATUS_COLS = Object.values(GREE_PARAM);

const MODE_FROM = ['auto', 'cool', 'dry', 'fan', 'heat'] as const;
const MODE_TO: Record<Mode, number> = { auto: 0, cool: 1, dry: 2, fan: 3, heat: 4 };
const FAN_FROM = ['auto', 'low', 'mediumLow', 'medium', 'mediumHigh', 'high'] as const;
const FAN_TO: Record<FanSpeed, number> = {
  auto: 0,
  quiet: 1,
  low: 1,
  mediumLow: 2,
  medium: 3,
  mediumHigh: 4,
  high: 5,
  turbo: 5,
};

export const clampTemp = (t: number) => Math.min(30, Math.max(16, Math.round(t)));
export const clampAmbient = (t: number) => (t < -40 || t > 70 ? 24 : Math.round(t));

export function modeFromGree(n: number): Mode {
  return (MODE_FROM[n] ?? 'cool') as Mode;
}
export function fanFromGree(dat: Record<string, number>): FanSpeed {
  if (dat.Tur === 1) return 'turbo';
  if (dat.Quiet === 1) return 'quiet';
  return (FAN_FROM[dat.WdSpd] ?? 'auto') as FanSpeed;
}
// SwUpDn / SwingLfRig: 0 default, 1 full swing, 2-6 fixed positions, 7-11 partial swings.
// The app's angle is 1 (top/left) .. 5 (bottom/right), the same scale the Home Bridge uses.
function axis(raw?: number): AxisState {
  if (raw === 0 || raw === undefined) return { mode: 'off', angle: 3 };
  if (raw === 1 || raw >= 7) return { mode: 'swing', angle: 3 };
  return { mode: 'fixed', angle: raw - 1 };
}
export function airflowFromGree(dat: Record<string, number>): Airflow {
  return { vertical: axis(dat.SwUpDn), horizontal: axis(dat.SwingLfRig) };
}

// --- command parameter builders (original powerParams/modeParams/etc.) ---
export const powerParams = (on: boolean) => ({ [GREE_PARAM.power]: on ? 1 : 0 });
export const targetTempParams = (t: number) => ({ [GREE_PARAM.targetTemp]: clampTemp(t), [GREE_PARAM.tempUnit]: 0 });
export const modeParams = (m: Mode) => ({ [GREE_PARAM.mode]: MODE_TO[m] });
export const fanSpeedParams = (f: FanSpeed) => ({
  [GREE_PARAM.fanSpeed]: FAN_TO[f],
  [GREE_PARAM.quiet]: f === 'quiet' ? 1 : 0,
  [GREE_PARAM.turbo]: f === 'turbo' ? 1 : 0,
});
export function airflowParams(axisMode: AxisState, key: 'swingVertical' | 'swingHorizontal') {
  const value = axisMode.mode === 'swing' ? 1 : axisMode.mode === 'fixed' ? axisMode.angle + 1 : 0;
  return { [GREE_PARAM[key]]: value };
}
