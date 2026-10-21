import { QueryClient } from '@tanstack/react-query';

// Original defaults (module 989) were staleTime 30 s, gcTime 5 min, retry 1. They stay for
// server data; device status opts out per query (see features/devices) because a 30 s stale
// window followed by a single failed LAN read is what showed ACs as "offline" after ~30 s.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
