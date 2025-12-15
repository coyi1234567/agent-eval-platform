CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`action` varchar(64) NOT NULL,
	`targetType` varchar(64),
	`targetId` int,
	`details` json,
	`ipAddress` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cost_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`agentId` int NOT NULL,
	`totalCalls` int NOT NULL DEFAULT 0,
	`totalInputTokens` int NOT NULL DEFAULT 0,
	`totalOutputTokens` int NOT NULL DEFAULT 0,
	`totalCostCents` int NOT NULL DEFAULT 0,
	`avgCostPerCall` int NOT NULL DEFAULT 0,
	`suggestedPrice` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`modelId` varchar(128) NOT NULL,
	`modelName` varchar(255) NOT NULL,
	`inputPricePerMillion` int NOT NULL,
	`outputPricePerMillion` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'CNY',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_pricing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','evaluator','viewer') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `modelParams` json;--> statement-breakpoint
ALTER TABLE `agents` ADD `isBaseline` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `eval_metrics` ADD `baselineDiff` int;--> statement-breakpoint
ALTER TABLE `eval_metrics` ADD `hasAlert` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `eval_metrics` ADD `alertMessage` text;--> statement-breakpoint
ALTER TABLE `eval_results` ADD `costCents` int;--> statement-breakpoint
ALTER TABLE `eval_tasks` ADD `isBaselineComparison` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `eval_tasks` ADD `baselineTaskId` int;--> statement-breakpoint
ALTER TABLE `projects` ADD `baselineAgentId` int;--> statement-breakpoint
ALTER TABLE `projects` ADD `alertThresholds` json;