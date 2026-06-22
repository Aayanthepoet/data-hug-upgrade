ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS skip_trace_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS skip_trace_last_run_at timestamptz;

ALTER TABLE public.owners
  DROP CONSTRAINT IF EXISTS owners_skip_trace_status_check;
ALTER TABLE public.owners
  ADD CONSTRAINT owners_skip_trace_status_check
  CHECK (skip_trace_status IN ('pending','traced','no_hit','failed'));

UPDATE public.owners o
SET skip_trace_status = 'traced',
    skip_trace_last_run_at = COALESCE(skip_trace_last_run_at, now())
WHERE EXISTS (
  SELECT 1 FROM public.contacts c
  WHERE c.owner_id = o.id
    AND c.contact_type IN ('phone','email')
);