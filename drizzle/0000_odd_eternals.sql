CREATE TABLE `deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`transaction_id` varchar(128),
	`screenshot` varchar(512) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'Pending',
	`admin_reason` varchar(512) NOT NULL DEFAULT '',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deposits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_deposits_user` ON `deposits` (`user_id`);