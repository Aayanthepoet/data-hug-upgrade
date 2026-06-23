REVOKE EXECUTE ON FUNCTION public.dispatch_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_in_quiet_hours(public.notification_preferences) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_inbound_outreach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_bid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_auction_status_change() FROM PUBLIC, anon, authenticated;