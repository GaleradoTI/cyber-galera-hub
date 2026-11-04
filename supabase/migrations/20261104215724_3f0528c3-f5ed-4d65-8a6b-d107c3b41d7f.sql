REVOKE EXECUTE ON FUNCTION public.log_ambassador_permission_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.apply_notification_preferences() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_job_published() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_event_published() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.send_event_reminders() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_ambassador_permission(uuid, text) FROM anon;
GRANT SELECT ON public.event_reminders_sent TO authenticated;
CREATE POLICY "Admins read reminders log" ON public.event_reminders_sent FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));