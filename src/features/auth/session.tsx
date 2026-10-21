import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { queryClient } from '../../lib/queryClient';
import { authService, Session, SessionUser, setOnSessionLost } from './authService';

// Replaces the original Redux auth slice (module 938) with the same states:
// restoring -> authenticated | unauthenticated.
type Status = 'restoring' | 'authenticated' | 'unauthenticated';

type SessionValue = {
  status: Status;
  user: SessionUser | null;
  adopt: (session: Session) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring');
  const [user, setUser] = useState<SessionUser | null>(null);

  const end = useCallback(() => {
    setUser(null);
    setStatus('unauthenticated');
    queryClient.clear();
  }, []);

  useEffect(() => {
    setOnSessionLost(end);
    let alive = true;
    authService.restoreSession().then(session => {
      if (!alive) return;
      if (session) {
        setUser(session.user);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    });
    return () => {
      alive = false;
      setOnSessionLost(null);
    };
  }, [end]);

  const adopt = useCallback((session: Session) => {
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut().catch(() => undefined);
    end();
  }, [end]);

  const value = useMemo(() => ({ status, user, adopt, signOut }), [status, user, adopt, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
