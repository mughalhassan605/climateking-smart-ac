import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '../../config/env';
import { useI18n } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { mockRequest } from '../../lib/mock';
import { COUNTRIES } from './countries';
import { HOME_REGIONS } from './regions';

export type HomeRole = 'owner' | 'admin' | 'member';
export type Home = {
  id: string;
  name: string;
  region: { code: string; name: string } | null;
  roomCount: number;
  deviceCount: number;
  memberCount: number;
  isCurrent: boolean;
  role: HomeRole;
};

export const FALLBACK_HOME_ID = 'home-fallback';
export const FALLBACK_HOME_NAME_KEY = 'rooms.myHome';

export function greetingKeyFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'home.goodMorning';
  if (h < 17) return 'home.goodAfternoon';
  return 'home.goodEvening';
}

// The server may send the region as an ISO code or a country name.
function toRegion(value: unknown): Home['region'] {
  if (!value) return null;
  if (typeof value === 'object') {
    const v = value as { code?: string; name?: string };
    return v.code || v.name ? { code: v.code ?? '', name: v.name ?? v.code ?? '' } : null;
  }
  const s = String(value);
  const hit =
    HOME_REGIONS.find(r => r.code === s || r.name === s) ?? COUNTRIES.find(c => c.code === s || c.name === s);
  return hit ? { code: hit.code, name: hit.name } : { code: s, name: s };
}

const toHome = (h: any): Home => ({
  id: String(h.id),
  name: h.name,
  region: toRegion(h.region),
  roomCount: h.roomCount ?? 0,
  deviceCount: h.deviceCount ?? 0,
  memberCount: h.memberCount ?? 1,
  isCurrent: !!h.isCurrent,
  role: h.role ?? 'owner',
});

type HomesService = {
  getHomes(): Promise<Home[]>;
  createHome(input: { name: string; region?: string | null }): Promise<Home>;
  renameHome(id: string, name: string): Promise<Home>;
  setHomeRegion(id: string, region: string): Promise<Home>;
  setCurrentHome(id: string): Promise<void>;
  deleteHome(id: string): Promise<void>;
};

function createHttpHomesService(): HomesService {
  return {
    async getHomes() {
      const res = await apiRequest<{ homes: any[] }>('/homes');
      return res.homes.map(toHome);
    },
    async createHome({ name, region }) {
      const res = await apiRequest<any>('/homes', { method: 'POST', body: { name, region: region ?? null } });
      return toHome(res.home ?? res);
    },
    async renameHome(id, name) {
      const res = await apiRequest<any>(`/homes/${id}`, { method: 'PATCH', body: { name } });
      return toHome(res.home ?? res);
    },
    async setHomeRegion(id, region) {
      const res = await apiRequest<any>(`/homes/${id}`, { method: 'PATCH', body: { region } });
      return toHome(res.home ?? res);
    },
    async setCurrentHome(id) {
      await apiRequest(`/homes/${id}/current`, { method: 'POST' });
    },
    async deleteHome(id) {
      await apiRequest(`/homes/${id}`, { method: 'DELETE' });
    },
  };
}

function createMockHomesService(): HomesService {
  let homes: Home[] = [
    {
      id: 'home-1',
      name: 'My Home',
      region: { code: 'NL', name: 'Netherlands' },
      roomCount: 3,
      deviceCount: 2,
      memberCount: 1,
      isCurrent: true,
      role: 'owner',
    },
  ];
  const find = (id: string) => {
    const h = homes.find(x => x.id === id);
    if (!h) throw new Error('Home not found.');
    return h;
  };
  const update = (id: string, patch: Partial<Home>) => {
    const next = { ...find(id), ...patch };
    homes = homes.map(h => (h.id === id ? next : h));
    return next;
  };
  return {
    getHomes: () => mockRequest('load your homes', () => homes),
    createHome: ({ name, region }) =>
      mockRequest('create the home', () => {
        const home: Home = {
          id: `home-${Date.now()}`,
          name,
          region: toRegion(region),
          roomCount: 0,
          deviceCount: 0,
          memberCount: 1,
          isCurrent: false,
          role: 'owner',
        };
        homes = [...homes, home];
        return home;
      }),
    renameHome: (id, name) => mockRequest('rename the home', () => update(id, { name })),
    setHomeRegion: (id, region) => mockRequest('update the region', () => update(id, { region: toRegion(region) })),
    setCurrentHome: id =>
      mockRequest('switch home', () => {
        homes = homes.map(h => ({ ...h, isCurrent: h.id === id }));
      }),
    deleteHome: id =>
      mockRequest('delete the home', () => {
        homes = homes.filter(h => h.id !== id);
      }),
  };
}

export const homesService = env.DEMO_MODE ? createMockHomesService() : createHttpHomesService();

export const homeKeys = { all: ['homes'] as const, list: () => ['homes', 'list'] as const };

export const useHomes = () => useQuery({ queryKey: homeKeys.list(), queryFn: () => homesService.getHomes() });

/** Current home plus the time-of-day greeting (original useHome, module 1578). */
export function useHome() {
  const { t } = useI18n();
  const { data } = useHomes();
  const current = data?.find(h => h.isCurrent);
  const home = current ?? { id: FALLBACK_HOME_ID, name: t(FALLBACK_HOME_NAME_KEY) };
  return { home, greeting: t(greetingKeyFor()) };
}

function useHomeMutation<V>(fn: (v: V) => Promise<unknown>, alsoInvalidate: string[][] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: homeKeys.all });
      alsoInvalidate.forEach(k => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export const useCreateHome = () => useHomeMutation((v: { name: string; region?: string | null }) => homesService.createHome(v));
export const useRenameHome = () => useHomeMutation((v: { id: string; name: string }) => homesService.renameHome(v.id, v.name));
export const useSetHomeRegion = () =>
  useHomeMutation((v: { id: string; region: string }) => homesService.setHomeRegion(v.id, v.region));
export const useSetCurrentHome = () =>
  useHomeMutation((id: string) => homesService.setCurrentHome(id), [['rooms'], ['devices']]);
export const useDeleteHome = () => useHomeMutation((id: string) => homesService.deleteHome(id), [['rooms'], ['devices']]);
