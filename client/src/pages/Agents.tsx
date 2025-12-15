import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Bot, Star, Settings, Trash2, Play, Key, Server } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "wouter";

const AGENT_TYPES = [
  { value: "qianfan", label: "百度千帆", description: "百度智能云千帆大模型平台" },
  { value: "dify", label: "Dify", description: "Dify 开源 LLM 应用开发平台" },
  { value: "n8n", label: "n8n", description: "n8n 工作流自动化平台" },
  { value: "custom", label: "自定义", description: "自定义 HTTP API 接口" },
];

export default function Agents() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId ? parseInt(params.projectId) : 0;
  const isGlobalView = projectId === 0;
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    type: "dify" as "qianfan" | "dify" | "n8n" | "custom",
    version: "1.0.0",
    description: "",
    apiEndpoint: "",
    apiKey: "",
    modelParams: {
      model_id: "",
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2048,
    },
  });

  const { data: agents, isLoading, refetch } = trpc.agent.list.useQuery(
    { projectId: isGlobalView ? undefined : projectId },
    { enabled: true }
  );
  
  const createMutation = trpc.agent.create.useMutation({
    onSuccess: () => {
      toast.success("智能体创建成功");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "创建失败");
    },
  });

  const setBaselineMutation = trpc.agent.setBaseline.useMutation({
    onSuccess: () => {
      toast.success("已设为基线版本");
      refetch();
    },
  });

  const resetForm = () => {
    setNewAgent({
      name: "",
      type: "dify",
      version: "1.0.0",
      description: "",
      apiEndpoint: "",
      apiKey: "",
      modelParams: {
        model_id: "",
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2048,
      },
    });
  };

  const handleCreate = () => {
    if (!newAgent.name.trim()) {
      toast.error("请输入智能体名称");
      return;
    }
    if (!newAgent.apiEndpoint.trim()) {
      toast.error("请输入 API 端点");
      return;
    }
    createMutation.mutate({
      projectId,
      ...newAgent,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">智能体管理</h1>
          <p className="text-muted-foreground mt-1">配置和管理被测智能体</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              添加智能体
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加智能体</DialogTitle>
              <DialogDescription>
                配置要评测的智能体信息
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">基本信息</TabsTrigger>
                <TabsTrigger value="api">API 配置</TabsTrigger>
                <TabsTrigger value="params">模型参数</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">智能体名称 *</Label>
                  <Input
                    id="name"
                    placeholder="例如：客服助手 v1.0"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">智能体类型 *</Label>
                  <Select
                    value={newAgent.type}
                    onValueChange={(value: "qianfan" | "dify" | "n8n" | "custom") => 
                      setNewAgent({ ...newAgent, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version">版本号 *</Label>
                  <Input
                    id="version"
                    placeholder="例如：1.0.0"
                    value={newAgent.version}
                    onChange={(e) => setNewAgent({ ...newAgent, version: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    placeholder="智能体的功能描述"
                    value={newAgent.description}
                    onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  />
                </div>
              </TabsContent>
              <TabsContent value="api" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="apiEndpoint">API 端点 *</Label>
                  <Input
                    id="apiEndpoint"
                    placeholder={
                      newAgent.type === "dify" 
                        ? "https://api.dify.ai/v1" 
                        : newAgent.type === "qianfan"
                        ? "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions"
                        : "https://your-api-endpoint.com"
                    }
                    value={newAgent.apiEndpoint}
                    onChange={(e) => setNewAgent({ ...newAgent, apiEndpoint: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {newAgent.type === "dify" && "Dify 应用的 API 基础地址"}
                    {newAgent.type === "qianfan" && "千帆平台的模型调用地址"}
                    {newAgent.type === "n8n" && "n8n Webhook 触发地址"}
                    {newAgent.type === "custom" && "自定义 API 接口地址"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="输入 API Key（将加密存储）"
                    value={newAgent.apiKey}
                    onChange={(e) => setNewAgent({ ...newAgent, apiKey: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    API Key 将使用 AES-256 加密存储，展示时自动脱敏
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="params" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="model_id">模型 ID</Label>
                  <Input
                    id="model_id"
                    placeholder="例如：gpt-4、ernie-bot-4"
                    value={newAgent.modelParams.model_id}
                    onChange={(e) => setNewAgent({
                      ...newAgent,
                      modelParams: { ...newAgent.modelParams, model_id: e.target.value }
                    })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={newAgent.modelParams.temperature}
                      onChange={(e) => setNewAgent({
                        ...newAgent,
                        modelParams: { ...newAgent.modelParams, temperature: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="top_p">Top P</Label>
                    <Input
                      id="top_p"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={newAgent.modelParams.top_p}
                      onChange={(e) => setNewAgent({
                        ...newAgent,
                        modelParams: { ...newAgent.modelParams, top_p: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_tokens">Max Tokens</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    min="1"
                    max="128000"
                    value={newAgent.modelParams.max_tokens}
                    onChange={(e) => setNewAgent({
                      ...newAgent,
                      modelParams: { ...newAgent.modelParams, max_tokens: parseInt(e.target.value) }
                    })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  这些参数将被固化用于可复现评测
                </p>
              </TabsContent>
            </Tabs>
            <DialogFooter className="mt-6">
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

      {agents && agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <Card key={agent.id} className={agent.isBaseline ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {agent.isBaseline && (
                      <Badge variant="default" className="bg-primary">
                        <Star className="w-3 h-3 mr-1" />
                        基线
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {AGENT_TYPES.find(t => t.value === agent.type)?.label || agent.type}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {agent.description || '暂无描述'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Server className="w-4 h-4" />
                    <span>v{agent.version}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Key className="w-4 h-4" />
                    <span>{agent.encryptedApiKey || '未配置'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!agent.isBaseline && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBaselineMutation.mutate({ projectId, agentId: agent.id })}
                    >
                      <Star className="w-4 h-4 mr-1" />
                      设为基线
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <Settings className="w-4 h-4 mr-1" />
                    配置
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有智能体</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              添加您要评测的智能体，支持百度千帆、Dify 等多种平台
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              添加第一个智能体
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
