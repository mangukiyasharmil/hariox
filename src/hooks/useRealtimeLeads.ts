import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Subscribe to realtime changes on the leads and payments tables.
 * Whenever a row is inserted, updated, or deleted, all matching
 * React Query caches are automatically invalidated so every open
 * admin panel (even on a second device) refreshes within seconds.
 */
export function useRealtimeSync(queryKeysToInvalidate: string[][] = []) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = (keys: string[][]) => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      invalidateTimer = setTimeout(() => {
        keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        queryKeysToInvalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }, 500);
    };

    const channel = supabase
      .channel(`admin-sync-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          scheduleInvalidate([
            ["leads"],
            ["admin-stats"],
            ["team-performance-dashboard"],
            ["telecaller-leads"],
            ["verification-leads"],
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          scheduleInvalidate([
            ["payments"],
            ["admin-stats"],
            ["payment-sources"],
          ]);
        }
      )
      .subscribe();

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKeysToInvalidate]);
}
