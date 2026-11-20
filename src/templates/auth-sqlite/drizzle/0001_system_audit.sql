CREATE TABLE `audit_log_system` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`actor_id` text,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_system_event" CHECK(event IN ('login_succeeded','login_failed','logout','account_activated','password_changed','brute_force_detected','user_created','user_disabled','bootstrap','activation_token_issued','activation_token_consumed','activation_token_revoked','activation_token_expired')),
	CONSTRAINT "audit_system_correlation" CHECK(typeof(request_id) = 'text' AND length(request_id) BETWEEN 1 AND 128 AND request_id NOT GLOB '*[^A-Za-z0-9._:-]*' AND instr(request_id,char(0)) = 0)
);
--> statement-breakpoint
CREATE INDEX `audit_system_request_idx` ON `audit_log_system` (`request_id`);--> statement-breakpoint
CREATE INDEX `audit_system_time_idx` ON `audit_log_system` (`created_at`);