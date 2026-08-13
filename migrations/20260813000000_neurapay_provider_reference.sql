-- NeuraPay repair migration — run this in the Supabase SQL editor.
--
-- 1. Stores the provider-side transaction id on the intent, so verification
--    and webhooks can address the transaction the way NeuraPay does.
-- 2. Adds the lookup indexes hit on every init/verify/webhook call.
-- 3. Hard-enforces credit idempotency at the database level.

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS provider_reference text;

CREATE INDEX IF NOT EXISTS payment_intents_provider_reference_idx
  ON public.payment_intents (provider_reference);

CREATE INDEX IF NOT EXISTS payment_intents_reference_idx
  ON public.payment_intents (reference);

-- credit_wallet() already short-circuits on a duplicate reference; this unique
-- index makes a double credit impossible even under concurrent webhooks.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_reference_key
  ON public.wallet_transactions (reference)
  WHERE reference IS NOT NULL;
