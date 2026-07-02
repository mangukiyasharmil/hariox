
ALTER VIEW public.royalty_monthly_summary SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'manager', 'telecaller', 'verification', 'login_team')
  );
$function$;

DROP POLICY IF EXISTS "Only admins can view OTP codes" ON public.otp_codes;
