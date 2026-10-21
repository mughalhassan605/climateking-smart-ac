import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://fvgkqztdovqzxhskhxkn.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2Z2txenRkb3Zxenhoc2toeGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTI5MDAsImV4cCI6MjEwODA2ODkwMH0.YkuB06l6RGZiq2EdWqRWWrEnxSdTWBAuYX9m2UArE3s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
