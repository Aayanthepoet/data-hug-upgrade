
-- Reusable updated_at trigger function already exists as public.set_updated_at()

-- PROPERTIES
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  city text,
  state text,
  zip text,
  county text,
  parcel_id text,
  property_type text,
  beds numeric,
  baths numeric,
  sqft integer,
  lot_sqft integer,
  year_built integer,
  estimated_value numeric,
  equity numeric,
  is_preforeclosure boolean NOT NULL DEFAULT false,
  is_vacant boolean NOT NULL DEFAULT false,
  is_absentee boolean NOT NULL DEFAULT false,
  lead_score integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their properties" ON public.properties FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all properties" ON public.properties FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_properties_user ON public.properties(user_id);

-- OWNERS
CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  entity_type text,
  mailing_address text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their owners" ON public.owners FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all owners" ON public.owners FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_owners_updated BEFORE UPDATE ON public.owners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_owners_user ON public.owners(user_id);
CREATE INDEX idx_owners_property ON public.owners(property_id);

-- CONTACTS
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.owners(id) ON DELETE CASCADE,
  contact_type text NOT NULL DEFAULT 'phone',
  value text NOT NULL,
  confidence numeric,
  is_verified boolean NOT NULL DEFAULT false,
  do_not_contact boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their contacts" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all contacts" ON public.contacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_contacts_user ON public.contacts(user_id);
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);

-- LEAD LISTS
CREATE TABLE public.lead_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_lists TO authenticated;
GRANT ALL ON public.lead_lists TO service_role;
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their lead lists" ON public.lead_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all lead lists" ON public.lead_lists FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_lead_lists_updated BEFORE UPDATE ON public.lead_lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_lead_lists_user ON public.lead_lists(user_id);

CREATE TABLE public.lead_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_list_id uuid NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_list_id, property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_list_items TO authenticated;
GRANT ALL ON public.lead_list_items TO service_role;
ALTER TABLE public.lead_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their lead list items" ON public.lead_list_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all lead list items" ON public.lead_list_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_lead_list_items_list ON public.lead_list_items(lead_list_id);

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  status text NOT NULL DEFAULT 'draft',
  script text,
  lead_list_id uuid REFERENCES public.lead_lists(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their campaigns" ON public.campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_campaigns_user ON public.campaigns(user_id);

-- OUTREACH MESSAGES
CREATE TABLE public.outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'sms',
  direction text NOT NULL DEFAULT 'outbound',
  body text,
  status text NOT NULL DEFAULT 'queued',
  response text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_messages TO authenticated;
GRANT ALL ON public.outreach_messages TO service_role;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their messages" ON public.outreach_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all messages" ON public.outreach_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_outreach_updated BEFORE UPDATE ON public.outreach_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_outreach_user ON public.outreach_messages(user_id);
CREATE INDEX idx_outreach_campaign ON public.outreach_messages(campaign_id);

-- AUCTIONS
CREATE TABLE public.auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  opening_bid numeric NOT NULL DEFAULT 0,
  current_bid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auctions TO authenticated;
GRANT ALL ON public.auctions TO service_role;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their auctions" ON public.auctions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all auctions" ON public.auctions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_auctions_updated BEFORE UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_auctions_user ON public.auctions(user_id);

-- BIDS
CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bidders view their own bids" ON public.bids FOR SELECT TO authenticated USING (auth.uid() = bidder_id);
CREATE POLICY "Auction owners view bids on their auctions" ON public.bids FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.auctions a WHERE a.id = bids.auction_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins view all bids" ON public.bids FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Bidders place their own bids" ON public.bids FOR INSERT TO authenticated WITH CHECK (auth.uid() = bidder_id);
CREATE INDEX idx_bids_auction ON public.bids(auction_id);
CREATE INDEX idx_bids_bidder ON public.bids(bidder_id);

-- MEDIA ASSETS
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type text NOT NULL DEFAULT 'image',
  url text NOT NULL,
  prompt text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their media" ON public.media_assets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all media" ON public.media_assets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_media_updated BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_media_user ON public.media_assets(user_id);

-- VIDEOS
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  script text,
  voiceover_url text,
  render_url text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their videos" ON public.videos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all videos" ON public.videos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_videos_updated BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_videos_user ON public.videos(user_id);
