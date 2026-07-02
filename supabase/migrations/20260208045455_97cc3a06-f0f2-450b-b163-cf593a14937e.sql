-- Add configurable lead assignment percentages as a system setting
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'lead_assignment_weights',
  '{"2ad61b79-d8c7-468e-a1f2-c11303167be8": 70, "c0913134-b0db-4b08-863f-e35c943a860c": 30}',
  'JSON map of telecaller user_id to assignment percentage (must sum to 100). Used by process-pending-leads for round-robin weighted distribution.'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;