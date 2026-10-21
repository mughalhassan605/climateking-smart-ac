import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '../../config/env';
import { apiRequest } from '../../lib/api';
import { mockRequest } from '../../lib/mock';

// Shapes from the original createHttpMessagesService (module 1490).
export const MESSAGE_TYPES = [
  'deviceAdded',
  'deviceRenamed',
  'deviceRemoved',
  'deviceMoved',
  'roomCreated',
  'roomRenamed',
  'roomDeleted',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export type Message = {
  id: string;
  category: string;
  type: MessageType;
  params: Record<string, string>;
  timestamp: string;
  read: boolean;
};

const isKnown = (type: unknown): type is MessageType => (MESSAGE_TYPES as readonly string[]).includes(type as string);

type MessagesService = {
  getMessages(): Promise<Message[]>;
  markRead(ids: string[]): Promise<void>;
  markAllRead(): Promise<void>;
};

function createHttpMessagesService(): MessagesService {
  return {
    async getMessages() {
      const res = await apiRequest<{ messages: any[] }>('/messages');
      return res.messages
        .filter(m => isKnown(m.type))
        .map(m => ({
          id: String(m.id),
          category: m.category,
          type: m.type,
          params: m.params ?? {},
          timestamp: m.timestamp,
          read: !!m.read,
        }));
    },
    async markRead(ids) {
      await apiRequest('/messages/read', { method: 'POST', body: { ids } });
    },
    async markAllRead() {
      await apiRequest('/messages/read', { method: 'POST', body: {} });
    },
  };
}

function createMockMessagesService(): MessagesService {
  let messages: Message[] = [];
  return {
    getMessages: () => mockRequest('load messages', () => messages),
    markRead: ids =>
      mockRequest('update message', () => {
        messages = messages.map(m => (ids.includes(m.id) ? { ...m, read: true } : m));
      }),
    markAllRead: () =>
      mockRequest('update messages', () => {
        messages = messages.map(m => ({ ...m, read: true }));
      }),
  };
}

export const messagesService = env.DEMO_MODE ? createMockMessagesService() : createHttpMessagesService();
export const messageKeys = { all: ['messages'] as const, list: () => ['messages', 'list'] as const };

export const useMessages = () => useQuery({ queryKey: messageKeys.list(), queryFn: () => messagesService.getMessages() });

export function useUnreadMessageCount() {
  const { data } = useMessages();
  return data?.filter(m => !m.read).length ?? 0;
}

export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesService.markRead([id]),
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: messageKeys.list() });
      const prev = qc.getQueryData<Message[]>(messageKeys.list());
      qc.setQueryData<Message[]>(messageKeys.list(), list => list?.map(m => (m.id === id ? { ...m, read: true } : m)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(messageKeys.list(), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: messageKeys.all }),
  });
}

export function useMarkAllMessagesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => messagesService.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: messageKeys.list() });
      const prev = qc.getQueryData<Message[]>(messageKeys.list());
      qc.setQueryData<Message[]>(messageKeys.list(), list => list?.map(m => ({ ...m, read: true })));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(messageKeys.list(), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: messageKeys.all }),
  });
}
