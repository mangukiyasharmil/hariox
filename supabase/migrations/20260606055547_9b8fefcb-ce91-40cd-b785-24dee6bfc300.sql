SELECT cron.schedule(
  'whatsapp-remarketing-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oreyfqrqkdgbkmnnnlqh.supabase.co/functions/v1/whatsapp-remarketing-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);