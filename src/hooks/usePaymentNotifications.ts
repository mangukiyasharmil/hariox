import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "./usePushNotifications";

interface PaymentNotificationData {
  id: string;
  amount: number;
  total_amount: number;
  status: string;
  lead_id: string;
  company_id: string | null;
  payment_source: string;
}

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playBeeps = async () => {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 880;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.5, audioContext.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.3);

      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.5, audioContext.currentTime + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.65);
      osc2.start(audioContext.currentTime + 0.35);
      osc2.stop(audioContext.currentTime + 0.65);

      const osc3 = audioContext.createOscillator();
      const gain3 = audioContext.createGain();
      osc3.connect(gain3);
      gain3.connect(audioContext.destination);
      osc3.frequency.value = 1320;
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0.5, audioContext.currentTime + 0.7);
      gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);
      osc3.start(audioContext.currentTime + 0.7);
      osc3.stop(audioContext.currentTime + 1.0);
    };
    
    playBeeps().catch(err => console.log("Audio playback failed:", err));
  } catch (error) {
    console.log("Could not play notification sound:", error);
  }
};

/**
 * Hook that subscribes to real-time payment updates and shows notifications
 * when a payment is captured. Only active for admin users.
 * Uses refs for toast/notification to prevent re-subscription loops.
 */
export const usePaymentNotifications = (userRole?: string) => {
  const { toast } = useToast();
  const { showNotification, permission, requestPermission } = usePushNotifications();
  const processedPayments = useRef<Set<string>>(new Set());
  const isAdmin = userRole === "admin";

  // Stable refs — prevent channel re-subscription when these change
  const toastRef = useRef(toast);
  const showNotificationRef = useRef(showNotification);
  const permissionRef = useRef(permission);
  toastRef.current = toast;
  showNotificationRef.current = showNotification;
  permissionRef.current = permission;

  useEffect(() => {
    if (!isAdmin) {
      console.log("Payment notifications skipped (not admin)");
      return;
    }

    console.log("Setting up payment notification subscription (admin)...");

    const handlePaymentReceived = async (payment: PaymentNotificationData) => {
      if (processedPayments.current.has(payment.id)) return;
      processedPayments.current.add(payment.id);

      console.log("Payment notification received:", payment.id);

      let leadName = "Unknown Customer";
      let companyName = "Unknown";

      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("full_name, phone")
          .eq("id", payment.lead_id)
          .single();

        if (lead) leadName = lead.full_name || `+91${lead.phone}`;

        if (payment.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", payment.company_id)
            .single();
          if (company) companyName = company.name;
        }
      } catch (error) {
        console.error("Error fetching payment details for notification:", error);
      }

      const amount = payment.total_amount.toLocaleString('en-IN');
      const source = payment.payment_source?.charAt(0).toUpperCase() + payment.payment_source?.slice(1) || 'Direct';

      toastRef.current({
        title: `💰 Payment Received - ${companyName}`,
        description: `₹${amount} from ${leadName} (${source})`,
        duration: 10000,
      });

      if (permissionRef.current === "granted") {
        showNotificationRef.current(`💰 Payment Received - ${companyName}`, {
          body: `₹${amount} from ${leadName} (${source})`,
          tag: `payment-${payment.id}`,
          requireInteraction: true,
        });
      }

      playNotificationSound();
    };

    const channel = supabase
      .channel(`payment-notifications-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments' },
        async (payload) => {
          const payment = payload.new as PaymentNotificationData;
          const oldPayment = payload.old as PaymentNotificationData;
          
          const wasNotPaid = oldPayment.status !== 'captured' && oldPayment.status !== 'completed';
          const isNowPaid = payment.status === 'captured' || payment.status === 'completed';
          
          if (wasNotPaid && isNowPaid) {
            await handlePaymentReceived(payment);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        async (payload) => {
          const payment = payload.new as PaymentNotificationData;
          if (payment.status === 'captured' || payment.status === 'completed') {
            await handlePaymentReceived(payment);
          }
        }
      )
      .subscribe((status) => {
        console.log("Payment notification subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  return {
    requestNotificationPermission: requestPermission,
    notificationPermission: permission,
  };
};

export default usePaymentNotifications;
