CREATE TABLE "sessions" (
	"session_token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_digest" CHECK (session_token_hash ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canonical_identifier" text NOT NULL,
	"status" text DEFAULT 'pending_activation' NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_canonical_identifier_unique" UNIQUE("canonical_identifier"),
	CONSTRAINT "users_status" CHECK (status IN ('pending_activation', 'active', 'disabled')),
	CONSTRAINT "users_identifier_nonempty" CHECK (length(trim(canonical_identifier)) > 0)
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");