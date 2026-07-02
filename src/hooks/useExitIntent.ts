import { useEffect, useState } from "react";

interface UseExitIntentOptions {
  /** Disable the trigger entirely (e.g. when a modal is already open). */
  enabled?: boolean;
  /** Don't show again within N hours. Default 24. */
  cooldownHours?: number;
  /** Storage key suffix to scope per-brand. */
  storageKey?: string;
  /** Minimum time on page (ms) before trigger arms. Default 8000. */
  minDwellMs?: number;
}

/**
 * Triggers exit-intent on:
 *  - Desktop: cursor leaves top of viewport
 *  - Mobile: rapid scroll-up after dwelling
 *  - Either: 45s of inactivity
 * Respects a per-brand cooldown so users don't see the popup repeatedly.
 */
export const useExitIntent = ({
  enabled = true,
  cooldownHours = 24,
  storageKey = "default",
  minDwellMs = 8000,
}: UseExitIntentOptions = {}) => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const fullKey = `exit_intent_dismissed_${storageKey}`;
    const lastShown = localStorage.getItem(fullKey);
    if (lastShown) {
      const hoursSince = (Date.now() - parseInt(lastShown, 10)) / (1000 * 60 * 60);
      if (hoursSince < cooldownHours) return;
    }

    let armed = false;
    const armTimer = window.setTimeout(() => { armed = true; }, minDwellMs);

    let lastScrollY = window.scrollY;
    let lastScrollTime = Date.now();
    let inactivityTimer: number | undefined;

    const trigger = () => {
      if (!armed) return;
      cleanup();
      setShouldShow(true);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };

    const handleScroll = () => {
      const now = Date.now();
      const dy = window.scrollY - lastScrollY;
      const dt = now - lastScrollTime;
      // Fast upward scroll (mobile exit intent proxy)
      if (dt < 250 && dy < -120) trigger();
      lastScrollY = window.scrollY;
      lastScrollTime = now;
      resetInactivity();
    };

    const resetInactivity = () => {
      window.clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(trigger, 45000);
    };

    const cleanup = () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("scroll", handleScroll);
      window.clearTimeout(inactivityTimer);
      window.clearTimeout(armTimer);
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("scroll", handleScroll, { passive: true });
    resetInactivity();

    return cleanup;
  }, [enabled, cooldownHours, storageKey, minDwellMs]);

  const dismiss = () => {
    setShouldShow(false);
    localStorage.setItem(`exit_intent_dismissed_${storageKey}`, String(Date.now()));
  };

  return { shouldShow, dismiss };
};
