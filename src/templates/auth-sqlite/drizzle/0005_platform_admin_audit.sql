-- WITHOUT ROWID deja id como única clave de conflicto, incluso para REPLACE.
CREATE TABLE `audit_log_system_0005` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`actor_id` text,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_system_event" CHECK(event IN ('login_succeeded','login_failed','logout','account_activated','password_changed','brute_force_detected','user_created','user_disabled','bootstrap','activation_token_issued','activation_token_consumed','activation_token_revoked','activation_token_expired','platform_admin_access_denied')),
	CONSTRAINT "audit_system_correlation" CHECK(typeof(request_id) = 'text' AND length(request_id) BETWEEN 1 AND 128 AND request_id NOT GLOB '*[^A-Za-z0-9._:-]*' AND instr(request_id,char(0)) = 0)
) WITHOUT ROWID;
--> statement-breakpoint
INSERT INTO audit_log_system_0005 (id, event, actor_id, request_id, created_at)
SELECT id, event, actor_id, request_id, created_at FROM audit_log_system;
--> statement-breakpoint
DROP TABLE audit_log_system;
--> statement-breakpoint
ALTER TABLE audit_log_system_0005 RENAME TO audit_log_system;
--> statement-breakpoint
CREATE INDEX `audit_system_request_idx` ON `audit_log_system` (`request_id`);
--> statement-breakpoint
CREATE INDEX `audit_system_time_idx` ON `audit_log_system` (`created_at`);
--> statement-breakpoint
CREATE TRIGGER audit_system_no_update BEFORE UPDATE ON audit_log_system
BEGIN
  SELECT RAISE(ABORT, 'audit_log_system is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER audit_system_no_delete BEFORE DELETE ON audit_log_system
BEGIN
  SELECT RAISE(ABORT, 'audit_log_system is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER audit_system_no_replace BEFORE INSERT ON audit_log_system
WHEN EXISTS (SELECT 1 FROM audit_log_system WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'audit_log_system is append-only');
END;
