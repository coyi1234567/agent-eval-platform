import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, DollarSign, Clock, Target } from "lucide-react";
import { useParams, Link } from "wouter";

export default function TaskResults() {
  const params = useParams<{ projectId: string; taskId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const taskId = parseInt(params.taskId || "0");

  const { data: task, isLoading: taskLoading } = trpc.evalTask.get.useQuery(
    { id: taskId },
    { enabled: taskId > 0 }
  );

  const { data: metrics, isLoading: metricsLoading } = trpc.evalTask.metrics.useQuery(
    { taskId },
    { enabled: taskId > 0 }
  );

  const { data: results, isLoading: resultsLoading } = trpc.evalTask.results.useQuery(
    { taskId },
    { enabled: taskId > 0 }
  );

  const { data: costStats } = trpc.evalTask.costStats.useQuery(
    { taskId },
    { enabled: taskId > 0 }
  );

  if (taskLoading || metricsLoading || resultsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">任务不存在</p>
      </div>
    );
  }

  const passedCount = results?.filter(r => r.passed).length || 0;
  const totalCount = results?.length || 0;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  const avgLatency = results && results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / results.length)
    : 0;
  const totalCost = costStats?.reduce((sum, c) => sum + c.totalCostCents, 0) || 0;
  const suggestedPrice = costStats?.reduce((sum, c) => sum + c.suggestedPrice, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}/tasks`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{task.name}</h1>
          <p className="text-muted-foreground">{task.description || '评测结果详情'}</p>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">通过率</p>
                <p className="text-2xl font-bold">{passRate}%</p>
              </div>
              <div className={`p-2 rounded-full ${passRate >= 80 ? 'bg-green-100' : passRate >= 60 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                {passRate >= 80 ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : passRate >= 60 ? (
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
            <Progress value={passRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均延迟</p>
                <p className="text-2xl font-bold">{avgLatency}ms</p>
              </div>
              <div className="p-2 rounded-full bg-blue-100">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {avgLatency < 1000 ? '性能优秀' : avgLatency < 3000 ? '性能良好' : '需要优化'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">评测成本</p>
                <p className="text-2xl font-bold">¥{(totalCost / 100).toFixed(2)}</p>
              </div>
              <div className="p-2 rounded-full bg-purple-100">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              建议收费: ¥{(suggestedPrice / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">测试用例</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
              <div className="p-2 rounded-full bg-orange-100">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              通过 {passedCount} / 失败 {totalCount - passedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 告警信息 */}
      {metrics?.some(m => m.hasAlert) && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              告警信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.filter(m => m.hasAlert).map((m, i) => (
                <p key={i} className="text-red-600">
                  智能体 #{m.agentId}: {m.alertMessage}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 详细数据 */}
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">指标汇总</TabsTrigger>
          <TabsTrigger value="results">详细结果</TabsTrigger>
          <TabsTrigger value="cost">成本分析</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>评测指标</CardTitle>
              <CardDescription>各智能体的评测指标汇总</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>智能体 ID</TableHead>
                    <TableHead>准确率</TableHead>
                    <TableHead>安全性</TableHead>
                    <TableHead>延迟 P50</TableHead>
                    <TableHead>延迟 P95</TableHead>
                    <TableHead>综合得分</TableHead>
                    <TableHead>基线对比</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.map(m => (
                    <TableRow key={m.agentId}>
                      <TableCell>#{m.agentId}</TableCell>
                      <TableCell>{m.accuracy ?? '-'}%</TableCell>
                      <TableCell>{m.securityScore ?? '-'}%</TableCell>
                      <TableCell>{m.latencyP50 ?? '-'}ms</TableCell>
                      <TableCell>{m.latencyP95 ?? '-'}ms</TableCell>
                      <TableCell>
                        <Badge variant={
                          (m.overallScore ?? 0) >= 80 ? "default" :
                          (m.overallScore ?? 0) >= 60 ? "secondary" : "destructive"
                        }>
                          {m.overallScore ?? '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.baselineDiff !== null && m.baselineDiff !== undefined ? (
                          <span className={`flex items-center gap-1 ${m.baselineDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.baselineDiff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {m.baselineDiff >= 0 ? '+' : ''}{m.baselineDiff}%
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {m.hasAlert ? (
                          <Badge variant="destructive">告警</Badge>
                        ) : (
                          <Badge variant="outline">正常</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>详细结果</CardTitle>
              <CardDescription>每个测试用例的执行结果</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>智能体</TableHead>
                    <TableHead>测试集</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>延迟</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>成本</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results?.slice(0, 50).map(r => (
                    <TableRow key={r.id}>
                      <TableCell>#{r.id}</TableCell>
                      <TableCell>#{r.agentId}</TableCell>
                      <TableCell>#{r.datasetId}</TableCell>
                      <TableCell>
                        {r.passed ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            通过
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            <XCircle className="w-3 h-3 mr-1" />
                            失败
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{r.latencyMs ?? '-'}ms</TableCell>
                      <TableCell>
                        {r.tokenUsage ? (
                          (r.tokenUsage as { total_tokens?: number }).total_tokens ?? '-'
                        ) : '-'}
                      </TableCell>
                      <TableCell>¥{((r.costCents ?? 0) / 100).toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {results && results.length > 50 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  显示前 50 条，共 {results.length} 条结果
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>成本分析</CardTitle>
              <CardDescription>评测成本和建议收费</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>智能体 ID</TableHead>
                    <TableHead>调用次数</TableHead>
                    <TableHead>输入 Token</TableHead>
                    <TableHead>输出 Token</TableHead>
                    <TableHead>总成本</TableHead>
                    <TableHead>平均成本/次</TableHead>
                    <TableHead>建议收费</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costStats?.map(c => (
                    <TableRow key={c.agentId}>
                      <TableCell>#{c.agentId}</TableCell>
                      <TableCell>{c.totalCalls}</TableCell>
                      <TableCell>{c.totalInputTokens?.toLocaleString()}</TableCell>
                      <TableCell>{c.totalOutputTokens?.toLocaleString()}</TableCell>
                      <TableCell>¥{(c.totalCostCents / 100).toFixed(2)}</TableCell>
                      <TableCell>¥{(c.avgCostPerCall / 100).toFixed(4)}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ¥{(c.suggestedPrice / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">成本说明</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 总成本 = 输入 Token 成本 + 输出 Token 成本</li>
                  <li>• 建议收费 = 总成本 × (1 + 30% 毛利率)</li>
                  <li>• 单次评测服务建议收费 ¥10,000 起</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
