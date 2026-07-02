-- Re-add RLS policy so managers/telecallers/staff can view WhatsApp accounts
-- This was dropped in migration 20260509072252 but is needed for the Unified Inbox
-- to show WhatsApp chats for non-admin users.

-- Allow staff (admin, manager, telecaller, verification, login_team) to SELECT whatsapp_accounts
CREATE POLICY "Staff can view WhatsApp accounts"
  ON public.whatsapp_accounts FOR SELECT
  USING (public.is_staff(auth.uid()));
