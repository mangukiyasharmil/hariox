-- Migration: 20260614112000_seed_default_companies.sql
-- Seed default companies for Capital Fundcera and Finance Fundcera if they don't exist

-- 1. Seed 'capital' company
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active)
VALUES (
  'bbe9fc5c-0caf-458e-aada-fa33143c4ff4', -- Hardcoded UUID referenced in previous migrations for Capital
  'Capital Fundcera',
  'capital',
  '#0f2744',
  '#f59e0b',
  '+91 9422799318',
  'capital@fundcera.com',
  '918469391818',
  'Surat, Gujarat, India',
  'https://capital.fundcera.com',
  true
)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    phone = COALESCE(companies.phone, EXCLUDED.phone),
    email = COALESCE(companies.email, EXCLUDED.email),
    whatsapp_number = COALESCE(companies.whatsapp_number, EXCLUDED.whatsapp_number),
    address = COALESCE(companies.address, EXCLUDED.address),
    website_url = COALESCE(companies.website_url, EXCLUDED.website_url);

-- 2. Seed 'finance' company
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active)
VALUES (
  'cce9fc5c-0caf-458e-aada-fa33143c4ff5',
  'Finance Fundcera',
  'finance',
  '#1e3a5f',
  '#f59e0b',
  '+91 9422799318',
  'finance@fundcera.com',
  '918469391818',
  'Surat, Gujarat, India',
  'https://finance.fundcera.com',
  true
)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    phone = COALESCE(companies.phone, EXCLUDED.phone),
    email = COALESCE(companies.email, EXCLUDED.email),
    whatsapp_number = COALESCE(companies.whatsapp_number, EXCLUDED.whatsapp_number),
    address = COALESCE(companies.address, EXCLUDED.address),
    website_url = COALESCE(companies.website_url, EXCLUDED.website_url);

-- 3. Link loose leads matching target slug source directly to their corresponding company_id
UPDATE public.leads
SET company_id = 'bbe9fc5c-0caf-458e-aada-fa33143c4ff4'
WHERE company_id IS NULL AND source = 'capital';

UPDATE public.leads
SET company_id = 'cce9fc5c-0caf-458e-aada-fa33143c4ff5'
WHERE company_id IS NULL AND source = 'finance';
