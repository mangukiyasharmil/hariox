-- Migration: 20260614123000_franchise_logins_and_fees.sql
-- Configure franchise details and logins for credit, finance, and capital

-- 1. Ensure the default companies exist and have pricing terms configured
-- Update 'fundcera' (Credit)
UPDATE public.companies
SET monthly_fee = 10000,
    setup_fee = 50000,
    setup_fee_paid = true,
    royalty_per_lead = 100,
    is_active = true
WHERE slug = 'fundcera';

-- Seed / Update 'capital'
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active, monthly_fee, setup_fee, setup_fee_paid, royalty_per_lead)
VALUES (
  'bbe9fc5c-0caf-458e-aada-fa33143c4ff4',
  'Capital Fundcera',
  'capital',
  '#0f2744',
  '#f59e0b',
  '+91 9422799318',
  'capital@fundcera.com',
  '918469391818',
  'Surat, Gujarat, India',
  'https://capital.fundcera.com',
  true,
  10000,
  50000,
  true,
  100
)
ON CONFLICT (slug) DO UPDATE
SET monthly_fee = EXCLUDED.monthly_fee,
    setup_fee = EXCLUDED.setup_fee,
    setup_fee_paid = EXCLUDED.setup_fee_paid,
    royalty_per_lead = EXCLUDED.royalty_per_lead;

-- Seed / Update 'finance'
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active, monthly_fee, setup_fee, setup_fee_paid, royalty_per_lead)
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
  true,
  10000,
  50000,
  true,
  100
)
ON CONFLICT (slug) DO UPDATE
SET monthly_fee = EXCLUDED.monthly_fee,
    setup_fee = EXCLUDED.setup_fee,
    setup_fee_paid = EXCLUDED.setup_fee_paid,
    royalty_per_lead = EXCLUDED.royalty_per_lead;


-- 2. Seed default franchise owner & admin accounts in auth.users using a robust DO block
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- A. Capital Owner: capital_owner@fundcera.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'capital_owner@fundcera.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Password123', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda1-0caf-458e-aada-fa33143c4ff4';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'capital_owner@fundcera.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Capital Franchise Owner"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Capital Owner
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'capital_owner@fundcera.com'),
      'email',
      now(),
      now(),
      now(),
      'capital_owner@fundcera.com'
    );
  END IF;

  -- B. Finance Owner: finance_owner@fundcera.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'finance_owner@fundcera.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Password123', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda2-0caf-458e-aada-fa33143c4ff5';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'finance_owner@fundcera.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Finance Franchise Owner"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Finance Owner
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'finance_owner@fundcera.com'),
      'email',
      now(),
      now(),
      now(),
      'finance_owner@fundcera.com'
    );
  END IF;

  -- C. Master Admin Account: fundcera@gmail.com / Fundcera@1818
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'fundcera@gmail.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Fundcera@1818', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda0-0caf-458e-aada-fa33143c4ff3';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'fundcera@gmail.com',
      extensions.crypt('Fundcera@1818', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Master Admin"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Master Admin
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'fundcera@gmail.com'),
      'email',
      now(),
      now(),
      now(),
      'fundcera@gmail.com'
    );
  END IF;

  -- D. Credit Owner: credit_owner@fundcera.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'credit_owner@fundcera.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Password123', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda3-0caf-458e-aada-fa33143c4ff6';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'credit_owner@fundcera.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Credit Franchise Owner"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Credit Owner
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'credit_owner@fundcera.com'),
      'email',
      now(),
      now(),
      now(),
      'credit_owner@fundcera.com'
    );
  END IF;
END $$;


-- 3. Dynamically resolve User IDs & Company IDs and map roles and companies
DO $$
DECLARE
  v_capital_user_id UUID;
  v_finance_user_id UUID;
  v_credit_user_id UUID;
  v_admin_user_id UUID;
  
  v_capital_company_id UUID;
  v_finance_company_id UUID;
  v_fundcera_company_id UUID;
BEGIN
  -- Fetch user IDs dynamically by email (handles cases where users already exist with other UUIDs)
  SELECT id INTO v_capital_user_id FROM auth.users WHERE email = 'capital_owner@fundcera.com' LIMIT 1;
  SELECT id INTO v_finance_user_id FROM auth.users WHERE email = 'finance_owner@fundcera.com' LIMIT 1;
  SELECT id INTO v_credit_user_id FROM auth.users WHERE email = 'credit_owner@fundcera.com' LIMIT 1;
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = 'fundcera@gmail.com' LIMIT 1;

  -- Fetch company IDs dynamically by slug
  SELECT id INTO v_capital_company_id FROM public.companies WHERE slug = 'capital' LIMIT 1;
  SELECT id INTO v_finance_company_id FROM public.companies WHERE slug = 'finance' LIMIT 1;
  SELECT id INTO v_fundcera_company_id FROM public.companies WHERE slug = 'fundcera' LIMIT 1;

  -- A. Setup Capital Owner Profiles, Roles, and Mappings
  IF v_capital_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_capital_user_id, 'capital_owner@fundcera.com', 'Capital Franchise Owner')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_capital_user_id, 'franchise_owner')
    ON CONFLICT DO NOTHING;

    IF v_capital_company_id IS NOT NULL THEN
      INSERT INTO public.franchise_owner_companies (user_id, company_id)
      VALUES (v_capital_user_id, v_capital_company_id)
      ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

      INSERT INTO public.company_users (user_id, company_id)
      VALUES (v_capital_user_id, v_capital_company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- B. Setup Finance Owner Profiles, Roles, and Mappings
  IF v_finance_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_finance_user_id, 'finance_owner@fundcera.com', 'Finance Franchise Owner')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_finance_user_id, 'franchise_owner')
    ON CONFLICT DO NOTHING;

    IF v_finance_company_id IS NOT NULL THEN
      INSERT INTO public.franchise_owner_companies (user_id, company_id)
      VALUES (v_finance_user_id, v_finance_company_id)
      ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

      INSERT INTO public.company_users (user_id, company_id)
      VALUES (v_finance_user_id, v_finance_company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- C. Setup Master Admin Profiles and Roles (no company lock)
  IF v_admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_admin_user_id, 'fundcera@gmail.com', 'Master Admin')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_user_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  -- D. Setup Credit Owner (Fundcera) Profiles, Roles, and Mappings
  IF v_credit_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_credit_user_id, 'credit_owner@fundcera.com', 'Credit Franchise Owner')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_credit_user_id, 'franchise_owner')
    ON CONFLICT DO NOTHING;

    IF v_fundcera_company_id IS NOT NULL THEN
      INSERT INTO public.franchise_owner_companies (user_id, company_id)
      VALUES (v_credit_user_id, v_fundcera_company_id)
      ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

      INSERT INTO public.company_users (user_id, company_id)
      VALUES (v_credit_user_id, v_fundcera_company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;


-- 4. Clean up any existing manual auth.users rows that have NULL values in required text fields
UPDATE auth.users 
SET confirmation_token = COALESCE(confirmation_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    recovery_token = COALESCE(recovery_token, '')
WHERE email IN ('fundcera@gmail.com', 'capital_owner@fundcera.com', 'finance_owner@fundcera.com', 'credit_owner@fundcera.com');
