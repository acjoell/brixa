CREATE TABLE "public"."login_abuse_counters" (
	"key_digest" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"expires_at_ms" bigint NOT NULL,
	CONSTRAINT "login_abuse_digest" CHECK (length(key_digest) = 64 AND key_digest ~ '^[0-9a-f]+$'),
	CONSTRAINT "login_abuse_window" CHECK (hits >= 0 AND expires_at_ms >= 0)
);
--> statement-breakpoint
CREATE INDEX "login_abuse_expiry_idx" ON "public"."login_abuse_counters" USING btree ("expires_at_ms","key_digest");
--> statement-breakpoint
REVOKE ALL ON TABLE public.login_abuse_counters FROM PUBLIC, app_exec;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.login_abuse_counters TO app_exec;
