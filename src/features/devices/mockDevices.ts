import { mockRequest } from '../../lib/mock';
import { DEFAULT_AIRFLOW, Device } from './types';

// Original makeDevice defaults + deviceFixtures (modules 1478/1479).
export function makeDevice(partial: Partial<Device> & Pick<Device, 'id' | 'name'>): Device {
  return {
    roomId: 'room-living',
    roomName: 'Living Room',
    model: 'Climate Pro X',
    brand: 'gree',
    status: 'online',
    isOn: false,
    mode: 'cool',
    targetTemp: 24,
    currentTemp: 27,
    humidity: 52,
    fanSpeed: 'auto',
    airflow: DEFAULT_AIRFLOW,
    features: ['eco', 'sleep', 'turbo', 'swing'],
    ...partial,
  };
}

// Demo fixtures matching the four units the client wants in one app: Climate King + Gree
// (both Gree protocol) and Kenwood + Hyundai (both Tuya). In demo mode these are controllable
// locally so the UI can be seen end-to-end; live control uses the per-brand adapters.
export const deviceFixtures: Device[] = [
  makeDevice({
    id: 'device-climateking',
    name: 'Climate King Airdeck Pro',
    vendor: 'Climate King',
    brand: 'gree',
    roomId: 'room-living',
    roomName: 'Living Room',
    model: 'Airdeck Pro',
    isOn: true,
    mode: 'cool',
    targetTemp: 23,
    currentTemp: 26,
    humidity: 48,
    fanSpeed: 'medium',
    airflow: { vertical: { mode: 'swing', angle: 3 }, horizontal: { mode: 'off', angle: 3 } },
  }),
  makeDevice({
    id: 'device-gree',
    name: 'Gree Split',
    vendor: 'Gree',
    brand: 'gree',
    roomId: 'room-bedroom',
    roomName: 'Bedroom',
    model: 'Gree Lomo',
    isOn: true,
    mode: 'auto',
    targetTemp: 25,
    currentTemp: 25,
    humidity: 55,
    fanSpeed: 'auto',
    airflow: { vertical: { mode: 'fixed', angle: 2 }, horizontal: { mode: 'swing', angle: 3 } },
    features: ['eco', 'sleep', 'health'],
  }),
  makeDevice({
    id: 'device-kenwood',
    name: 'Kenwood Office',
    vendor: 'Kenwood',
    brand: 'tuya',
    roomId: 'room-office',
    roomName: 'Office',
    model: 'Kenwood Wi-Fi',
    isOn: false,
    mode: 'dry',
    targetTemp: 24,
    currentTemp: 28,
    humidity: 63,
    fanSpeed: 'low',
  }),
  makeDevice({
    id: 'device-hyundai',
    name: 'Hyundai Unit',
    vendor: 'Hyundai',
    brand: 'tuya',
    roomId: 'room-kitchen',
    roomName: 'Kitchen',
    model: 'Hyundai Wi-Fi',
    isOn: true,
    mode: 'fan',
    targetTemp: 26,
    currentTemp: 29,
    humidity: 58,
    fanSpeed: 'high',
  }),
];

export type DevicePatch = Partial<Pick<Device, 'isOn' | 'mode' | 'targetTemp' | 'fanSpeed' | 'airflow' | 'name' | 'roomId' | 'roomName'>>;

export type DevicesService = {
  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device>;
  patchDevice(id: string, patch: DevicePatch): Promise<Device>;
  removeDevice(id: string): Promise<void>;
};

export function createMockDevicesService(seed: Device[] = deviceFixtures): DevicesService {
  let devices = seed.map(d => ({ ...d }));
  const find = (id: string) => {
    const d = devices.find(x => x.id === id);
    if (!d) throw new Error('Device not found.');
    return d;
  };
  return {
    getDevices: () => mockRequest('load your devices', () => devices),
    getDevice: id => mockRequest('load the device', () => find(id)),
    patchDevice: (id, patch) =>
      mockRequest('update the device', () => {
        const next = { ...find(id), ...patch };
        devices = devices.map(d => (d.id === id ? next : d));
        return next;
      }),
    removeDevice: id =>
      mockRequest('remove the device', () => {
        devices = devices.filter(d => d.id !== id);
      }),
  };
}
