-- Add Zaakpay tracking columns to the payments table
ALTER TABLE "public"."payments"
ADD COLUMN IF NOT EXISTS "zaakpay_order_id" text,
ADD COLUMN IF NOT EXISTS "zaakpay_payment_id" text,
ADD COLUMN IF NOT EXISTS "zaakpay_signature" text;

-- Add an index to speed up webhook lookups by zaakpay_order_id
CREATE INDEX IF NOT EXISTS "idx_payments_zaakpay_order_id" ON "public"."payments" ("zaakpay_order_id");
