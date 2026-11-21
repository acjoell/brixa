CREATE TABLE "public"."activation_tokens" (
	"token_digest" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "activation_tokens_digest" CHECK (length(token_digest) = 64 AND token_digest ~ '^[0-9a-f]+$'),
	CONSTRAINT "activation_tokens_dates" CHECK (isfinite(issued_at) AND isfinite(expires_at) AND (closed_at IS NULL OR isfinite(closed_at)) AND expires_at > issued_at),
	CONSTRAINT "activation_tokens_lifecycle" CHECK ((status = 'open' AND closed_at IS NULL) OR
          (closed_at IS NOT NULL AND closed_at >= issued_at AND (
            (status = 'consumed' AND closed_at < expires_at) OR
            status = 'revoked' OR
            (status = 'expired' AND closed_at >= expires_at)
          )))
);
--> statement-breakpoint
ALTER TABLE "public"."activation_tokens" ADD CONSTRAINT "activation_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "activation_tokens_open_user_idx" ON "public"."activation_tokens" USING btree ("user_id") WHERE status = 'open';
--> statement-breakpoint
REVOKE ALL ON TABLE public.activation_tokens FROM PUBLIC, app_exec;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE public.activation_tokens TO app_exec;
