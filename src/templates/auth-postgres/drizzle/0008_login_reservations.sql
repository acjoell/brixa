CREATE TABLE "public"."login_identifier_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key_digest" text NOT NULL,
	"expires_at_ms" bigint NOT NULL,
	CONSTRAINT "login_reservation_digest" CHECK (length(key_digest) = 64 AND key_digest ~ '^[0-9a-f]+$'),
	CONSTRAINT "login_reservation_expiry" CHECK (expires_at_ms > 0)
);
--> statement-breakpoint
CREATE INDEX "login_reservation_identifier_idx" ON "public"."login_identifier_reservations" USING btree ("key_digest","expires_at_ms");--> statement-breakpoint
CREATE INDEX "login_reservation_expiry_idx" ON "public"."login_identifier_reservations" USING btree ("expires_at_ms","id");
--> statement-breakpoint
REVOKE ALL ON TABLE public.login_identifier_reservations FROM PUBLIC, app_exec;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE public.login_identifier_reservations TO app_exec;
