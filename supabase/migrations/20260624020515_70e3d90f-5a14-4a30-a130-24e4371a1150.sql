
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS consent_ip inet,
  ADD COLUMN IF NOT EXISTS consent_user_agent text,
  ADD COLUMN IF NOT EXISTS phone_e164 text;

CREATE INDEX IF NOT EXISTS leads_phone_idx ON public.leads (phone);
CREATE INDEX IF NOT EXISTS leads_phone_e164_idx ON public.leads (phone_e164);

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

CREATE POLICY "Anyone can submit a lead"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(full_name) BETWEEN 1 AND 120
  AND length(email) BETWEEN 3 AND 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (message IS NULL OR length(message) <= 2000)
  AND (phone IS NULL OR length(phone) BETWEEN 7 AND 30)
  AND (
    sms_opt_in = false
    OR (
      sms_opt_in = true
      AND phone IS NOT NULL
      AND length(phone) >= 7
      AND sms_opt_in_at IS NOT NULL
    )
  )
);
