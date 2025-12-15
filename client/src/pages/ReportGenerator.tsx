import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Download, Eye, Loader2 } from "lucide-react";
import { useParams, Link } from "wouter";
import { toast } from "sonner";

export default function ReportGenerator() {
  const params = useParams<{ projectId: string; taskId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const taskId = parseInt(params.taskId || "0");
  
  const [title, setTitle] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const { data: task, isLoading: taskLoading } = trpc.evalTask.get.useQuery(
    { id: taskId },
    { enabled: taskId > 0 }
  );

  const { data: reports, isLoading: reportsLoading, refetch } = trpc.report.list.useQuery(
    { taskId },
    { enabled: taskId > 0 }
  );

  const generateMutation = trpc.report.generate.useMutation({
    onSuccess: (report) => {
      toast.success("报告生成成功");
      setTitle("");
      refetch();
      if (report.content) {
        setPreviewHtml(report.content);
      }
    },
    onError: (error) => {
      toast.error(error.message || "生成失败");
    },
  });

  const handleGenerate = () => {
    if (!title.trim()) {
      toast.error("请输入报告标题");
      return;
    }
    generateMutation.mutate({ taskId, title });
  };

  const handleDownloadPdf = async (reportContent: string, reportTitle: string) => {
    // 创建一个新窗口用于打印
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("请允许弹出窗口以下载 PDF");
      return;
    }
    
    printWindow.document.write(reportContent);
    printWindow.document.close();
    
    // 等待内容加载后打印
    printWindow.onload = () => {
      printWindow.print();
    };
    
    toast.success("请在打印对话框中选择'保存为 PDF'");
  };

  const handlePreview = (content: string) => {
    setPreviewHtml(content);
  };

  if (taskLoading || reportsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
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
          <h1 className="text-2xl font-bold">生成评测报告</h1>
          <p className="text-muted-foreground">{task.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：生成表单和历史报告 */}
        <div className="space-y-6">
          {/* 生成新报告 */}
          <Card>
            <CardHeader>
              <CardTitle>生成新报告</CardTitle>
              <CardDescription>
                基于评测结果生成专业的评测报告
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">报告标题</Label>
                <Input
                  id="title"
                  placeholder="例如：智能体 v1.0 评测报告"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleGenerate} 
                disabled={generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    生成报告
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 历史报告 */}
          <Card>
            <CardHeader>
              <CardTitle>历史报告</CardTitle>
              <CardDescription>
                已生成的评测报告列表
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reports && reports.length > 0 ? (
                <div className="space-y-3">
                  {reports.map(report => (
                    <div 
                      key={report.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{report.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handlePreview(report.content || '')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDownloadPdf(report.content || '', report.title)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  暂无历史报告
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：报告预览 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>报告预览</CardTitle>
            <CardDescription>
              点击历史报告的预览按钮查看内容
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewHtml ? (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[600px]"
                  title="报告预览"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="w-16 h-16 mb-4" />
                <p>生成或选择报告以预览</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
