CREATE TABLE IF NOT EXISTS `project_state` (
	`project_id` text PRIMARY KEY NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
	`state_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
