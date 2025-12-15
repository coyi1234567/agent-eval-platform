import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, ChevronRight, Clock, MessageSquare, Wrench, AlertCircle, CheckCircle, Database, Brain } from "lucide-react";
import { useParams, Link } from "wouter";

interface TraceStep {
  type: 'input' | 'retrieval' | 'tool_call' | 'model_output' | 'error' | 'final_output';
  timestamp: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export default function TraceViewer() {
  const params = useParams<{ projectId: string; taskId: string; resultId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const taskId = parseInt(params.taskId || "0");
  const resultId = parseInt(params.resultId || "0");

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));

  const { data: trace, isLoading } = trpc.trace.get.useQuery(
    { resultId },
    { enabled: resultId > 0 }
  );

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'input':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'retrieval':
        return <Database className="w-4 h-4 text-purple-500" />;
      case 'tool_call':
        return <Wrench className="w-4 h-4 text-orange-500" />;
      case 'model_output':
        return <Brain className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'final_output':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStepLabel = (type: string) => {
    const labels: Record<string, string> = {
      input: '用户输入',
      retrieval: '知识检索',
      tool_call: '工具调用',
      model_output: '模型输出',
      error: '错误',
      final_output: '最终输出',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Trace 不存在</p>
      </div>
    );
  }

  const steps: TraceStep[] = trace.intermediateSteps ? (Array.isArray(trace.intermediateSteps) ? trace.intermediateSteps : JSON.parse(trace.intermediateSteps as string)) : [];

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}/tasks/${taskId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回结果
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Trace 轨迹查看器</h1>
          <p className="text-muted-foreground">结果 ID: #{resultId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">结果 ID</p>
              <p className="font-medium">#{trace.resultId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">创建时间</p>
              <p className="font-medium">{new Date(trace.createdAt).toLocaleString('zh-CN')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Token 使用</p>
              <div className="text-sm">
                <p>输入: {(trace.traceData as { inputTokens?: number })?.inputTokens ?? '-'}</p>
                <p>输出: {(trace.traceData as { outputTokens?: number })?.outputTokens ?? '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">重试次数</p>
              <p className="font-medium">{trace.retryCount}</p>
            </div>
            {trace.errorStack && (
              <div>
                <p className="text-sm text-muted-foreground">错误信息</p>
                <pre className="text-xs bg-red-50 text-red-700 p-2 rounded mt-1 overflow-x-auto">
                  {trace.errorStack}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右侧：执行轨迹 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>执行轨迹</CardTitle>
            <CardDescription>完整的执行步骤和中间结果</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-2">
                {steps.length > 0 ? (
                  steps.map((step, index) => (
                    <Collapsible
                      key={index}
                      open={expandedSteps.has(index)}
                      onOpenChange={() => toggleStep(index)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-2">
                            {expandedSteps.has(index) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            {getStepIcon(step.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{getStepLabel(step.type)}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {step.timestamp}ms
                              </span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-9 mt-2 p-3 bg-muted/30 rounded-lg">
                          <pre className="text-sm whitespace-pre-wrap break-words">
                            {typeof step.content === 'string' 
                              ? step.content 
                              : JSON.stringify(step.content, null, 2)}
                          </pre>
                          {step.metadata && Object.keys(step.metadata).length > 0 && (
                            <div className="mt-2 pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-1">元数据</p>
                              <pre className="text-xs text-muted-foreground">
                                {JSON.stringify(step.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无轨迹数据</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 原始输入输出 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>原始输入</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {trace.input || '无'}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>原始输出</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {trace.modelOutput || '无'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
