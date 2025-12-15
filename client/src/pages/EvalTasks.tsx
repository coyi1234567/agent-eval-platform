import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Plus, Play, Square, Eye, FileText, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useParams, Link } from "wouter";

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "待执行", color: "bg-gray-500", icon: <Clock className="w-4 h-4" /> },
  running: { label: "运行中", color: "bg-blue-500", icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  completed: { label: "已完成", color: "bg-green-500", icon: <CheckCircle className="w-4 h-4" /> },
  failed: { label: "失败", color: "bg-red-500", icon: <XCircle className="w-4 h-4" /> },
  cancelled: { label: "已取消", color: "bg-yellow-500", icon: <Square className="w-4 h-4" /> },
};

const DIMENSIONS = [
  { value: "accuracy", label: "准确性" },
  { value: "consistency", label: "一致性" },
  { value: "robustness", label: "鲁棒性" },
  { value: "tool_calling", label: "工具调用" },
  { value: "performance", label: "性能" },
  { value: "security", label: "安全性" },
  { value: "rag", label: "RAG" },
];

export default function EvalTasks() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "",
    description: "",
    agentIds: [] as number[],
    datasetIds: [] as number[],
    dimensions: ["accuracy", "security"] as string[],
    saveTrace: true,
    baselineComparison: false,
    costCalculation: true,
  });

  const { data: tasks, isLoading, refetch } = trpc.evalTask.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const { data: agents } = trpc.agent.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const { data: datasets } = trpc.dataset.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );
  
  const createMutation = trpc.evalTask.create.useMutation({
    onSuccess: () => {
      toast.success("评测任务创建成功");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "创建失败");
    },
  });

  const startMutation = trpc.evalTask.start.useMutation({
    onSuccess: () => {
      toast.success("评测任务已启动");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "启动失败");
    },
  });

  const cancelMutation = trpc.evalTask.cancel.useMutation({
    onSuccess: () => {
      toast.success("评测任务已取消");
      refetch();
    },
  });

  const resetForm = () => {
    setNewTask({
      name: "",
      description: "",
      agentIds: [],
      datasetIds: [],
      dimensions: ["accuracy", "security"],
      saveTrace: true,
      baselineComparison: false,
      costCalculation: true,
    });
  };

  const handleCreate = () => {
    if (!newTask.name.trim()) {
      toast.error("请输入任务名称");
      return;
    }
    if (newTask.agentIds.length === 0) {
      toast.error("请选择至少一个智能体");
      return;
    }
    if (newTask.datasetIds.length === 0) {
      toast.error("请选择至少一个测试集");
      return;
    }
    createMutation.mutate({
      projectId,
      name: newTask.name,
      description: newTask.description,
      agentIds: newTask.agentIds,
      datasetIds: newTask.datasetIds,
      config: {
        dimensions: newTask.dimensions as ("accuracy" | "consistency" | "robustness" | "tool_calling" | "performance" | "security" | "rag")[],
        concurrency: 1,
        timeout: 120,
        saveTrace: newTask.saveTrace,
        baselineComparison: newTask.baselineComparison ? {
          enabled: true,
          alertThreshold: 2,
        } : undefined,
        costCalculation: newTask.costCalculation ? {
          enabled: true,
          profitMargin: 0.3,
        } : undefined,
      },
    });
  };

  const toggleAgent = (agentId: number) => {
    setNewTask(prev => ({
      ...prev,
      agentIds: prev.agentIds.includes(agentId)
        ? prev.agentIds.filter(id => id !== agentId)
        : [...prev.agentIds, agentId],
    }));
  };

  const toggleDataset = (datasetId: number) => {
    setNewTask(prev => ({
      ...prev,
      datasetIds: prev.datasetIds.includes(datasetId)
        ? prev.datasetIds.filter(id => id !== datasetId)
        : [...prev.datasetIds, datasetId],
    }));
  };

  const toggleDimension = (dimension: string) => {
    setNewTask(prev => ({
      ...prev,
      dimensions: prev.dimensions.includes(dimension)
        ? prev.dimensions.filter(d => d !== dimension)
        : [...prev.dimensions, dimension],
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">评测任务</h1>
          <p className="text-muted-foreground mt-1">创建和管理评测任务</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              创建任务
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>创建评测任务</DialogTitle>
              <DialogDescription>
                配置评测任务的参数和选项
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">任务名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：v1.0 基线评测"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">任务描述</Label>
                <Textarea
                  id="description"
                  placeholder="评测任务的描述信息"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>选择智能体 *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {agents?.map(agent => (
                    <div key={agent.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${agent.id}`}
                        checked={newTask.agentIds.includes(agent.id)}
                        onCheckedChange={() => toggleAgent(agent.id)}
                      />
                      <label htmlFor={`agent-${agent.id}`} className="text-sm cursor-pointer">
                        {agent.name} (v{agent.version})
                      </label>
                    </div>
                  ))}
                  {(!agents || agents.length === 0) && (
                    <p className="text-sm text-muted-foreground col-span-2">暂无智能体，请先添加</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>选择测试集 *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {datasets?.map(dataset => (
                    <div key={dataset.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dataset-${dataset.id}`}
                        checked={newTask.datasetIds.includes(dataset.id)}
                        onCheckedChange={() => toggleDataset(dataset.id)}
                      />
                      <label htmlFor={`dataset-${dataset.id}`} className="text-sm cursor-pointer">
                        {dataset.name} ({dataset.caseCount} 条)
                      </label>
                    </div>
                  ))}
                  {(!datasets || datasets.length === 0) && (
                    <p className="text-sm text-muted-foreground col-span-2">暂无测试集，请先创建</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>评测维度</Label>
                <div className="flex flex-wrap gap-2">
                  {DIMENSIONS.map(dim => (
                    <Badge
                      key={dim.value}
                      variant={newTask.dimensions.includes(dim.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleDimension(dim.value)}
                    >
                      {dim.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>评测选项</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="saveTrace"
                      checked={newTask.saveTrace}
                      onCheckedChange={(checked) => setNewTask({ ...newTask, saveTrace: !!checked })}
                    />
                    <label htmlFor="saveTrace" className="text-sm cursor-pointer">
                      保存完整 Trace（用于问题定位和回放）
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="baselineComparison"
                      checked={newTask.baselineComparison}
                      onCheckedChange={(checked) => setNewTask({ ...newTask, baselineComparison: !!checked })}
                    />
                    <label htmlFor="baselineComparison" className="text-sm cursor-pointer">
                      启用基线对比（准确率下降 &gt;2% 触发告警）
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="costCalculation"
                      checked={newTask.costCalculation}
                      onCheckedChange={(checked) => setNewTask({ ...newTask, costCalculation: !!checked })}
                    />
                    <label htmlFor="costCalculation" className="text-sm cursor-pointer">
                      计算成本和建议收费（30% 毛利）
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tasks && tasks.length > 0 ? (
        <div className="space-y-4">
          {tasks.map(task => {
            const status = STATUS_MAP[task.status] || STATUS_MAP.pending;
            const agentIds = task.agentIds as number[];
            const datasetIds = task.datasetIds as number[];
            
            return (
              <Card key={task.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {task.name}
                        <Badge className={`${status.color} text-white`}>
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
                        </Badge>
                      </CardTitle>
                      <CardDescription>{task.description || '暂无描述'}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {task.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => startMutation.mutate({ taskId: task.id })}
                          disabled={startMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          启动
                        </Button>
                      )}
                      {task.status === 'running' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelMutation.mutate({ taskId: task.id })}
                        >
                          <Square className="w-4 h-4 mr-1" />
                          取消
                        </Button>
                      )}
                      {task.status === 'completed' && (
                        <>
                          <Link href={`/projects/${projectId}/tasks/${task.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-1" />
                              查看结果
                            </Button>
                          </Link>
                          <Link href={`/projects/${projectId}/tasks/${task.id}/report`}>
                            <Button size="sm" variant="outline">
                              <FileText className="w-4 h-4 mr-1" />
                              生成报告
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {task.status === 'running' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>进度</span>
                          <span>{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} />
                      </div>
                    )}
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{agentIds.length} 个智能体</span>
                      <span>{datasetIds.length} 个测试集</span>
                      <span>创建于 {new Date(task.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Play className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有评测任务</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              创建评测任务来测试您的智能体，支持多维度评测和基线对比
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              创建第一个任务
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
