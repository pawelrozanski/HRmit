CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`position` text NOT NULL,
	`email` text NOT NULL,
	`hired_at` text,
	`duties` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	PRIMARY KEY(`team_id`, `employee_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (lower("name"));--> statement-breakpoint
ALTER TABLE `jobs` ADD `team_id` integer REFERENCES teams(id) ON DELETE SET NULL;