CREATE TABLE `sessions` (
	`session_token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	`idle_expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sessions_digest" CHECK(typeof(session_token_hash) = 'text' AND length(session_token_hash) = 64 AND session_token_hash NOT GLOB '*[^0-9a-f]*' AND instr(session_token_hash, char(0)) = 0)
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_identifier` text NOT NULL,
	`status` text DEFAULT 'pending_activation' NOT NULL,
	`password_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_status" CHECK(status IN ('pending_activation', 'active', 'disabled')),
	CONSTRAINT "users_identifier_nonempty" CHECK(typeof(canonical_identifier) = 'text' AND length(trim(canonical_identifier)) > 0),
	CONSTRAINT "users_uuid" CHECK(length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND length(replace(id, '-', '')) = 32 AND replace(id, '-', '') NOT GLOB '*[^0-9a-f]*' AND instr(id, char(0)) = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_canonical_identifier_unique` ON `users` (`canonical_identifier`);