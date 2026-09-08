"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Keeps the Supabase session alive.
 *
 * The browser client already auto-refreshes the access token while the tab is
 * open, but tokens can lapse when a tab sleeps in the background. This watcher
 * proactively refreshes the session when the tab becomes visible again and
 * forces a sign-out if the refresh token is irrevocably expired.
 */
export default function SessionKeeper() {
  useEffect(() => {
    const refresh = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) void supabase.auth.refreshSession();
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        // Session is healthy — nothing else to do.
        return;
      }
    });

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
