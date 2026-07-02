
-- 1. Rename "Fundcera" to "Credit Fundcera"
UPDATE whatsapp_accounts SET name = 'Credit Fundcera' WHERE id = '14695e74-2978-492a-9d22-43a5237da840';

-- 2. Add company_id column to whatsapp_accounts
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 3. Link existing accounts to companies
UPDATE whatsapp_accounts SET company_id = '0a817e57-9c31-4aba-b709-3647958b917e' WHERE id = '14695e74-2978-492a-9d22-43a5237da840'; -- Credit Fundcera
UPDATE whatsapp_accounts SET company_id = 'e00c26fa-d874-4977-9fc6-bdf6e6b66344' WHERE id = '86053797-3ea3-4e6c-ab5e-32f770cbe579'; -- Finance Fundcera
UPDATE whatsapp_accounts SET company_id = 'bbe9fc5c-0caf-458e-aada-fa33143c4ff4' WHERE id = 'd0eb940b-2d3c-4774-a46a-a89548af4004'; -- Capital Fundcera

-- 4. Create index for company filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_company_id ON whatsapp_accounts(company_id);
