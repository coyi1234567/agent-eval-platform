CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('qianfan','dify','n8n','custom') NOT NULL,
	`version` varchar(64) NOT NULL,
	`description` text,
	`configSnapshot` json,
	`environment` json,
	`apiEndpoint` varchar(512),
	`encryptedApiKey` text,
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `datasets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` varchar(64) NOT NULL,
	`description` text,
	`type` enum('accuracy','robustness','tool_calling','performance','security','rag') NOT NULL,
	`caseCount` int NOT NULL DEFAULT 0,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `datasets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eval_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`agentId` int NOT NULL,
	`accuracy` int,
	`consistency` int,
	`robustness` int,
	`toolCallingAccuracy` int,
	`toolCallingEfficiency` int,
	`latencyP50` int,
	`latencyP95` int,
	`throughput` int,
	`avgTokenCost` int,
	`securityScore` int,
	`promptInjectionResistance` int,
	`faithfulness` int,
	`answerRelevancy` int,
	`contextRecall` int,
	`contextPrecision` int,
	`overallScore` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eval_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eval_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`summary` text,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`generatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eval_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eval_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`agentId` int NOT NULL,
	`datasetId` int NOT NULL,
	`testCaseId` int NOT NULL,
	`actualOutput` text,
	`passed` boolean NOT NULL DEFAULT false,
	`scores` json,
	`latencyMs` int,
	`tokenUsage` json,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eval_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eval_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`agentIds` json NOT NULL,
	`datasetIds` json NOT NULL,
	`config` json,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eval_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`input` text NOT NULL,
	`expectedOutput` text,
	`context` json,
	`metadata` json,
	`caseType` enum('single_turn','multi_turn','tool_call','rag_query') NOT NULL DEFAULT 'single_turn',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `traces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resultId` int NOT NULL,
	`traceData` json NOT NULL,
	`input` text,
	`context` json,
	`retrievalResults` json,
	`toolCalls` json,
	`modelOutput` text,
	`intermediateSteps` json,
	`errorStack` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `traces_id` PRIMARY KEY(`id`)
);
