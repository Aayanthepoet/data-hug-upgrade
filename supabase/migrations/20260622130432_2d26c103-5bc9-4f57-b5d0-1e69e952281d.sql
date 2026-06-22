ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS winner_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS winning_bid_id uuid REFERENCES public.bids(id),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;