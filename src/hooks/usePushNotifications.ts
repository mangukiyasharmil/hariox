import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | "default";
  token: string | null;
  isLoading: boolean;
}

export const usePushNotifications = () => {
  const { toast } = useToast();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "default",
    token: null,
    isLoading: false,
  });

  useEffect(() => {
    // Check if notifications are supported (including iOS 16.4+ PWA)
    const isSupported = "Notification" in window && "serviceWorker" in navigator;
    setState((prev) => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : "default",
    }));
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported. On iOS, add this app to Home Screen first.",
        variant: "destructive",
      });
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission, isLoading: false }));

      if (permission === "granted") {
        toast({
          title: "Notifications Enabled",
          description: "You will now receive payment alerts.",
        });
        
        await registerServiceWorker();
        return true;
      } else {
        toast({
          title: "Permission Denied",
          description: "Please enable notifications in your browser/device settings.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const registerServiceWorker = async () => {
    try {
      // Ensure service worker is registered and active
      let registration = await navigator.serviceWorker.getRegistration("/admin-sw.js");
      if (!registration) {
        registration = await navigator.serviceWorker.register("/admin-sw.js");
      }
      
      // Wait for SW to be active (important for iOS)
      if (registration.installing || registration.waiting) {
        await new Promise<void>((resolve) => {
          const sw = registration!.installing || registration!.waiting;
          if (sw) {
            sw.addEventListener("statechange", () => {
              if (sw.state === "activated") resolve();
            });
          } else {
            resolve();
          }
        });
      }
      
      console.log("Service worker registered and active:", registration);
      
      // Try push subscription if VAPID key exists
      const { data: vapidData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "vapid_public_key")
        .single();

      if (vapidData?.value && (registration as any).pushManager) {
        const subscription = await (registration as any).pushManager.getSubscription();
        if (!subscription) {
          const vapidKey = urlBase64ToUint8Array(vapidData.value);
          try {
            const newSubscription = await (registration as any).pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: vapidKey,
            });
            await saveSubscription(newSubscription);
          } catch (e) {
            console.log("Push subscription not available (expected on some devices):", e);
          }
        }
      }
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  };

  const saveSubscription = async (subscription: PushSubscription) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const subscriptionData = subscription.toJSON();
    console.log("Push subscription saved:", subscriptionData);
  };

  const showNotification = async (title: string, options?: NotificationOptions) => {
    if (state.permission !== "granted") return;

    try {
      // ALWAYS prefer service worker notifications (required for iOS PWA)
      const registration = await navigator.serviceWorker?.getRegistration("/admin-sw.js");
      if (registration?.active) {
        await registration.showNotification(title, {
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          vibrate: [200, 100, 200],
          ...options,
        } as NotificationOptions);
        return;
      }
    } catch (swErr) {
      console.log("SW notification fallback:", swErr);
    }

    // Fallback for desktop browsers
    try {
      new Notification(title, {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        ...options,
      });
    } catch (fallbackErr) {
      console.log("Notification fallback also failed:", fallbackErr);
    }
  };

  const scheduleFollowUpReminder = async (leadName: string, followUpTime: Date) => {
    if (state.permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return;
    }

    const now = new Date();
    const delay = followUpTime.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(() => {
        showNotification(`Follow-up Reminder: ${leadName}`, {
          body: `It's time to follow up with ${leadName}`,
          tag: `followup-${Date.now()}`,
          requireInteraction: true,
        });
      }, delay);
    }
  };

  return {
    ...state,
    requestPermission,
    showNotification,
    scheduleFollowUpReminder,
  };
};

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export default usePushNotifications;
