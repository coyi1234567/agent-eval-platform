import axios, { AxiosError } from 'axios';
import { decrypt } from '../db';

// ==================== 类型定义 ====================
export interface AgentConfig {
  type: 'qianfan' | 'dify' | 'n8n' | 'custom';
  apiEndpoint: string;
  apiKey: string; // 已解密的 API Key
  modelParams?: ModelParams;
  configSnapshot?: ConfigSnapshot;
}

export interface ModelParams {
  model_id?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  seed?: number;
}

export interface ConfigSnapshot {
  prompt?: string;
  tools?: string[];
  knowledge_base_version?: string;
  model_version?: string;
}

export interface AgentRequest {
  input: string;
  context?: Array<{ role: string; content: string }>;
  stream?: boolean;
}

export interface AgentResponse {
  output: string;
  tokenUsage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  latencyMs: number;
  toolCalls?: ToolCall[];
  retrievalResults?: RetrievalResult[];
  intermediateSteps?: IntermediateStep[];
  rawResponse?: unknown;
  error?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  latencyMs?: number;
}

export interface RetrievalResult {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface IntermediateStep {
  type: string;
  content: string;
  timestamp: number;
}

// ==================== 基础适配器接口 ====================
export interface AgentAdapter {
  invoke(request: AgentRequest): Promise<AgentResponse>;
  healthCheck(): Promise<boolean>;
}

// ==================== 百度千帆适配器 ====================
export class QianfanAdapter implements AgentAdapter {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    try {
      // 构建请求体
      const messages = request.context || [];
      messages.push({ role: 'user', content: request.input });

      const requestBody: Record<string, unknown> = {
        messages,
        ...this.config.modelParams,
      };

      // 调用千帆 API
      const response = await axios.post(
        this.config.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 120000, // 2分钟超时
        }
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;

      return {
        output: data.result || data.choices?.[0]?.message?.content || '',
        tokenUsage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
        latencyMs,
        toolCalls: this.parseToolCalls(data),
        rawResponse: data,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const axiosError = error as AxiosError;
      return {
        output: '',
        tokenUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        latencyMs,
        error: axiosError.message || 'Unknown error',
        rawResponse: axiosError.response?.data,
      };
    }
  }

  private parseToolCalls(data: Record<string, unknown>): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    // 解析千帆返回的工具调用
    if (data.function_call) {
      const fc = data.function_call as { name: string; arguments: string };
      toolCalls.push({
        name: fc.name,
        arguments: JSON.parse(fc.arguments || '{}'),
      });
    }
    return toolCalls;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 简单的健康检查请求
      const response = await this.invoke({ input: 'ping' });
      return !response.error;
    } catch {
      return false;
    }
  }
}

// ==================== Dify 适配器 ====================
export class DifyAdapter implements AgentAdapter {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    try {
      // Dify API 请求格式
      const requestBody: Record<string, unknown> = {
        inputs: {},
        query: request.input,
        response_mode: 'blocking',
        conversation_id: '',
        user: 'eval-platform',
      };

      // 如果有上下文，添加到 inputs
      if (request.context && request.context.length > 0) {
        requestBody.inputs = {
          context: request.context.map(c => `${c.role}: ${c.content}`).join('\n'),
        };
      }

      const response = await axios.post(
        `${this.config.apiEndpoint}/chat-messages`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 120000,
        }
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;

      return {
        output: data.answer || '',
        tokenUsage: {
          input_tokens: data.metadata?.usage?.prompt_tokens || 0,
          output_tokens: data.metadata?.usage?.completion_tokens || 0,
          total_tokens: data.metadata?.usage?.total_tokens || 0,
        },
        latencyMs,
        retrievalResults: this.parseRetrievalResults(data),
        toolCalls: this.parseToolCalls(data),
        intermediateSteps: this.parseIntermediateSteps(data),
        rawResponse: data,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const axiosError = error as AxiosError;
      return {
        output: '',
        tokenUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        latencyMs,
        error: axiosError.message || 'Unknown error',
        rawResponse: axiosError.response?.data,
      };
    }
  }

  private parseRetrievalResults(data: Record<string, unknown>): RetrievalResult[] {
    const results: RetrievalResult[] = [];
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const retrieverResources = metadata?.retriever_resources as Array<{
      content: string;
      score: number;
      document_name?: string;
    }> | undefined;
    
    if (retrieverResources) {
      for (const resource of retrieverResources) {
        results.push({
          content: resource.content,
          score: resource.score,
          metadata: { document_name: resource.document_name },
        });
      }
    }
    return results;
  }

  private parseToolCalls(data: Record<string, unknown>): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const agentThoughts = metadata?.agent_thoughts as Array<{
      tool: string;
      tool_input: string;
      observation: string;
    }> | undefined;
    
    if (agentThoughts) {
      for (const thought of agentThoughts) {
        if (thought.tool) {
          toolCalls.push({
            name: thought.tool,
            arguments: JSON.parse(thought.tool_input || '{}'),
            result: thought.observation,
          });
        }
      }
    }
    return toolCalls;
  }

  private parseIntermediateSteps(data: Record<string, unknown>): IntermediateStep[] {
    const steps: IntermediateStep[] = [];
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const agentThoughts = metadata?.agent_thoughts as Array<{
      thought: string;
      created_at: number;
    }> | undefined;
    
    if (agentThoughts) {
      for (const thought of agentThoughts) {
        steps.push({
          type: 'thought',
          content: thought.thought,
          timestamp: thought.created_at,
        });
      }
    }
    return steps;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.config.apiEndpoint}/parameters`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 10000,
        }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// ==================== n8n 适配器（预留）====================
export class N8nAdapter implements AgentAdapter {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    try {
      // n8n webhook 调用
      const response = await axios.post(
        this.config.apiEndpoint,
        {
          input: request.input,
          context: request.context,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 120000,
        }
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;

      return {
        output: data.output || data.result || JSON.stringify(data),
        tokenUsage: {
          input_tokens: data.tokenUsage?.input_tokens || 0,
          output_tokens: data.tokenUsage?.output_tokens || 0,
          total_tokens: data.tokenUsage?.total_tokens || 0,
        },
        latencyMs,
        rawResponse: data,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const axiosError = error as AxiosError;
      return {
        output: '',
        tokenUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        latencyMs,
        error: axiosError.message || 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(this.config.apiEndpoint, { timeout: 10000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// ==================== 自定义适配器（预留）====================
export class CustomAdapter implements AgentAdapter {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    try {
      // 通用 HTTP 调用
      const response = await axios.post(
        this.config.apiEndpoint,
        {
          input: request.input,
          context: request.context,
          params: this.config.modelParams,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 120000,
        }
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;

      return {
        output: data.output || data.result || data.answer || '',
        tokenUsage: {
          input_tokens: data.tokenUsage?.input_tokens || data.usage?.prompt_tokens || 0,
          output_tokens: data.tokenUsage?.output_tokens || data.usage?.completion_tokens || 0,
          total_tokens: data.tokenUsage?.total_tokens || data.usage?.total_tokens || 0,
        },
        latencyMs,
        toolCalls: data.toolCalls || [],
        retrievalResults: data.retrievalResults || [],
        intermediateSteps: data.intermediateSteps || [],
        rawResponse: data,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const axiosError = error as AxiosError;
      return {
        output: '',
        tokenUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        latencyMs,
        error: axiosError.message || 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(this.config.apiEndpoint, { timeout: 10000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// ==================== 适配器工厂 ====================
export function createAdapter(config: AgentConfig): AgentAdapter {
  switch (config.type) {
    case 'qianfan':
      return new QianfanAdapter(config);
    case 'dify':
      return new DifyAdapter(config);
    case 'n8n':
      return new N8nAdapter(config);
    case 'custom':
    default:
      return new CustomAdapter(config);
  }
}

// 从数据库 Agent 记录创建适配器
export function createAdapterFromAgent(agent: {
  type: 'qianfan' | 'dify' | 'n8n' | 'custom';
  apiEndpoint: string | null;
  encryptedApiKey: string | null;
  modelParams: unknown;
  configSnapshot: unknown;
}): AgentAdapter {
  const config: AgentConfig = {
    type: agent.type,
    apiEndpoint: agent.apiEndpoint || '',
    apiKey: agent.encryptedApiKey ? decrypt(agent.encryptedApiKey) : '',
    modelParams: agent.modelParams as ModelParams,
    configSnapshot: agent.configSnapshot as ConfigSnapshot,
  };
  return createAdapter(config);
}
