export type Mode = 'cool' | 'heat' | 'dry' | 'fan' | 'auto';
export type FanSpeed = 'auto' | 'quiet' | 'low' | 'mediumLow' | 'medium' | 'mediumHigh' | 'high' | 'turbo';
export type AxisMode = 'off' | 'swing' | 'fixed';
export type AxisState = { mode: AxisMode; angle: number };
export type Airflow = { vertical: AxisState; horizontal: AxisState };
export type Feature = 'eco' | 'sleep' | 'turbo' | 'quiet' | 'swing' | 'health' | 'selfClean' | 'xfan' | 'light';

// Which on-the-wire protocol a unit speaks. Climate King + Gree units are 'gree';
// Kenwood/Hyundai and most other Wi-Fi ACs are 'tuya'; Haier is 'haier'
export type Brand = 'gree' | 'tuya' | 'haier';

export type Device = {
  id: string;
  name: string;
  roomId: string;
  roomName: string;
  model: string;
  brand: Brand;
  /** Shown to the user as the make, e.g. "Climate King", "Gree", "Kenwood", "Hyundai". */
  vendor?: string;
  status: 'online' | 'offline';
  isOn: boolean;
  mode: Mode;
  targetTemp: number;
  currentTemp: number;
  humidity: number;
  fanSpeed: FanSpeed;
  supportedFanSpeeds?: FanSpeed[];
  airflow: Airflow;
  features: Feature[];
  /** Registered on the server but not yet bound on this phone (original `toAwaitingDevice`). */
  awaitingVendor?: boolean;
  /** Last status came from cache because the latest LAN read was missed. */
  stale?: boolean;
};

// Constants from the original module 1467.
export const TEMP_RANGE = { min: 16, max: 30 } as const;
export const DEFAULT_AIRFLOW: Airflow = { vertical: { mode: 'off', angle: 3 }, horizontal: { mode: 'off', angle: 3 } };

// Labels and presets from module 1480.
export const MODE_LABEL_KEY: Record<Mode, string> = {
  cool: 'device.modeCool',
  heat: 'device.modeHeat',
  dry: 'device.modeDry',
  fan: 'device.modeFan',
  auto: 'device.modeAuto',
};
export const MODE_LABEL_SHORT_KEY: Record<Mode, string> = {
  cool: 'device.modeCoolShort',
  heat: 'device.modeHeatShort',
  dry: 'device.modeDryShort',
  fan: 'device.modeFanShort',
  auto: 'device.modeAutoShort',
};
export const FAN_LABEL_KEY: Record<FanSpeed, string> = {
  auto: 'device.fanAuto',
  quiet: 'device.fanQuiet',
  low: 'device.fanLow',
  mediumLow: 'device.fanMediumLow',
  medium: 'device.fanMedium',
  mediumHigh: 'device.fanMediumHigh',
  high: 'device.fanHigh',
  turbo: 'device.fanTurbo',
};
export const FAN_LEVELS: FanSpeed[] = ['low', 'mediumLow', 'medium', 'mediumHigh', 'high'];
export const FAN_PRESETS: FanSpeed[] = ['auto', 'quiet', 'turbo'];

export function fanIntensity(speed: FanSpeed): number {
  switch (speed) {
    case 'quiet':
    case 'low':
      return 1;
    case 'mediumLow':
      return 2;
    case 'medium':
      return 3;
    case 'mediumHigh':
      return 4;
    case 'high':
    case 'turbo':
      return 5;
    default:
      return 0;
  }
}

export const formatTemp = (value: number) => `${Math.round(value)}°`;

const VENDOR_BRANDS = new Set(['gree', 'tcl', 'tuya', 'thing', 'thingsmart']);

/** Vendor names (Gree/TCL/Tuya) are never shown to customers; they read as an empty model. */
export function customerModelLabel(model?: string | null): string {
  const trimmed = model?.trim() ?? '';
  if (!trimmed) return '';
  return VENDOR_BRANDS.has(trimmed.toLowerCase()) ? '' : trimmed;
}

export const modeColor = (theme: { colors: { mode: Record<Mode, string> } }, mode: Mode) => theme.colors.mode[mode];
