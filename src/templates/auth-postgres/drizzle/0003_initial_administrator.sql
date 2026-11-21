CREATE TABLE "public"."initial_administrator" (
	"singleton" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "initial_administrator_singleton" CHECK (singleton = 'initial')
);
--> statement-breakpoint
ALTER TABLE "public"."initial_administrator" ADD CONSTRAINT "initial_administrator_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL ON TABLE public.initial_administrator FROM PUBLIC, app_exec;
--> statement-breakpoint
GRANT SELECT ON TABLE public.initial_administrator TO app_exec;
