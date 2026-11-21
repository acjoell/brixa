CREATE TABLE `login_abuse_counters` (
	`key_digest` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at_ms` integer NOT NULL,
	CONSTRAINT "login_abuse_digest" CHECK(typeof(key_digest) = 'text' AND length(key_digest) = 64 AND key_digest NOT GLOB '*[^0-9a-f]*' AND instr(key_digest, char(0)) = 0),
	CONSTRAINT "login_abuse_window" CHECK(hits >= 0 AND expires_at_ms >= 0 AND typeof(hits) = 'integer' AND typeof(expires_at_ms) = 'integer')
);
--> statement-breakpoint
CREATE INDEX `login_abuse_expiry_idx` ON `login_abuse_counters` (`expires_at_ms`,`key_digest`);