// Build-time configuration. Values mirror the original 1.2.2 build except where noted.
export const env = {
  APP_VERSION: '1.2.3',
  API_BASE_URL: 'https://app.climateking.eu/api/v1',
  // Original shipped USE_MOCK: true, which left Schedules and Members on in-memory fixtures in
  // production. Those features now persist (see features/schedules, features/members).
  MOCK_LATENCY_MS: 450,
  // Demo mode runs every service on local fixtures (no server, no AC). Used for design QA
  // against the original's built-in mock mode; production builds keep it off.
  DEMO_MODE: true, // demo APK: homes, rooms and messages on local fixtures (flip to __DEV__ for dev, false for live)
  // Accounts and ACs live in Supabase (see supabase/migrations): sign-in goes through Supabase Auth
  // even in demo mode, because row level security ties every AC to the account that added it.
  SUPABASE_AUTH: true,
  // A Home Bridge whose heartbeat is older than this is treated as offline.
  BRIDGE_ONLINE_SECONDS: 45,
  GREE: {
    ENABLED: true,
    SCAN_TIMEOUT_MS: 3000,
    PROVISION_HOST: 'me.dis.gree.com',
  },
} as const;
