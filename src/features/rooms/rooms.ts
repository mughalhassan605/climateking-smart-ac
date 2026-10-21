import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '../../config/env';
import { apiRequest } from '../../lib/api';
import { mockRequest } from '../../lib/mock';

export type RoomAccent = 'cool' | 'heat' | 'dry' | 'fan' | 'auto' | 'accent' | 'primary';
export type Room = { id: string; name: string; accent: RoomAccent; order: number; nameKey?: string };

export const UNASSIGNED_ROOM = 'unassigned';

// Demo data from the original roomFixtures (module 1463).
const roomFixtures: Room[] = [
  { id: 'room-living', name: 'Living Room', nameKey: 'rooms.livingRoom', order: 0, accent: 'cool' },
  { id: 'room-bedroom', name: 'Bedroom', nameKey: 'rooms.bedroom', order: 1, accent: 'auto' },
  { id: 'room-office', name: 'Office', nameKey: 'rooms.office', order: 2, accent: 'dry' },
  { id: 'room-kids', name: "Kids' Room", nameKey: 'rooms.kidsRoom', order: 3, accent: 'heat' },
  { id: 'room-kitchen', name: 'Kitchen', nameKey: 'rooms.kitchen', order: 4, accent: 'fan' },
  { id: 'room-guest', name: 'Guest Room', nameKey: 'rooms.guestRoom', order: 5, accent: 'accent' },
];

const toRoom = (r: any): Room => ({ id: String(r.id), name: r.name, accent: r.accent ?? 'primary', order: r.order ?? 0 });

export type RoomsService = {
  getRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room>;
  createRoom(input: { name: string; accent?: RoomAccent }): Promise<Room>;
  updateRoom(id: string, patch: Partial<Pick<Room, 'name' | 'accent'>>): Promise<Room>;
  deleteRoom(id: string): Promise<void>;
  reorderRooms(orderedIds: string[]): Promise<void>;
};

export function createHttpRoomsService(): RoomsService {
  return {
    async getRooms() {
      const res = await apiRequest<{ rooms: any[] }>('/rooms');
      return res.rooms.map(toRoom);
    },
    async getRoom(id) {
      const res = await apiRequest<any>(`/rooms/${id}`);
      return toRoom(res.room ?? res);
    },
    async createRoom({ name, accent = 'primary' }) {
      const res = await apiRequest<any>('/rooms', { method: 'POST', body: { name, accent } });
      return toRoom(res.room ?? res);
    },
    async updateRoom(id, patch) {
      const res = await apiRequest<any>(`/rooms/${id}`, { method: 'PATCH', body: patch });
      return toRoom(res.room ?? res);
    },
    async deleteRoom(id) {
      await apiRequest(`/rooms/${id}`, { method: 'DELETE' });
    },
    async reorderRooms(orderedIds) {
      await apiRequest('/rooms/reorder', { method: 'POST', body: { orderedIds } });
    },
  };
}

export function createMockRoomsService(): RoomsService {
  let rooms = roomFixtures.map(r => ({ ...r }));
  const sorted = () => [...rooms].sort((a, b) => a.order - b.order);
  const find = (id: string) => {
    const room = rooms.find(r => r.id === id);
    if (!room) throw new Error('Room not found.');
    return room;
  };
  return {
    getRooms: () => mockRequest('load your rooms', () => sorted()),
    getRoom: id => mockRequest('load the room', () => ({ ...find(id) })),
    createRoom: ({ name, accent = 'primary' }) =>
      mockRequest('create the room', () => {
        const room: Room = { id: `room-${Date.now()}`, name, accent, order: rooms.length };
        rooms = [...rooms, room];
        return room;
      }),
    updateRoom: (id, patch) =>
      mockRequest('update the room', () => {
        const next = { ...find(id), ...patch };
        if (patch.name) delete next.nameKey;
        rooms = rooms.map(r => (r.id === id ? next : r));
        return next;
      }),
    deleteRoom: id =>
      mockRequest('delete the room', () => {
        rooms = rooms.filter(r => r.id !== id);
      }),
    reorderRooms: orderedIds =>
      mockRequest('reorder rooms', () => {
        rooms = rooms.map(r => ({ ...r, order: Math.max(orderedIds.indexOf(r.id), 0) }));
      }),
  };
}

export const roomsService: RoomsService = env.DEMO_MODE ? createMockRoomsService() : createHttpRoomsService();

export const roomKeys = {
  all: ['rooms'] as const,
  list: () => [...roomKeys.all, 'list'] as const,
  detail: (id: string) => [...roomKeys.all, 'detail', id] as const,
};

export const useRooms = () => useQuery({ queryKey: roomKeys.list(), queryFn: () => roomsService.getRooms() });

export const useRoom = (id: string) =>
  useQuery({ queryKey: roomKeys.detail(id), queryFn: () => roomsService.getRoom(id), enabled: !!id && id !== UNASSIGNED_ROOM });

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; accent?: RoomAccent }) => roomsService.createRoom(input),
    onSettled: () => qc.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Room, 'name' | 'accent'>> }) => roomsService.updateRoom(id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => roomsService.deleteRoom(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: roomKeys.all });
      qc.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useReorderRooms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => roomsService.reorderRooms(orderedIds),
    onMutate: async orderedIds => {
      await qc.cancelQueries({ queryKey: roomKeys.list() });
      const prev = qc.getQueryData<Room[]>(roomKeys.list());
      if (prev) {
        qc.setQueryData<Room[]>(
          roomKeys.list(),
          [...prev].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)).map((r, i) => ({ ...r, order: i })),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(roomKeys.list(), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: roomKeys.all }),
  });
}
