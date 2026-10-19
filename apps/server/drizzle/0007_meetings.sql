CREATE TABLE `meetings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_id` integer NOT NULL,
	`starts_at` text NOT NULL,
	`duration_min` integer NOT NULL,
	`jitsi_url` text NOT NULL,
	`email_id` integer,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE set null
);
