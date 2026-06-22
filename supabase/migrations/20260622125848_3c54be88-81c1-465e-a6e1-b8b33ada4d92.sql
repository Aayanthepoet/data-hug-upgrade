CREATE POLICY "Authenticated view active auctions"
ON public.auctions FOR SELECT TO authenticated
USING (status = 'active');

CREATE POLICY "Authenticated view bids on active auctions"
ON public.bids FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.auctions a WHERE a.id = bids.auction_id AND a.status = 'active'));