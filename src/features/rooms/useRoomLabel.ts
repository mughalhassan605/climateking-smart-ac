import { useCallback } from 'react';
import { useI18n } from '../../i18n';

// Maps a stored room name to its displayed label (original roomNameLabel, module 1457).
const KEYED: Record<string, string> = {
  Unassigned: 'rooms.unassigned',
  'My Home': 'rooms.myHome',
};

export function useRoomLabel() {
  const { t } = useI18n();
  return useCallback((roomName?: string | null) => (roomName && KEYED[roomName] ? t(KEYED[roomName]) : roomName ?? ''), [t]);
}
