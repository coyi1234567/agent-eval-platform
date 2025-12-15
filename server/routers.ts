import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { startEvaluation, EvalConfig } from "./evaluator";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

// 管理员权限检查
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理员权限' });
  }
  return next({ ctx });
});

// 项目权限检查
const projectProcedure = protectedProcedure.input(z.object({ projectId: z.number() })).use(async ({ ctx, input, next }) => {
  const role = await db.getUserProjectRole(input.projectId, ctx.user.id);
  if (!role) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问此项目' });
  }
  return next({ ctx: { ...ctx, projectRole: role } });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    // 本地登录 (仅在 AUTH_MODE=local 时可用)
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ENV.authMode !== 'local') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not in local auth mode' });
        }

        // 简单的硬编码管理员检查 (实际项目中建议使用更复杂的逻辑)
        // 默认用户名 admin，密码由环境变量配置
        if (input.username === 'admin' && input.password === ENV.localAdminPassword) {
          const openId = 'local-admin-001';
          
          // 确保用户存在
          await db.upsertUser({
            openId,
            name: 'Local Admin',
            role: 'admin',
            loginMethod: 'local',
          });

          // 生成 Session Token
          const token = await sdk.createSessionToken(openId, { name: 'Local Admin' });
          
          // 设置 Cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
          
          return { success: true };
        }

        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== 项目管理 ====================
  project: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProjectsByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.createProject({
          name: input.name,
          description: input.description,
          ownerId: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: project.id,
          action: 'create_project',
          targetType: 'project',
          targetId: project.id,
          details: { name: input.name },
        });
        return project;
      }),

    update: projectProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        alertThresholds: z.record(z.string(), z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateProject(input.projectId, {
          name: input.name,
          description: input.description,
          alertThresholds: input.alertThresholds,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: input.projectId,
          action: 'update_project',
          targetType: 'project',
          targetId: input.projectId,
          details: input,
        });
        return { success: true };
      }),

    stats: projectProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectStats(input.projectId);
      }),

    members: projectProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectMembers(input.projectId);
      }),

    addMember: projectProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
        role: z.enum(['admin', 'evaluator', 'viewer']),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.addProjectMember({
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: input.projectId,
          action: 'add_member',
          targetType: 'user',
          targetId: input.userId,
          details: { role: input.role },
        });
        return { success: true };
      }),
  }),

  // ==================== 智能体管理 ====================
  agent: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ input }) => {
        const agents = input.projectId 
          ? await db.getAgentsByProject(input.projectId)
          : await db.getAllAgents();
        // 脱敏 API Key
        return agents.map(agent => ({
          ...agent,
          encryptedApiKey: agent.encryptedApiKey ? db.maskApiKey('****') : null,
        }));
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent) return null;
        return {
          ...agent,
          encryptedApiKey: agent.encryptedApiKey ? db.maskApiKey('****') : null,
        };
      }),

    create: projectProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(255),
        type: z.enum(['qianfan', 'dify', 'n8n', 'custom']),
        version: z.string().min(1).max(64),
        description: z.string().optional(),
        apiEndpoint: z.string().url().optional(),
        apiKey: z.string().optional(),
        modelParams: z.object({
          model_id: z.string().optional(),
          temperature: z.number().min(0).max(2).optional(),
          top_p: z.number().min(0).max(1).optional(),
          max_tokens: z.number().positive().optional(),
          seed: z.number().optional(),
        }).optional(),
        configSnapshot: z.record(z.string(), z.unknown()).optional(),
        environment: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const agent = await db.createAgent({
          projectId: input.projectId,
          name: input.name,
          type: input.type,
          version: input.version,
          description: input.description,
          apiEndpoint: input.apiEndpoint,
          encryptedApiKey: input.apiKey,
          modelParams: input.modelParams,
          configSnapshot: input.configSnapshot,
          environment: input.environment,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: input.projectId,
          action: 'create_agent',
          targetType: 'agent',
          targetId: agent.id,
          details: { name: input.name, type: input.type, version: input.version },
        });
        return agent;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        version: z.string().min(1).max(64).optional(),
        description: z.string().optional(),
        apiEndpoint: z.string().url().optional(),
        apiKey: z.string().optional(),
        modelParams: z.object({
          model_id: z.string().optional(),
          temperature: z.number().min(0).max(2).optional(),
          top_p: z.number().min(0).max(1).optional(),
          max_tokens: z.number().positive().optional(),
          seed: z.number().optional(),
        }).optional(),
        configSnapshot: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(['active', 'inactive', 'archived']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent) throw new TRPCError({ code: 'NOT_FOUND' });
        
        await db.updateAgent(input.id, {
          name: input.name,
          version: input.version,
          description: input.description,
          apiEndpoint: input.apiEndpoint,
          encryptedApiKey: input.apiKey,
          modelParams: input.modelParams,
          configSnapshot: input.configSnapshot,
          status: input.status,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: agent.projectId,
          action: 'update_agent',
          targetType: 'agent',
          targetId: input.id,
          details: input,
        });
        return { success: true };
      }),

    setBaseline: projectProcedure
      .input(z.object({
        projectId: z.number(),
        agentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.setBaselineAgent(input.projectId, input.agentId);
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: input.projectId,
          action: 'set_baseline',
          targetType: 'agent',
          targetId: input.agentId,
        });
        return { success: true };
      }),
  }),

  // ==================== 测试集管理 ====================
  dataset: router({
    list: projectProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDatasetsByProject(input.projectId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getDatasetById(input.id);
      }),

    create: projectProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(255),
        version: z.string().min(1).max(64),
        description: z.string().optional(),
        type: z.enum(['accuracy', 'robustness', 'tool_calling', 'performance', 'security', 'rag']),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const dataset = await db.createDataset({
          projectId: input.projectId,
          name: input.name,
          version: input.version,
          description: input.description,
          type: input.type,
          tags: input.tags,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: input.projectId,
          action: 'create_dataset',
          targetType: 'dataset',
          targetId: dataset.id,
          details: { name: input.name, type: input.type },
        });
        return dataset;
      }),

    getCases: protectedProcedure
      .input(z.object({ datasetId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTestCasesByDataset(input.datasetId);
      }),

    addCase: protectedProcedure
      .input(z.object({
        datasetId: z.number(),
        input: z.string(),
        expectedOutput: z.string().optional(),
        context: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        caseType: z.enum(['single_turn', 'multi_turn', 'tool_call', 'rag_query']).optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createTestCase({
          datasetId: input.datasetId,
          input: input.input,
          expectedOutput: input.expectedOutput,
          context: input.context,
          metadata: input.metadata,
          caseType: input.caseType || 'single_turn',
        });
      }),

    importCases: protectedProcedure
      .input(z.object({
        datasetId: z.number(),
        cases: z.array(z.object({
          input: z.string(),
          expectedOutput: z.string().optional(),
          context: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          caseType: z.enum(['single_turn', 'multi_turn', 'tool_call', 'rag_query']).optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.createTestCasesBatch(
          input.cases.map(c => ({
            datasetId: input.datasetId,
            input: c.input,
            expectedOutput: c.expectedOutput,
            context: c.context,
            metadata: c.metadata,
            caseType: c.caseType || 'single_turn',
          }))
        );
        return { success: true, count: input.cases.length };
      }),

    exportCases: protectedProcedure
      .input(z.object({ datasetId: z.number() }))
      .query(async ({ input }) => {
        const cases = await db.getTestCasesByDataset(input.datasetId);
        return cases.map(c => ({
          input: c.input,
          expectedOutput: c.expectedOutput,
          context: c.context,
          metadata: c.metadata,
          caseType: c.caseType,
        }));
      }),
  }),

  // ==================== 评测任务管理 ====================
  evalTask: router({
    list: projectProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEvalTasksByProject(input.projectId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEvalTaskById(input.id);
      }),

    create: projectProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        agentIds: z.array(z.number()).min(1),
        datasetIds: z.array(z.number()).min(1),
        config: z.object({
          dimensions: z.array(z.enum(['accuracy', 'consistency', 'robustness', 'tool_calling', 'performance', 'security', 'rag'])),
          concurrency: z.number().min(1).max(10).default(1),
          timeout: z.number().min(10).max(600).default(120),
          saveTrace: z.boolean().default(true),
          baselineComparison: z.object({
            enabled: z.boolean(),
            baselineTaskId: z.number().optional(),
            alertThreshold: z.number().default(2),
          }).optional(),
          costCalculation: z.object({
            enabled: z.boolean(),
            profitMargin: z.number().min(0).max(1).default(0.3),
          }).optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.createEvalTask({
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          agentIds: input.agentIds,
          datasetIds: input.datasetIds,
          config: input.config,
          createdBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: input.projectId,
          action: 'create_eval_task',
          targetType: 'eval_task',
          targetId: task.id,
          details: { name: input.name, agentIds: input.agentIds, datasetIds: input.datasetIds },
        });
        return task;
      }),

    start: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getEvalTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND' });
        if (task.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '任务已启动或已完成' });
        }
        
        // 异步启动评测
        const config = task.config as EvalConfig;
        startEvaluation(input.taskId, config).catch(err => {
          console.error('Evaluation failed:', err);
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: task.projectId,
          action: 'start_eval_task',
          targetType: 'eval_task',
          targetId: input.taskId,
        });
        
        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getEvalTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND' });
        
        await db.updateEvalTask(input.taskId, { status: 'cancelled' });
        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: task.projectId,
          action: 'cancel_eval_task',
          targetType: 'eval_task',
          targetId: input.taskId,
        });
        
        return { success: true };
      }),

    results: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEvalResultsByTask(input.taskId);
      }),

    metrics: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEvalMetricsByTask(input.taskId);
      }),

    costStats: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCostStatsByTask(input.taskId);
      }),
  }),

  // ==================== Trace 查看 ====================
  trace: router({
    get: protectedProcedure
      .input(z.object({ resultId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTraceByResultId(input.resultId);
      }),
  }),

  // ==================== Leaderboard ====================
  leaderboard: router({
    get: projectProcedure
      .input(z.object({
        projectId: z.number(),
        limit: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        return await db.getLeaderboard(input.projectId, input.limit);
      }),
  }),

  // ==================== 报告管理 ====================
  report: router({
    list: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEvalReportsByTask(input.taskId);
      }),

    generate: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        title: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getEvalTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND' });
        if (task.status !== 'completed') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '任务未完成，无法生成报告' });
        }

        // 获取评测数据
        const metrics = await db.getEvalMetricsByTask(input.taskId);
        const results = await db.getEvalResultsByTask(input.taskId);
        const costStats = await db.getCostStatsByTask(input.taskId);

        // 生成报告内容
        const content = generateReportHTML(task, metrics, results, costStats);
        const summary = generateReportSummary(metrics);

        const report = await db.createEvalReport({
          taskId: input.taskId,
          title: input.title,
          content,
          summary,
          generatedBy: ctx.user.id,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          projectId: task.projectId,
          action: 'generate_report',
          targetType: 'report',
          targetId: report.id,
          details: { title: input.title },
        });

        return report;
      }),

    publish: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateEvalReport(input.reportId, { status: 'published' });
        return { success: true };
      }),
  }),

  // ==================== 审计日志 ====================
  auditLog: router({
    list: projectProcedure
      .input(z.object({
        projectId: z.number(),
        limit: z.number().min(1).max(500).default(100),
      }))
      .query(async ({ input }) => {
        return await db.getAuditLogs(input.projectId, input.limit);
      }),
  }),

  // ==================== 模型价格配置 ====================
  modelPricing: router({
    list: projectProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getModelPricingByProject(input.projectId);
      }),

    create: projectProcedure
      .input(z.object({
        projectId: z.number(),
        modelId: z.string().min(1).max(128),
        modelName: z.string().min(1).max(255),
        inputPricePerMillion: z.number().min(0),
        outputPricePerMillion: z.number().min(0),
        currency: z.string().default('CNY'),
      }))
      .mutation(async ({ input }) => {
        await db.createModelPricing({
          projectId: input.projectId,
          modelId: input.modelId,
          modelName: input.modelName,
          inputPricePerMillion: input.inputPricePerMillion,
          outputPricePerMillion: input.outputPricePerMillion,
          currency: input.currency,
        });
        return { success: true };
      }),
  }),
});

// 生成报告 HTML
function generateReportHTML(
  task: { name: string; description: string | null; createdAt: Date },
  metrics: Array<{ agentId: number; accuracy?: number | null; overallScore?: number | null; hasAlert: boolean; alertMessage?: string | null }>,
  results: Array<{ passed: boolean; latencyMs?: number | null }>,
  costStats: Array<{ totalCostCents: number; suggestedPrice: number }>
): string {
  const passRate = results.length > 0 
    ? Math.round((results.filter(r => r.passed).length / results.length) * 100)
    : 0;
  const avgLatency = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / results.length)
    : 0;
  const totalCost = costStats.reduce((sum, c) => sum + c.totalCostCents, 0) / 100;
  const suggestedPrice = costStats.reduce((sum, c) => sum + c.suggestedPrice, 0) / 100;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${task.name} - 智能体评测报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .summary { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
    .metric-label { font-size: 14px; color: #6b7280; }
    .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px 15px; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
    th { background: #f9fafb; }
    .pass { color: #10b981; }
    .fail { color: #ef4444; }
  </style>
</head>
<body>
  <h1>智能体评测报告</h1>
  <p><strong>任务名称：</strong>${task.name}</p>
  <p><strong>任务描述：</strong>${task.description || '无'}</p>
  <p><strong>生成时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
  
  <div class="summary">
    <h2>评测概览</h2>
    <div class="metric">
      <div class="metric-value">${passRate}%</div>
      <div class="metric-label">通过率</div>
    </div>
    <div class="metric">
      <div class="metric-value">${avgLatency}ms</div>
      <div class="metric-label">平均延迟</div>
    </div>
    <div class="metric">
      <div class="metric-value">¥${totalCost.toFixed(2)}</div>
      <div class="metric-label">总成本</div>
    </div>
    <div class="metric">
      <div class="metric-value">¥${suggestedPrice.toFixed(2)}</div>
      <div class="metric-label">建议收费</div>
    </div>
  </div>

  ${metrics.some(m => m.hasAlert) ? `
  <h2>告警信息</h2>
  ${metrics.filter(m => m.hasAlert).map(m => `
    <div class="alert">
      <strong>智能体 #${m.agentId}：</strong>${m.alertMessage}
    </div>
  `).join('')}
  ` : ''}

  <h2>详细指标</h2>
  <table>
    <thead>
      <tr>
        <th>智能体 ID</th>
        <th>准确率</th>
        <th>综合得分</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>
      ${metrics.map(m => `
        <tr>
          <td>${m.agentId}</td>
          <td>${m.accuracy ?? '-'}%</td>
          <td>${m.overallScore ?? '-'}</td>
          <td class="${m.hasAlert ? 'fail' : 'pass'}">${m.hasAlert ? '告警' : '正常'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>成本分析</h2>
  <table>
    <thead>
      <tr>
        <th>项目</th>
        <th>金额</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>评测总成本</td>
        <td>¥${totalCost.toFixed(2)}</td>
      </tr>
      <tr>
        <td>建议收费（含 30% 毛利）</td>
        <td>¥${suggestedPrice.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
    <p>本报告由智能体评测平台自动生成</p>
    <p>生成时间：${new Date().toISOString()}</p>
  </footer>
</body>
</html>
  `;
}

function generateReportSummary(metrics: Array<{ accuracy?: number | null; overallScore?: number | null }>): string {
  if (metrics.length === 0) return '无评测数据';
  
  const avgAccuracy = Math.round(
    metrics.reduce((sum, m) => sum + (m.accuracy || 0), 0) / metrics.length
  );
  const avgScore = Math.round(
    metrics.reduce((sum, m) => sum + (m.overallScore || 0), 0) / metrics.length
  );
  
  return `评测完成，共 ${metrics.length} 个智能体参与评测。平均准确率 ${avgAccuracy}%，平均综合得分 ${avgScore}。`;
}

export type AppRouter = typeof appRouter;
