ALTER TABLE `jobs` ADD `level` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `contract` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `requirements` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `nice_to_have` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_min` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_max` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_currency` text DEFAULT 'PLN' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_period` text DEFAULT 'month' NOT NULL;