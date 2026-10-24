ALTER TABLE `email_templates` ADD `built_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `email_templates` ADD `name` text;--> statement-breakpoint
ALTER TABLE `email_templates` ADD `description` text;--> statement-breakpoint
CREATE UNIQUE INDEX `email_templates_name_unique` ON `email_templates` (`name`);--> statement-breakpoint
UPDATE `email_templates` SET `built_in` = 1 WHERE `key` IN ('invite', 'reminder', 'rejection');
