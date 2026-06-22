CREATE OR REPLACE FUNCTION public.close_auction_if_expired(_auction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _top record;
BEGIN
  -- Row lock; skip if another worker is already closing it.
  SELECT id, status, ends_at INTO _row
  FROM public.auctions
  WHERE id = _auction_id
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN RETURN false; END IF;
  IF _row.status <> 'active' THEN RETURN false; END IF;
  IF _row.ends_at > now() THEN RETURN false; END IF;

  SELECT id, bidder_id, amount INTO _top
  FROM public.bids
  WHERE auction_id = _auction_id
  ORDER BY amount DESC, created_at ASC
  LIMIT 1;

  UPDATE public.auctions
  SET status         = CASE WHEN _top.id IS NULL THEN 'ended' ELSE 'sold' END,
      winner_id      = _top.bidder_id,
      winning_bid_id = _top.id,
      ended_at       = now()
  WHERE id = _auction_id
    AND status = 'active';

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_expired_auctions(_limit int DEFAULT 500)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _count int := 0;
BEGIN
  FOR _id IN
    SELECT id FROM public.auctions
    WHERE status = 'active' AND ends_at <= now()
    ORDER BY ends_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  LOOP
    IF public.close_auction_if_expired(_id) THEN
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.close_auction_if_expired(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_expired_auctions(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_auction_if_expired(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_expired_auctions(int) TO authenticated, service_role;