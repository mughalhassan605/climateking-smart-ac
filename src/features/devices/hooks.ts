import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { env } from '../../config/env';
import { createGreeDevicesService } from '../gree/greeDevicesService';
import { createMockDevicesService, DevicePatch, DevicesService } from './mockDevices';
import { createSupabaseDevicesService } from './supabaseDevicesService';
import { Device, TEMP_RANGE } from './types';

let service: DevicesService | null = null;

export function devicesService(): DevicesService {
  if (!service) service = createSupabaseDevicesService();
  return service;
}

export const deviceKeys = {
  all: ['devices'] as const,
  list: () => [...deviceKeys.all, 'list'] as const,
  detail: (id: string) => [...deviceKeys.all, 'detail', id] as const,
};

// While a screen showing live state is focused, status is re-read on a short interval
// instead of waiting for the 30 s global stale window (the original's "offline after 30 s").
const LIVE_REFRESH_MS = 10000;

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
    onError: (_e, _v, ctx) => {
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
