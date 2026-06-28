-- Add Opay (and Monnify, which was already used in code but never migrated)
-- to the payment_provider enum. Postgres enums can't have values removed
-- without recreating the type, so we only ADD here — existing 'paystack'
-- rows in payment_intents / wallet_transactions are left untouched as history.
--
-- Run this in Supabase SQL Editor (or via `supabase db push`) before using
-- the Opay top-up flow, otherwise inserts with provider='opay' will fail
-- with: invalid input value for enum payment_provider: "opay"

DO $$
BEGIN
  ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'monnify';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'opay';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
