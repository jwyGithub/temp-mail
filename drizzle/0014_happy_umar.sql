CREATE TABLE `site_config` (
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_config_key_unique` ON `site_config` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `key_unique` ON `site_config` (`key`);