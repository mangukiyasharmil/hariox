-- Insert DLT-whitelisted URLs into system_settings
INSERT INTO system_settings (key, value, description) VALUES
  ('sms_url_credit_telecaller', 'https://credit.fundcera.com/pay/telecaller', 'DLT whitelisted URL for Credit telecaller SMS'),
  ('sms_url_credit_marketing', 'https://credit.fundcera.com/pay/marketing', 'DLT whitelisted URL for Credit marketing SMS'),
  ('sms_url_finance_telecaller', 'https://finance.fundcera.com/pay/telecaller', 'DLT whitelisted URL for Finance telecaller SMS'),
  ('sms_url_finance_marketing', 'https://finance.fundcera.com/pay/marketing', 'DLT whitelisted URL for Finance marketing SMS'),
  ('sms_url_capital_telecaller', 'https://capital.fundcera.com/pay/telecaller', 'DLT whitelisted URL for Capital telecaller SMS'),
  ('sms_url_capital_marketing', 'https://capital.fundcera.com/pay/marketing', 'DLT whitelisted URL for Capital marketing SMS')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();