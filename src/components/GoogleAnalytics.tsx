import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

interface GoogleAnalyticsProps {
  measurementId?: string | null;
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    _gaInitialized?: Set<string>;
  }
}

const GoogleAnalytics = ({ measurementId: propMeasurementId }: GoogleAnalyticsProps) => {
  const [measurementId, setMeasurementId] = useState<string | null>(propMeasurementId || null);
  const location = useLocation();
  const initializedRef = useRef(false);

  useEffect(() => {
    // If no prop provided, fetch from database
    if (!propMeasurementId) {
      fetchMeasurementId();
    } else {
      setMeasurementId(propMeasurementId);
    }
  }, [propMeasurementId]);

  const fetchMeasurementId = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "google_analytics_id")
      .single();
    
    if (data?.value) {
      setMeasurementId(data.value);
    }
  };

  useEffect(() => {
    if (!measurementId) return;

    // Track which measurement IDs have been initialized
    window._gaInitialized = window._gaInitialized || new Set();

    // Initialize dataLayer and gtag if not exists
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
    }

    // Only configure this measurement ID once
    if (!window._gaInitialized.has(measurementId)) {
      window._gaInitialized.add(measurementId);
      window.gtag('config', measurementId, {
        page_path: location.pathname + location.search,
        send_page_view: true,
      });

      // Load gtag script only once (use first measurement ID)
      if (window._gaInitialized.size === 1) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
      }
      
      initializedRef.current = true;
      console.log(`[GA] Initialized tracking for ${measurementId}`);
    }
  }, [measurementId]);

  // Track page views on route changes
  useEffect(() => {
    if (!measurementId || !initializedRef.current) return;

    window.gtag('config', measurementId, {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location, measurementId]);

  return null;
};

export default GoogleAnalytics;

// Helper functions for tracking events
export const trackGAEvent = (eventName: string, params?: Record<string, any>) => {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
};

export const trackGAPageView = (pagePath: string, pageTitle?: string) => {
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
};

export const trackGAConversion = (conversionId: string, value?: number) => {
  if (window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: conversionId,
      value: value,
      currency: 'INR',
    });
  }
};

// Track lead form submission
export const trackGALead = (params?: { loan_type?: string; loan_amount?: number }) => {
  if (window.gtag) {
    window.gtag('event', 'generate_lead', {
      currency: 'INR',
      value: params?.loan_amount || 0,
      ...params,
    });
  }
};

// Track payment/purchase
export const trackGAPurchase = (orderId: string, amount: number) => {
  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: orderId,
      value: amount,
      currency: 'INR',
      items: [{
        item_name: 'Loan Consulting Fee',
        price: amount,
        quantity: 1,
      }],
    });
  }
};
