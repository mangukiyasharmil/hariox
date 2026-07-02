import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackAnalyticsEvent } from "@/hooks/useAnalyticsTracker";

/**
 * Global page view tracker that fires on EVERY route change.
 * This ensures all pages (admin, payment, blog, etc.) are tracked
 * in analytics_events, matching what GA4 captures globally.
 */
const GlobalPageTracker = () => {
  const location = useLocation();
  const lastTrackedPath = useRef<string>("");

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Avoid duplicate tracking for the same path in this session
    if (lastTrackedPath.current === currentPath) return;
    lastTrackedPath.current = currentPath;

    // Check if per-page tracker already handled this path
    const trackedKey = `analytics_tracked_${currentPath}`;
    if (sessionStorage.getItem(trackedKey)) return;

    // Detect company from hostname
    const hostname = window.location.hostname.toLowerCase();
    let companySlug: string | null = null;
    if (hostname.includes("capital")) companySlug = "capital";
    else if (hostname.includes("finance")) companySlug = "finance";
    else if (hostname.includes("credit") || hostname.includes("hariox")) companySlug = "hariox";

    trackAnalyticsEvent({
      eventType: "pageview",
      companyId: null,
      metadata: {
        tracked_by: "global",
        company_slug: companySlug,
      },
    });

    // Mark as tracked to prevent per-page duplicate
    sessionStorage.setItem(trackedKey, "1");
  }, [location.pathname]);

  return null;
};

export default GlobalPageTracker;
