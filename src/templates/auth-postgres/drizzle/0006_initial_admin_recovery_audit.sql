ALTER TABLE "public"."audit_log_system"
  DROP CONSTRAINT "audit_system_event",
  ADD CONSTRAINT "audit_system_event" CHECK (event IN ('login_succeeded','login_failed','logout','account_activated','password_changed','brute_force_detected','user_created','user_disabled','bootstrap','activation_token_issued','activation_token_consumed','activation_token_revoked','activation_token_expired','platform_admin_access_denied','initial_admin_password_recovered'));
