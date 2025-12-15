import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  projects, InsertProject, Project,
  projectMembers, InsertProjectMember,
  agents, InsertAgent, Agent,
  datasets, InsertDataset, Dataset,
  testCases, InsertTestCase, TestCase,
  evalTasks, InsertEvalTask, EvalTask,
  evalResults, InsertEvalResult, EvalResult,
  traces, InsertTrace, Trace,
  evalMetrics, InsertEvalMetric, EvalMetric,
  evalReports, InsertEvalReport, EvalReport,
  auditLogs, InsertAuditLog,
  modelPricing, InsertModelPricing,
  costStats, InsertCostStat
} from "../drizzle/schema";
import { ENV } from './_core/env';
import * as crypto from 'crypto';

let _db: ReturnType<typeof drizzle> | null = null;

// 加密密钥（生产环境应从环境变量获取）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!';
const IV_LENGTH = 16;

// 加密函数
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 解密函数
export function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// 脱敏显示 API Key
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '****';
  return apiKey.slice(0, 4) + '****' + apiKey.slice(-4);
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== 用户相关 ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== 项目相关 ====================
export async function createProject(data: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  const id = Number(result[0].insertId);
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  return project;
}

export async function getProjectsByUser(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  // 获取用户拥有的项目或作为成员的项目
  const ownedProjects = await db.select().from(projects).where(eq(projects.ownerId, userId));
  const memberProjects = await db.select({ project: projects })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));
  const allProjects = [...ownedProjects, ...memberProjects.map(m => m.project)];
  // 去重
  const uniqueProjects = Array.from(new Map(allProjects.map(p => [p.id, p])).values());
  return uniqueProjects;
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  return project;
}

export async function updateProject(id: number, data: Partial<InsertProject>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects).set(data).where(eq(projects.id, id));
}

// ==================== 项目成员相关 ====================
export async function addProjectMember(data: InsertProjectMember): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(projectMembers).values(data);
}

export async function getProjectMembers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({ member: projectMembers, user: users })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
}

export async function getUserProjectRole(projectId: number, userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  // 检查是否为项目所有者
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (project?.ownerId === userId) return 'admin';
  // 检查成员角色
  const [member] = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  return member?.role || null;
}

// ==================== 智能体相关 ====================
export async function createAgent(data: InsertAgent): Promise<Agent> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 加密 API Key
  if (data.encryptedApiKey) {
    data.encryptedApiKey = encrypt(data.encryptedApiKey);
  }
  const result = await db.insert(agents).values(data);
  const id = Number(result[0].insertId);
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  return agent;
}

export async function getAgentsByProject(projectId: number): Promise<Agent[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(agents)
    .where(eq(agents.projectId, projectId))
    .orderBy(desc(agents.createdAt));
}

export async function getAllAgents(): Promise<Agent[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(agents)
    .orderBy(desc(agents.createdAt));
}

export async function getAgentById(id: number): Promise<Agent | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  return agent;
}

export async function updateAgent(id: number, data: Partial<InsertAgent>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.encryptedApiKey) {
    data.encryptedApiKey = encrypt(data.encryptedApiKey);
  }
  await db.update(agents).set(data).where(eq(agents.id, id));
}

export async function setBaselineAgent(projectId: number, agentId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 先取消所有基线
  await db.update(agents).set({ isBaseline: false }).where(eq(agents.projectId, projectId));
  // 设置新基线
  await db.update(agents).set({ isBaseline: true }).where(eq(agents.id, agentId));
  await db.update(projects).set({ baselineAgentId: agentId }).where(eq(projects.id, projectId));
}

// ==================== 测试集相关 ====================
export async function createDataset(data: InsertDataset): Promise<Dataset> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(datasets).values(data);
  const id = Number(result[0].insertId);
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id));
  return dataset;
}

export async function getDatasetsByProject(projectId: number): Promise<Dataset[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(datasets)
    .where(eq(datasets.projectId, projectId))
    .orderBy(desc(datasets.createdAt));
}

export async function getDatasetById(id: number): Promise<Dataset | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id));
  return dataset;
}

export async function updateDatasetCaseCount(datasetId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(testCases)
    .where(eq(testCases.datasetId, datasetId));
  await db.update(datasets).set({ caseCount: result.count }).where(eq(datasets.id, datasetId));
}

// ==================== 测试用例相关 ====================
export async function createTestCase(data: InsertTestCase): Promise<TestCase> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(testCases).values(data);
  const id = Number(result[0].insertId);
  const [testCase] = await db.select().from(testCases).where(eq(testCases.id, id));
  await updateDatasetCaseCount(data.datasetId);
  return testCase;
}

export async function createTestCasesBatch(dataList: InsertTestCase[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (dataList.length === 0) return;
  await db.insert(testCases).values(dataList);
  // 更新各数据集的用例数量
  const datasetIds = Array.from(new Set(dataList.map(d => d.datasetId)));
  for (const datasetId of datasetIds) {
    await updateDatasetCaseCount(datasetId);
  }
}

export async function getTestCasesByDataset(datasetId: number): Promise<TestCase[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(testCases).where(eq(testCases.datasetId, datasetId));
}

// ==================== 评测任务相关 ====================
export async function createEvalTask(data: InsertEvalTask): Promise<EvalTask> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(evalTasks).values(data);
  const id = Number(result[0].insertId);
  const [task] = await db.select().from(evalTasks).where(eq(evalTasks.id, id));
  return task;
}

export async function getEvalTasksByProject(projectId: number): Promise<EvalTask[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(evalTasks)
    .where(eq(evalTasks.projectId, projectId))
    .orderBy(desc(evalTasks.createdAt));
}

export async function getEvalTaskById(id: number): Promise<EvalTask | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [task] = await db.select().from(evalTasks).where(eq(evalTasks.id, id));
  return task;
}

export async function updateEvalTask(id: number, data: Partial<InsertEvalTask>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(evalTasks).set(data).where(eq(evalTasks.id, id));
}

// ==================== 评测结果相关 ====================
export async function createEvalResult(data: InsertEvalResult): Promise<EvalResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(evalResults).values(data);
  const id = Number(result[0].insertId);
  const [evalResult] = await db.select().from(evalResults).where(eq(evalResults.id, id));
  return evalResult;
}

export async function getEvalResultsByTask(taskId: number): Promise<EvalResult[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(evalResults).where(eq(evalResults.taskId, taskId));
}

export async function getEvalResultById(id: number): Promise<EvalResult | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [result] = await db.select().from(evalResults).where(eq(evalResults.id, id));
  return result;
}

// ==================== Trace 相关 ====================
export async function createTrace(data: InsertTrace): Promise<Trace> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(traces).values(data);
  const id = Number(result[0].insertId);
  const [trace] = await db.select().from(traces).where(eq(traces.id, id));
  return trace;
}

export async function getTraceByResultId(resultId: number): Promise<Trace | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [trace] = await db.select().from(traces).where(eq(traces.resultId, resultId));
  return trace;
}

// ==================== 评测指标相关 ====================
export async function createEvalMetric(data: InsertEvalMetric): Promise<EvalMetric> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(evalMetrics).values(data);
  const id = Number(result[0].insertId);
  const [metric] = await db.select().from(evalMetrics).where(eq(evalMetrics.id, id));
  return metric;
}

export async function getEvalMetricsByTask(taskId: number): Promise<EvalMetric[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(evalMetrics).where(eq(evalMetrics.taskId, taskId));
}

export async function getLeaderboard(projectId: number, limit: number = 20): Promise<EvalMetric[]> {
  const db = await getDb();
  if (!db) return [];
  // 获取项目下所有任务的最新指标，按综合得分排序
  const taskIds = await db.select({ id: evalTasks.id })
    .from(evalTasks)
    .where(eq(evalTasks.projectId, projectId));
  if (taskIds.length === 0) return [];
  return await db.select().from(evalMetrics)
    .where(inArray(evalMetrics.taskId, taskIds.map(t => t.id)))
    .orderBy(desc(evalMetrics.overallScore))
    .limit(limit);
}

// ==================== 评测报告相关 ====================
export async function createEvalReport(data: InsertEvalReport): Promise<EvalReport> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(evalReports).values(data);
  const id = Number(result[0].insertId);
  const [report] = await db.select().from(evalReports).where(eq(evalReports.id, id));
  return report;
}

export async function getEvalReportsByTask(taskId: number): Promise<EvalReport[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(evalReports)
    .where(eq(evalReports.taskId, taskId))
    .orderBy(desc(evalReports.createdAt));
}

export async function updateEvalReport(id: number, data: Partial<InsertEvalReport>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(evalReports).set(data).where(eq(evalReports.id, id));
}

// ==================== 审计日志相关 ====================
export async function createAuditLog(data: InsertAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(projectId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auditLogs)
    .where(eq(auditLogs.projectId, projectId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ==================== 模型价格配置相关 ====================
export async function createModelPricing(data: InsertModelPricing): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(modelPricing).values(data);
}

export async function getModelPricingByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(modelPricing).where(eq(modelPricing.projectId, projectId));
}

export async function getModelPricing(projectId: number, modelId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [pricing] = await db.select().from(modelPricing)
    .where(and(eq(modelPricing.projectId, projectId), eq(modelPricing.modelId, modelId)));
  return pricing;
}

// ==================== 成本统计相关 ====================
export async function createCostStat(data: InsertCostStat): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(costStats).values(data);
}

export async function getCostStatsByTask(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(costStats).where(eq(costStats.taskId, taskId));
}

// ==================== 统计查询 ====================
export async function getProjectStats(projectId: number) {
  const db = await getDb();
  if (!db) return { agents: 0, datasets: 0, tasks: 0, completedTasks: 0 };
  
  const [agentCount] = await db.select({ count: sql<number>`count(*)` })
    .from(agents).where(eq(agents.projectId, projectId));
  const [datasetCount] = await db.select({ count: sql<number>`count(*)` })
    .from(datasets).where(eq(datasets.projectId, projectId));
  const [taskCount] = await db.select({ count: sql<number>`count(*)` })
    .from(evalTasks).where(eq(evalTasks.projectId, projectId));
  const [completedTaskCount] = await db.select({ count: sql<number>`count(*)` })
    .from(evalTasks).where(and(eq(evalTasks.projectId, projectId), eq(evalTasks.status, 'completed')));
  
  return {
    agents: agentCount.count,
    datasets: datasetCount.count,
    tasks: taskCount.count,
    completedTasks: completedTaskCount.count
  };
}
