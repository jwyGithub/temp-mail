CREATE TABLE `site_config` (
	`id` text PRIMARY KEY NOT NULL,
	`default_role` text DEFAULT 'civilian' NOT NULL,
	`email_domains` text DEFAULT '' NOT NULL,
	`admin_contacts` text DEFAULT '' NOT NULL,
	`max_emails` integer DEFAULT 30 NOT NULL
);
