import { useState, useRef } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Database, Upload, Download, FileText, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "wouter";

const DATASET_TYPES = [
  { value: "accuracy", label: "准确性测试", description: "测试智能体回答的准确性" },
  { value: "robustness", label: "鲁棒性测试", description: "测试对同义改写、噪声的抵抗能力" },
  { value: "tool_calling", label: "工具调用测试", description: "测试工具调用的准确性和效率" },
  { value: "performance", label: "性能测试", description: "测试响应延迟和吞吐量" },
  { value: "security", label: "安全性测试", description: "测试对提示词注入等攻击的防御" },
  { value: "rag", label: "RAG 测试", description: "测试检索增强生成的质量" },
];

export default function Datasets() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [newDataset, setNewDataset] = useState({
    name: "",
    version: "1.0.0",
    description: "",
    type: "accuracy" as "accuracy" | "robustness" | "tool_calling" | "performance" | "security" | "rag",
  });

  const { data: datasets, isLoading, refetch } = trpc.dataset.list.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const { data: cases } = trpc.dataset.getCases.useQuery(
    { datasetId: selectedDataset! },
    { enabled: !!selectedDataset }
  );

  const { data: exportData } = trpc.dataset.exportCases.useQuery(
    { datasetId: selectedDataset! },
    { enabled: false }
  );
  
  const createMutation = trpc.dataset.create.useMutation({
    onSuccess: () => {
      toast.success("测试集创建成功");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "创建失败");
    },
  });

  const importMutation = trpc.dataset.importCases.useMutation({
    onSuccess: (result) => {
      toast.success(`成功导入 ${result.count} 条测试用例`);
      setIsImportOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "导入失败");
    },
  });

  const resetForm = () => {
    setNewDataset({
      name: "",
      version: "1.0.0",
      description: "",
      type: "accuracy",
    });
  };

  const handleCreate = () => {
    if (!newDataset.name.trim()) {
      toast.error("请输入测试集名称");
      return;
    }
    createMutation.mutate({
      projectId,
      ...newDataset,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDataset) return;

    try {
      const text = await file.text();
      let cases: Array<{ input: string; expectedOutput?: string }> = [];

      if (file.name.endsWith('.jsonl')) {
        cases = text.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        cases = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',');
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = values[i]?.trim() || '';
            });
            return {
              input: obj.input || obj.question || '',
              expectedOutput: obj.expectedOutput || obj.expected || obj.answer || '',
            };
          });
      } else if (file.name.endsWith('.json')) {
        cases = JSON.parse(text);
      }

      if (cases.length > 0) {
        importMutation.mutate({
          datasetId: selectedDataset,
          cases: cases.map(c => ({
            input: c.input,
            expectedOutput: c.expectedOutput,
          })),
        });
      } else {
        toast.error("文件中没有有效的测试用例");
      }
    } catch (error) {
      toast.error("文件解析失败，请检查格式");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = async (datasetId: number, format: 'jsonl' | 'csv') => {
    const dataset = datasets?.find(d => d.id === datasetId);
    if (!dataset) return;

    // 使用当前选中的 cases 数据或重新获取
    const casesResp = await fetch(`/api/trpc/dataset.exportCases?input=${encodeURIComponent(JSON.stringify({ datasetId }))}`);
    const casesJson = await casesResp.json();
    const casesData = casesJson.result?.data || [];
    
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'jsonl') {
      content = casesData.map((c: Record<string, unknown>) => JSON.stringify(c)).join('\n');
      filename = `${dataset.name}-${dataset.version}.jsonl`;
      mimeType = 'application/jsonl';
    } else {
      const headers = ['input', 'expectedOutput', 'caseType'];
      const rows = casesData.map((c: { input?: string; expectedOutput?: string; caseType?: string }) => [
        `"${(c.input || '').replace(/"/g, '""')}"`,
        `"${(c.expectedOutput || '').replace(/"/g, '""')}"`,
        c.caseType,
      ].join(','));
      content = [headers.join(','), ...rows].join('\n');
      filename = `${dataset.name}-${dataset.version}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">测试集管理</h1>
          <p className="text-muted-foreground mt-1">管理评测用的测试数据集</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              创建测试集
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建测试集</DialogTitle>
              <DialogDescription>
                创建一个新的测试数据集
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">测试集名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：常识问答测试集"
                  value={newDataset.name}
                  onChange={(e) => setNewDataset({ ...newDataset, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">测试类型 *</Label>
                <Select
                  value={newDataset.type}
                  onValueChange={(value: typeof newDataset.type) => 
                    setNewDataset({ ...newDataset, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATASET_TYPES.map(type => (
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
                  value={newDataset.version}
                  onChange={(e) => setNewDataset({ ...newDataset, version: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="测试集的描述信息"
                  value={newDataset.description}
                  onChange={(e) => setNewDataset({ ...newDataset, description: e.target.value })}
                />
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.csv,.json"
        className="hidden"
        onChange={handleFileUpload}
      />

      {datasets && datasets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map(dataset => (
            <Card key={dataset.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{dataset.name}</CardTitle>
                  </div>
                  <Badge variant="outline">
                    {DATASET_TYPES.find(t => t.value === dataset.type)?.label || dataset.type}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {dataset.description || '暂无描述'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>v{dataset.version}</span>
                  <span>{dataset.caseCount} 条用例</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedDataset(dataset.id);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    导入
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(dataset.id, 'jsonl')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    JSONL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(dataset.id, 'csv')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Database className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有测试集</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              创建测试集来管理您的评测数据，支持 JSONL 和 CSV 格式导入导出
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              创建第一个测试集
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
