-- ============================================================
-- Notification preferences
-- ============================================================
CREATE TABLE public.notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_in_app     boolean NOT NULL DEFAULT true,
  channel_sms        boolean NOT NULL DEFAULT false,
  sms_phone          text,
  on_lead_reply      boolean NOT NULL DEFAULT true,
  on_new_lead        boolean NOT NULL DEFAULT true,
  on_auction_activity boolean NOT NULL DEFAULT true,
  quiet_enabled      boolean NOT NULL DEFAULT false,
  quiet_start_local  time   NOT NULL DEFAULT '22:00',
  quiet_end_local    time   NOT NULL DEFAULT '07:00',
  timezone           text   NOT NULL DEFAULT 'UTC',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own preferences"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Notifications inbox (in-app)
-- ============================================================
CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('lead_reply','new_lead','auction_activity')),
  title       text NOT NULL,
  body        text,
  link        text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Realtime for the bell
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- Quiet hours helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_in_quiet_hours(_pref public.notification_preferences)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  local_now time;
BEGIN
  IF NOT _pref.quiet_enabled THEN RETURN false; END IF;
  BEGIN
    local_now := (now() AT TIME ZONE _pref.timezone)::time;
  EXCEPTION WHEN OTHERS THEN
    local_now := (now() AT TIME ZONE 'UTC')::time;
  END;

  IF _pref.quiet_start_local = _pref.quiet_end_local THEN
    RETURN false;
  ELSIF _pref.quiet_start_local < _pref.quiet_end_local THEN
    RETURN local_now >= _pref.quiet_start_local AND local_now < _pref.quiet_end_local;
  ELSE
    -- Window wraps over midnight (e.g. 22:00 -> 07:00)
    RETURN local_now >= _pref.quiet_start_local OR local_now < _pref.quiet_end_local;
  END IF;
END;
$$;

-- ============================================================
-- Dispatcher: write in-app row + queue SMS via pg_net (best-effort)
-- ============================================================
CREATE OR REPLACE FUNCTION public.dispatch_notification(
  _user_id uuid,
  _type    text,
  _title   text,
  _body    text,
  _link    text,
  _metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pref    public.notification_preferences%ROWTYPE;
  send_url text;
  hook_secret text;
  event_allowed boolean;
BEGIN
  SELECT * INTO pref FROM public.notification_preferences WHERE user_id = _user_id;

  -- Sensible defaults if the user hasn't configured prefs yet
  IF NOT FOUND THEN
    pref.channel_in_app     := true;
    pref.channel_sms        := false;
    pref.on_lead_reply      := true;
    pref.on_new_lead        := true;
    pref.on_auction_activity := true;
    pref.quiet_enabled      := false;
  END IF;

  event_allowed := CASE _type
    WHEN 'lead_reply'        THEN pref.on_lead_reply
    WHEN 'new_lead'          THEN pref.on_new_lead
    WHEN 'auction_activity'  THEN pref.on_auction_activity
    ELSE true
  END;

  IF NOT event_allowed THEN RETURN; END IF;

  IF pref.channel_in_app THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (_user_id, _type, _title, _body, _link, COALESCE(_metadata, '{}'::jsonb));
  END IF;

  -- SMS dispatch (best-effort, ignore failures)
  IF pref.channel_sms
     AND pref.sms_phone IS NOT NULL
     AND length(pref.sms_phone) > 0
     AND NOT public.is_in_quiet_hours(pref)
  THEN
    BEGIN
      SELECT decrypted_secret INTO send_url
      FROM vault.decrypted_secrets WHERE name = 'project_url';
    EXCEPTION WHEN OTHERS THEN
      send_url := NULL;
    END;
    BEGIN
      SELECT decrypted_secret INTO hook_secret
      FROM vault.decrypted_secrets WHERE name = 'notify_hook_secret';
    EXCEPTION WHEN OTHERS THEN
      hook_secret := NULL;
    END;

    IF send_url IS NOT NULL AND hook_secret IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := send_url || '/api/public/hooks/notify-sms',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-notify-secret', hook_secret
          ),
          body := jsonb_build_object(
            'user_id', _user_id,
            'phone',   pref.sms_phone,
            'title',   _title,
            'body',    _body,
            'type',    _type
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- swallow; in-app row already written
        NULL;
      END;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- Trigger 1: inbound outreach reply
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_inbound_outreach()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preview text;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  preview := COALESCE(NEW.body, '');
  IF length(preview) > 140 THEN preview := substring(preview from 1 for 140) || '…'; END IF;
  PERFORM public.dispatch_notification(
    NEW.user_id,
    'lead_reply',
    'New reply via ' || COALESCE(NEW.channel, 'message'),
    preview,
    '/app/outreach',
    jsonb_build_object('outreach_id', NEW.id, 'owner_id', NEW.owner_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER outreach_messages_notify_inbound
  AFTER INSERT ON public.outreach_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_inbound_outreach();

-- ============================================================
-- Trigger 2: new website lead -> notify every admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
BEGIN
  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    PERFORM public.dispatch_notification(
      admin_id,
      'new_lead',
      'New website lead: ' || NEW.full_name,
      COALESCE(NEW.message, NEW.email),
      '/app/leads/' || NEW.id,
      jsonb_build_object('lead_id', NEW.id, 'source', NEW.source)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_notify_new
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_lead();

-- ============================================================
-- Trigger 3a: new bid -> alert auction owner + outbid prior leader
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_new_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_user uuid;
  a_title text;
  prev_top uuid;
BEGIN
  SELECT user_id, title INTO a_user, a_title
  FROM public.auctions WHERE id = NEW.auction_id;

  IF a_user IS NOT NULL AND a_user <> NEW.bidder_id THEN
    PERFORM public.dispatch_notification(
      a_user,
      'auction_activity',
      'New bid on "' || COALESCE(a_title, 'your auction') || '"',
      '$' || NEW.amount::text || ' just placed',
      '/app/auctions/' || NEW.auction_id,
      jsonb_build_object('auction_id', NEW.auction_id, 'amount', NEW.amount)
    );
  END IF;

  -- Outbid previous leader
  SELECT bidder_id INTO prev_top
  FROM public.bids
  WHERE auction_id = NEW.auction_id AND id <> NEW.id
  ORDER BY amount DESC, created_at ASC
  LIMIT 1;

  IF prev_top IS NOT NULL AND prev_top <> NEW.bidder_id THEN
    PERFORM public.dispatch_notification(
      prev_top,
      'auction_activity',
      'You were outbid on "' || COALESCE(a_title, 'an auction') || '"',
      'New high bid: $' || NEW.amount::text,
      '/app/auctions/' || NEW.auction_id,
      jsonb_build_object('auction_id', NEW.auction_id, 'amount', NEW.amount)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bids_notify_new
  AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_bid();

-- ============================================================
-- Trigger 3b: auction closed -> alert owner + winner
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_auction_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('sold','ended','cancelled') THEN RETURN NEW; END IF;

  PERFORM public.dispatch_notification(
    NEW.user_id,
    'auction_activity',
    'Your auction "' || NEW.title || '" ' ||
      CASE NEW.status WHEN 'sold' THEN 'sold' WHEN 'ended' THEN 'ended with no winner' ELSE NEW.status END,
    CASE WHEN NEW.status = 'sold' THEN 'Final bid: $' || NEW.current_bid::text ELSE NULL END,
    '/app/auctions/' || NEW.id,
    jsonb_build_object('auction_id', NEW.id, 'status', NEW.status)
  );

  IF NEW.status = 'sold' AND NEW.winner_id IS NOT NULL AND NEW.winner_id <> NEW.user_id THEN
    PERFORM public.dispatch_notification(
      NEW.winner_id,
      'auction_activity',
      'You won "' || NEW.title || '"',
      'Winning bid: $' || NEW.current_bid::text,
      '/app/auctions/' || NEW.id,
      jsonb_build_object('auction_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auctions_notify_status
  AFTER UPDATE OF status ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.notify_auction_status_change();