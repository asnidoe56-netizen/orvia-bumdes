"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PresenceHeartbeatProps = {
  enabled: boolean;
};

export function PresenceHeartbeat({ enabled }: PresenceHeartbeatProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isActive = true;

    async function touchPresence() {
      if (!isActive || document.visibilityState === "hidden") {
        return;
      }

      try {
        await supabase.rpc("touch_user_presence", {
          p_current_path: pathname,
          p_page_title: document.title,
          p_user_agent: navigator.userAgent,
        });
      } catch (error) {
        console.error("touch_user_presence failed:", error);
      }
    }

    void touchPresence();

    const intervalId = window.setInterval(() => {
      void touchPresence();
    }, 60000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void touchPresence();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, pathname, supabase]);

  return null;
}
