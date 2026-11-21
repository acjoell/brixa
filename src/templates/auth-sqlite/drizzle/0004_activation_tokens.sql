CREATE TABLE `activation_tokens` (
	`token_digest` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "activation_tokens_digest" CHECK(typeof(token_digest) = 'text' AND length(token_digest) = 64 AND token_digest NOT GLOB '*[^0-9a-f]*' AND instr(token_digest, char(0)) = 0),
	CONSTRAINT "activation_tokens_dates" CHECK(typeof(issued_at) = 'integer' AND typeof(expires_at) = 'integer' AND (closed_at IS NULL OR typeof(closed_at) = 'integer') AND expires_at > issued_at),
	CONSTRAINT "activation_tokens_lifecycle" CHECK((status = 'open' AND closed_at IS NULL) OR
          (closed_at IS NOT NULL AND closed_at >= issued_at AND (
            (status = 'consumed' AND closed_at < expires_at) OR
            status = 'revoked' OR
            (status = 'expired' AND closed_at >= expires_at)
          )))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_tokens_open_user_idx` ON `activation_tokens` (`user_id`) WHERE status = 'open';