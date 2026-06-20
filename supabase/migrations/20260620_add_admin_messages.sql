-- Migration: add admin_messages table

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_active_created_at ON public.admin_messages (active, created_at DESC);

-- Insert sample (disabled) placeholder — avoid hardcoded public-facing messages
-- INSERT INTO public.admin_messages (title, content, active) VALUES ('Welcome', 'Welcome to the platform', false) ON CONFLICT DO NOTHING;
