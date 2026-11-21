CREATE TABLE `login_identifier_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`key_digest` text NOT NULL,
	`expires_at_ms` integer NOT NULL,
	CONSTRAINT "login_reservation_digest" CHECK(typeof(key_digest) = 'text' AND length(key_digest) = 64 AND key_digest NOT GLOB '*[^0-9a-f]*' AND instr(key_digest, char(0)) = 0),
	CONSTRAINT "login_reservation_expiry" CHECK(typeof(expires_at_ms) = 'integer' AND expires_at_ms > 0)
);
--> statement-breakpoint
CREATE INDEX `login_reservation_identifier_idx` ON `login_identifier_reservations` (`key_digest`,`expires_at_ms`);--> statement-breakpoint
CREATE INDEX `login_reservation_expiry_idx` ON `login_identifier_reservations` (`expires_at_ms`,`id`);