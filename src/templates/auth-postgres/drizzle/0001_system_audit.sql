CREATE TABLE "audit_log_system" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"actor_id" uuid,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "audit_system_event" CHECK (event IN ('login_succeeded','login_failed','logout','account_activated','password_changed','brute_force_detected','user_created','user_disabled','bootstrap','activation_token_issued','activation_token_consumed','activation_token_revoked','activation_token_expired')),
	CONSTRAINT "audit_system_correlation" CHECK (request_id ~ '^[A-Za-z0-9._:-]{1,128}$')
);
--> statement-breakpoint
ALTER TABLE "audit_log_system" ADD CONSTRAINT "audit_log_system_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_system_request_idx" ON "audit_log_system" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_system_time_idx" ON "audit_log_system" USING btree ("created_at");