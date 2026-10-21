import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { DevicePatch, DevicesService } from './mockDevices';
import {
  createSupabaseDevicesService,
  fetchBridges,
  fetchDiscovered,
  subscribeToDeviceChanges,
} from './supabaseDevicesService';
import { Device, TEMP_RANGE } from './types';

let service: DevicesService | null = null;

export function devicesService(): DevicesService {
  if (!service) service = createSupabaseDevicesService();
  return service;
}

export const deviceKeys = {
  all: ['devices'] as const,
  bridges: () => [...deviceKeys.all, 'bridges'] as const,
  discovered: () => [...deviceKeys.all, 'discovered'] as const,
  list: () => [...deviceKeys.all, 'list'] as const,
  detail: (id: string) => [...deviceKeys.all, 'detail', id] as const,
};

// Live state arrives through Supabase realtime (useDeviceRealtime); this interval is only the
// safety net for a dropped realtime connection.
const LIVE_REFRESH_MS = 15000;

/** Refetch device data the moment the Home Bridge writes a change. Mount once per screen. */
export function useDeviceRealtime() {
  const qc = useQueryClient();
  useEffect(() => subscribeToDeviceChanges(() => qc.invalidateQueries({ queryKey: deviceKeys.all })), [qc]);
}

export function useBridges() {
  return useQuery({ queryKey: deviceKeys.bridges(), queryFn: fetchBridges, refetchInterval: 20000 });
}

export function useDiscoveredDevices() {
  return useQuery({ queryKey: deviceKeys.discovered(), queryFn: fetchDiscovered, refetchInterval: 15000 });
}

export function useDevices() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: deviceKeys.list(),
    queryFn: () => devicesService().getDevices(),
    refetchInterval: focused ? LIVE_REFRESH_MS : false,
    staleTime: 5000,
  });
}

export function useDevice(id: string) {
  const focused = useIsFocused();
  const qc = useQueryClient();
  return useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: () => devicesService().getDevice(id),
    initialData: () => qc.getQueryData<Device[]>(deviceKeys.list())?.find(d => d.id === id),
    refetchInterval: focused ? LIVE_REFRESH_MS : false,
    staleTime: 5000,
  });
}

/** Optimistic patch shared by every control (original useDevicePatch, module 1470). */
export function useDevicePatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DevicePatch }) => devicesService().patchDevice(id, patch),
    onMutate: async ({ id, patch }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: deviceKeys.list() }),
        qc.cancelQueries({ queryKey: deviceKeys.detail(id) }),
      ]);
      const prevList = qc.getQueryData<Device[]>(deviceKeys.list());
      const prevDetail = qc.getQueryData<Device>(deviceKeys.detail(id));
      qc.setQueryData<Device[]>(deviceKeys.list(), list => list?.map(d => (d.id === id ? { ...d, ...patch } : d)));
      qc.setQueryData<Device>(deviceKeys.detail(id), d => (d ? { ...d, ...patch } : d));
      return { prevList, prevDetail, id };
    },
    onError: (error, _v, ctx) => {
      Alert.alert('AC not updated', error instanceof Error ? error.message : String(error));
      if (!ctx) return;
      qc.setQueryData(deviceKeys.list(), ctx.prevList);
      qc.setQueryData(deviceKeys.detail(ctx.id), ctx.prevDetail);
    },
    onSuccess: device => {
      qc.setQueryData<Device[]>(deviceKeys.list(), list => list?.map(d => (d.id === device.id ? device : d)));
      qc.setQueryData(deviceKeys.detail(device.id), device);
    },
  });
}

export function useToggleDevicePower() {
  const patch = useDevicePatch();
  return {
    ...patch,
    toggle: (device: Pick<Device, 'id'>, isOn: boolean) => patch.mutate({ id: device.id, patch: { isOn } }),
  };
}

export const clampTemp = (v: number) => Math.min(TEMP_RANGE.max, Math.max(TEMP_RANGE.min, Math.round(v)));

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => devicesService().removeDevice(id),
    onSettled: () => qc.invalidateQueries({ queryKey: deviceKeys.all }),
  });
}
