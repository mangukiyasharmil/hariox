SELECT cron.unschedule('whatsapp-remarketing-scheduler');
SELECT cron.schedule(
  'whatsapp-remarketing-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://oreyfqrqkdgbkmnnnlqh.supabase.co/functions/v1/whatsapp-remarketing-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZXlmcXJxa2RnYmttbm5ubHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTEzMTYsImV4cCI6MjA4NTA4NzMxNn0.1TKH9Bs-coTUNdfK6kkXJoFIDLXOWFUzjt60dkfXLFk"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);