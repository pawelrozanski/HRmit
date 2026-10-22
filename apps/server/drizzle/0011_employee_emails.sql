CREATE TABLE `employee_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`team_id` integer,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
