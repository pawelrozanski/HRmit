CREATE TABLE `candidate_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_id` integer NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`source` text DEFAULT 'human' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `employee_notes` ADD `source` text DEFAULT 'human' NOT NULL;--> statement-breakpoint
INSERT INTO `candidate_notes` (`candidate_id`, `title`, `body`, `source`, `created_at`) SELECT `id`, NULL, `notes`, 'human', `created_at` FROM `candidates` WHERE trim(`notes`) <> '';--> statement-breakpoint
UPDATE `candidates` SET `notes` = '';