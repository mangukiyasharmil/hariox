-- Add 'whatsapp' to payment_source enum
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'whatsapp';

-- Add system settings for WhatsApp payment URLs for each company
INSERT INTO system_settings (key, value, description)
VALUES 
  ('payment_url_whatsapp_fundcera', 'https://credit.fundcera.com/whatsapp', 'WhatsApp marketing payment URL for Credit Fundcera'),
  ('payment_url_whatsapp_capital', 'https://capital.fundcera.com/whatsapp', 'WhatsApp marketing payment URL for Loan Fundcera'),
  ('payment_url_whatsapp_finance', 'https://financefundcera.com/whatsapp', 'WhatsApp marketing payment URL for Finance Fundcera')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;