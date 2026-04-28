'use client';

/**
 * SessionTimeoutWatcher
 *
 * Monitors session activity and warns the user before the session expires.
 * - Session timeout: 15 minutes (matches server.servlet.session.timeout=15m)
 * - Warning shown: 2 minutes before expiry (at 13 minutes of inactivity)
 * - On any user activity (click, keydown, scroll, mousemove) the timer resets.
 * - When the timeout hits, the user is redirected to /login.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { AUTH } from '@/utils/apiConstants';

/** Total session lifetime in ms — must match application.properties */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/** How long before expiry to show the warning toast */
const WARN_BEFORE_MS = 2 * 60 * 1000; // 2 minutes before = warn at 13 min

/** Pages that don't need session tracking (public + auth pages) */
const EXCLUDED_PATHS = ['/login', '/register', '/f/', '/forgot-password', '/reset-password'];

export default function SessionTimeoutWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const lastActivityRef = useRef<number>(Date.now());
  const [warningShown, setWarningShown] = useState(false);
  const warnToastIdRef = useRef<string | number | null>(null);

  // Don't run on public/auth pages
  const isExcluded = EXCLUDED_PATHS.some(p => pathname.includes(p));

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningShown) {
      // Dismiss the warning if the user acted
      if (warnToastIdRef.current !== null) {
        toast.dismiss(warnToastIdRef.current);
        warnToastIdRef.current = null;
      }
      setWarningShown(false);
    }
  }, [warningShown]);

  const doLogout = useCallback(async () => {
    try {
      await fetch(AUTH.LOGOUT, { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    router.push('/login');
  }, [router]);

  useEffect(() => {
    if (isExcluded) return;

    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    const interval = setInterval(async () => {
      const idleMs = Date.now() - lastActivityRef.current;
      const remaining = SESSION_TIMEOUT_MS - idleMs;

      if (remaining <= 0) {
        // Session expired — redirect immediately
        clearInterval(interval);
        toast.error('Your session has expired. Redirecting to login...', { duration: 4000 });
        setTimeout(() => doLogout(), 1500);
        return;
      }

      if (remaining <= WARN_BEFORE_MS && !warningShown) {
        // Show warning with countdown
        const minutesLeft = Math.ceil(remaining / 60000);
        setWarningShown(true);
        const id = toast.warning(
          `Your session will expire in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}. Move your mouse or press a key to stay logged in.`,
          {
            duration: WARN_BEFORE_MS,
            action: {
              label: 'Stay logged in',
              onClick: () => {
                // Ping the server to extend the session
                fetch(AUTH.ME, { credentials: 'include' }).catch(() => { });
                resetTimer();
              }
            }
          }
        );
        warnToastIdRef.current = id;
      }

      // Periodically verify the session is still valid on the server
      // (catches the case where the server invalidates the session for other reasons)
      if (idleMs > 0 && idleMs % 60000 < 3000) {
        try {
          const res = await fetch(AUTH.ME, { credentials: 'include' });
          if (res.status === 401) {
            clearInterval(interval);
            toast.error('Your session has expired. Redirecting to login...');
            setTimeout(() => doLogout(), 1500);
          }
        } catch { /* network error, don't interrupt */ }
      }
    }, 5000); // check every 5 seconds

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [isExcluded, warningShown, resetTimer, doLogout]);

  return null; // Renders nothing — purely behavioral
}
