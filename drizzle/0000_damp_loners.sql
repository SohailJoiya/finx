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
CREATE TABLE `monthly_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`month` varchar(16) NOT NULL,
	`total_investment` decimal(18,2) NOT NULL DEFAULT '0.00',
	`team_investment` decimal(18,2) NOT NULL DEFAULT '0.00',
	`achieved_tier` varchar(64),
	`reward_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
	`is_claimed` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profit_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`type` varchar(32) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`description` varchar(512),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profit_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_commissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_user_id` int,
	`to_user_id` int,
	`level` int,
	`amount` decimal(18,2),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referral_commissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wallets_binance` varchar(255) NOT NULL DEFAULT '',
	`wallets_trust` varchar(255) NOT NULL DEFAULT '',
	`about_html` text NOT NULL DEFAULT (''),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mongo_id` varchar(24) NOT NULL DEFAULT '',
	`first_name` varchar(120) NOT NULL DEFAULT '',
	`last_name` varchar(120) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(32) NOT NULL DEFAULT 'user',
	`phone` varchar(64) DEFAULT '',
	`balance` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total_profit` decimal(18,2) NOT NULL DEFAULT '0.00',
	`referral_code` varchar(64),
	`referred_by_user_id` int,
	`last_daily_claim_at` datetime,
	`last_login_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_referral_code_unique` UNIQUE(`referral_code`)
);
--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`fee` decimal(18,2) NOT NULL,
	`final_amount` decimal(18,2),
	`wallet_name` varchar(64) NOT NULL,
	`network` varchar(64) NOT NULL,
	`destination_address` varchar(255) NOT NULL,
	`receivable` decimal(18,2) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'Pending',
	`transaction_id` varchar(128),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthly_rewards` ADD CONSTRAINT `monthly_rewards_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profit_history` ADD CONSTRAINT `profit_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_commissions` ADD CONSTRAINT `referral_commissions_from_user_id_users_id_fk` FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_commissions` ADD CONSTRAINT `referral_commissions_to_user_id_users_id_fk` FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_referred_by_user_id_users_id_fk` FOREIGN KEY (`referred_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `withdrawals` ADD CONSTRAINT `withdrawals_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_deposits_user` ON `deposits` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_deposits_status` ON `deposits` (`status`);--> statement-breakpoint
CREATE INDEX `uniq_user_month` ON `monthly_rewards` (`user_id`,`month`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_profit_history_user` ON `profit_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_profit_history_type` ON `profit_history` (`type`);--> statement-breakpoint
CREATE INDEX `idx_ref_comm_to` ON `referral_commissions` (`to_user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_referral_code` ON `users` (`referral_code`);--> statement-breakpoint
CREATE INDEX `idx_withdrawals_user` ON `withdrawals` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_withdrawals_status` ON `withdrawals` (`status`);