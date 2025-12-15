import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

// ==================== 用户表 ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== 项目/租户表 ====================
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: int("ownerId").notNull(),
  // 基线版本配置
  baselineAgentId: int("baselineAgentId"),
  // 告警阈值配置（JSON）
  alertThresholds: json("alertThresholds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ==================== 项目成员表（RBAC）====================
export const projectMembers = mysqlTable("project_members", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  // 角色：管理员/评测员/只读
  role: mysqlEnum("role", ["admin", "evaluator", "viewer"]).default("viewer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

// ==================== 智能体表 ====================
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["qianfan", "dify", "n8n", "custom"]).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  description: text("description"),
  // 配置快照（JSON 存储 prompt/工具/知识库版本/模型版本）
  configSnapshot: json("configSnapshot"),
  // 模型参数（用于可复现评测）
  modelParams: json("modelParams"), // {model_id, temperature, top_p, max_tokens, seed}
  // 环境信息
  environment: json("environment"),
  // API 端点
  apiEndpoint: varchar("apiEndpoint", { length: 512 }),
  // 密钥（加密存储）
  encryptedApiKey: text("encryptedApiKey"),
  // 是否为基线版本
  isBaseline: boolean("isBaseline").default(false).notNull(),
  // 状态
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

// ==================== 测试集表 ====================
export const datasets = mysqlTable("datasets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  description: text("description"),
  // 测试集类型
  type: mysqlEnum("type", ["accuracy", "robustness", "tool_calling", "performance", "security", "rag"]).notNull(),
  // 测试用例数量
  caseCount: int("caseCount").default(0).notNull(),
  // 标签
  tags: json("tags"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;

// ==================== 测试用例表 ====================
export const testCases = mysqlTable("test_cases", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull(),
  // 用例输入
  input: text("input").notNull(),
  // 期望输出（可选，用于准确性评测）
  expectedOutput: text("expectedOutput"),
  // 上下文（用于多轮对话）
  context: json("context"),
  // 元数据（标签、难度等）
  metadata: json("metadata"),
  // 用例类型
  caseType: mysqlEnum("caseType", ["single_turn", "multi_turn", "tool_call", "rag_query"]).default("single_turn").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TestCase = typeof testCases.$inferSelect;
export type InsertTestCase = typeof testCases.$inferInsert;

// ==================== 评测任务表 ====================
export const evalTasks = mysqlTable("eval_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // 关联的智能体（可多个）
  agentIds: json("agentIds").notNull(),
  // 关联的测试集（可多个）
  datasetIds: json("datasetIds").notNull(),
  // 评测配置（包含模型参数快照用于可复现）
  config: json("config"),
  // 任务状态
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending").notNull(),
  // 进度（0-100）
  progress: int("progress").default(0).notNull(),
  // 是否为基线对比任务
  isBaselineComparison: boolean("isBaselineComparison").default(false).notNull(),
  // 基线任务ID（用于对比）
  baselineTaskId: int("baselineTaskId"),
  // 开始时间
  startedAt: timestamp("startedAt"),
  // 完成时间
  completedAt: timestamp("completedAt"),
  // 创建者
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EvalTask = typeof evalTasks.$inferSelect;
export type InsertEvalTask = typeof evalTasks.$inferInsert;

// ==================== 评测结果表 ====================
export const evalResults = mysqlTable("eval_results", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  agentId: int("agentId").notNull(),
  datasetId: int("datasetId").notNull(),
  testCaseId: int("testCaseId").notNull(),
  // 实际输出
  actualOutput: text("actualOutput"),
  // 是否通过
  passed: boolean("passed").default(false).notNull(),
  // 各维度得分（JSON 存储）
  scores: json("scores"),
  // 延迟（毫秒）
  latencyMs: int("latencyMs"),
  // Token 使用量
  tokenUsage: json("tokenUsage"), // {input_tokens, output_tokens, total_tokens}
  // 成本（分，避免浮点数）
  costCents: int("costCents"),
  // 错误信息
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvalResult = typeof evalResults.$inferSelect;
export type InsertEvalResult = typeof evalResults.$inferInsert;

// ==================== Trace 轨迹表 ====================
export const traces = mysqlTable("traces", {
  id: int("id").autoincrement().primaryKey(),
  resultId: int("resultId").notNull(),
  // 完整轨迹数据（JSON 存储）
  traceData: json("traceData").notNull(),
  // 输入
  input: text("input"),
  // 上下文
  context: json("context"),
  // 检索结果（RAG 场景）
  retrievalResults: json("retrievalResults"),
  // 工具调用记录
  toolCalls: json("toolCalls"),
  // 模型输出
  modelOutput: text("modelOutput"),
  // 中间步骤
  intermediateSteps: json("intermediateSteps"),
  // 错误栈
  errorStack: text("errorStack"),
  // 重试次数
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trace = typeof traces.$inferSelect;
export type InsertTrace = typeof traces.$inferInsert;

// ==================== 评测指标汇总表 ====================
export const evalMetrics = mysqlTable("eval_metrics", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  agentId: int("agentId").notNull(),
  // 准确性指标
  accuracy: int("accuracy"), // 百分比 * 100
  consistency: int("consistency"),
  // 鲁棒性指标
  robustness: int("robustness"),
  // 工具调用能力
  toolCallingAccuracy: int("toolCallingAccuracy"),
  toolCallingEfficiency: int("toolCallingEfficiency"),
  // 性能指标
  latencyP50: int("latencyP50"), // 毫秒
  latencyP95: int("latencyP95"),
  throughput: int("throughput"), // 每分钟请求数
  avgTokenCost: int("avgTokenCost"),
  // 安全性指标
  securityScore: int("securityScore"),
  promptInjectionResistance: int("promptInjectionResistance"),
  // RAG 指标
  faithfulness: int("faithfulness"),
  answerRelevancy: int("answerRelevancy"),
  contextRecall: int("contextRecall"),
  contextPrecision: int("contextPrecision"),
  // 综合得分
  overallScore: int("overallScore"),
  // 与基线对比的变化（百分比 * 100，正数为提升，负数为下降）
  baselineDiff: int("baselineDiff"),
  // 是否触发告警
  hasAlert: boolean("hasAlert").default(false).notNull(),
  alertMessage: text("alertMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvalMetric = typeof evalMetrics.$inferSelect;
export type InsertEvalMetric = typeof evalMetrics.$inferInsert;

// ==================== 评测报告表 ====================
export const evalReports = mysqlTable("eval_reports", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  // 报告内容（HTML 格式）
  content: text("content"),
  // 报告摘要
  summary: text("summary"),
  // 报告状态
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  // 生成者
  generatedBy: int("generatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EvalReport = typeof evalReports.$inferSelect;
export type InsertEvalReport = typeof evalReports.$inferInsert;

// ==================== 审计日志表 ====================
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  // 操作类型
  action: varchar("action", { length: 64 }).notNull(), // create_agent, run_eval, export_report, etc.
  // 操作目标类型
  targetType: varchar("targetType", { length: 64 }), // agent, dataset, task, report
  // 操作目标ID
  targetId: int("targetId"),
  // 操作详情（JSON）
  details: json("details"),
  // IP 地址
  ipAddress: varchar("ipAddress", { length: 64 }),
  // User Agent
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ==================== 模型价格配置表 ====================
export const modelPricing = mysqlTable("model_pricing", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  modelId: varchar("modelId", { length: 128 }).notNull(),
  modelName: varchar("modelName", { length: 255 }).notNull(),
  // 输入价格（每百万 token，单位：分）
  inputPricePerMillion: int("inputPricePerMillion").notNull(),
  // 输出价格（每百万 token，单位：分）
  outputPricePerMillion: int("outputPricePerMillion").notNull(),
  // 货币
  currency: varchar("currency", { length: 8 }).default("CNY").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModelPricing = typeof modelPricing.$inferSelect;
export type InsertModelPricing = typeof modelPricing.$inferInsert;

// ==================== 成本统计表 ====================
export const costStats = mysqlTable("cost_stats", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  agentId: int("agentId").notNull(),
  // 总调用次数
  totalCalls: int("totalCalls").default(0).notNull(),
  // 总输入 token
  totalInputTokens: int("totalInputTokens").default(0).notNull(),
  // 总输出 token
  totalOutputTokens: int("totalOutputTokens").default(0).notNull(),
  // 总成本（分）
  totalCostCents: int("totalCostCents").default(0).notNull(),
  // 平均每次调用成本（分）
  avgCostPerCall: int("avgCostPerCall").default(0).notNull(),
  // 建议收费（分）- 基于成本 + 毛利
  suggestedPrice: int("suggestedPrice").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CostStat = typeof costStats.$inferSelect;
export type InsertCostStat = typeof costStats.$inferInsert;
