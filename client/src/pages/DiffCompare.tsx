import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Minus, GitCompare } from "lucide-react";
import { useParams, Link } from "wouter";

export default function DiffCompare() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");

  const [leftTaskId, setLeftTaskId] = useState<string>("");
  const [rightTaskId, setRightTaskId] = useState<string>("");

  const { data: tasks, isLoading: tasksLoading } = trpc.evalTask.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const { data: leftMetrics } = trpc.evalTask.metrics.useQuery(
    { taskId: parseInt(leftTaskId) },
    { enabled: !!leftTaskId }
  );

  const { data: rightMetrics } = trpc.evalTask.metrics.useQuery(
    { taskId: parseInt(rightTaskId) },
    { enabled: !!rightTaskId }
  );

  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];

  const getDiffValue = (left: number | null | undefined, right: number | null | undefined) => {
    if (left === null || left === undefined || right === null || right === undefined) return null;
    return right - left;
  };

  const getDiffIcon = (diff: number | null) => {
    if (diff === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (diff > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (diff < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getDiffColor = (diff: number | null) => {
    if (diff === null) return 'text-muted-foreground';
    if (diff > 0) return 'text-green-600';
    if (diff < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const formatDiff = (diff: number | null) => {
    if (diff === null) return '-';
    if (diff > 0) return `+${diff.toFixed(2)}`;
    return diff.toFixed(2);
  };

  if (tasksLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}/tasks`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回任务列表
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">版本对比</h1>
          <p className="text-muted-foreground">对比不同评测任务的结果差异</p>
        </div>
      </div>

      {/* 选择器 */}
      <Card>
        <CardHeader>
          <CardTitle>选择对比任务</CardTitle>
          <CardDescription>选择两个已完成的评测任务进行对比</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-2 block">基线任务</label>
              <Select value={leftTaskId} onValueChange={setLeftTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择基线任务" />
                </SelectTrigger>
                <SelectContent>
                  {completedTasks.map(task => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.name} ({new Date(task.createdAt).toLocaleDateString('zh-CN')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center pt-6">
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-2 block">对比任务</label>
              <Select value={rightTaskId} onValueChange={setRightTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择对比任务" />
                </SelectTrigger>
                <SelectContent>
                  {completedTasks.map(task => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.name} ({new Date(task.createdAt).toLocaleDateString('zh-CN')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 对比结果 */}
      {leftMetrics && rightMetrics ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5" />
              对比结果
            </CardTitle>
            <CardDescription>
              基线 vs 对比任务的指标差异（正值表示提升，负值表示下降）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>智能体 ID</TableHead>
                  <TableHead>指标</TableHead>
                  <TableHead className="text-right">基线值</TableHead>
                  <TableHead className="text-right">对比值</TableHead>
                  <TableHead className="text-right">差异</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leftMetrics.map(leftM => {
                  const rightM = rightMetrics.find(r => r.agentId === leftM.agentId);
                  if (!rightM) return null;

                  const metrics = [
                    { name: '准确率', left: leftM.accuracy, right: rightM.accuracy, unit: '%' },
                    { name: '安全性', left: leftM.securityScore, right: rightM.securityScore, unit: '%' },
                    { name: '综合得分', left: leftM.overallScore, right: rightM.overallScore, unit: '' },
                    { name: '延迟 P50', left: leftM.latencyP50, right: rightM.latencyP50, unit: 'ms', inverse: true },
                    { name: '延迟 P95', left: leftM.latencyP95, right: rightM.latencyP95, unit: 'ms', inverse: true },
                  ];

                  return metrics.map((metric, idx) => {
                    const diff = getDiffValue(metric.left, metric.right);
                    const effectiveDiff = metric.inverse ? (diff !== null ? -diff : null) : diff;
                    
                    return (
                      <TableRow key={`${leftM.agentId}-${metric.name}`}>
                        {idx === 0 && (
                          <TableCell rowSpan={metrics.length} className="font-medium align-top">
                            #{leftM.agentId}
                          </TableCell>
                        )}
                        <TableCell>{metric.name}</TableCell>
                        <TableCell className="text-right">
                          {metric.left ?? '-'}{metric.left !== null && metric.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {metric.right ?? '-'}{metric.right !== null && metric.unit}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getDiffColor(effectiveDiff)}`}>
                          {formatDiff(diff)}{diff !== null && metric.unit}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getDiffIcon(effectiveDiff)}
                            {effectiveDiff !== null && Math.abs(effectiveDiff) > 2 && (
                              <Badge variant={effectiveDiff > 0 ? "default" : "destructive"}>
                                {effectiveDiff > 0 ? '显著提升' : '显著下降'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitCompare className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择任务进行对比</h3>
            <p className="text-muted-foreground text-center max-w-md">
              请在上方选择两个已完成的评测任务，系统将自动计算并展示指标差异
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
