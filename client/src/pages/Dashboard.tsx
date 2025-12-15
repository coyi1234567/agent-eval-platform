import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Database, FileText, BarChart3, Plus, ArrowRight, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading } = trpc.project.list.useQuery();

  if (projectsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const currentProject = projects?.[0];

  return (
    <div className="p-6 space-y-6">
      {/* 欢迎区域 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            欢迎回来，{user?.name || '用户'}
          </h1>
          <p className="text-muted-foreground mt-1">
            智能体评测平台 - 全方位评测您的 AI 智能体
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            新建项目
          </Button>
        </Link>
      </div>

      {/* 快速统计 */}
      {currentProject && <ProjectStats projectId={currentProject.id} />}

      {/* 项目列表 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">我的项目</h2>
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              查看全部 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        
        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map(project => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || '暂无描述'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      创建于 {new Date(project.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">还没有项目，创建一个开始评测吧</p>
              <Link href="/projects/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个项目
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 功能介绍 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">平台功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={<Bot className="w-6 h-6" />}
            title="智能体接入"
            description="支持百度千帆、Dify、n8n 等多种智能体平台"
          />
          <FeatureCard
            icon={<Database className="w-6 h-6" />}
            title="测试集管理"
            description="版本化管理测试数据，支持 JSONL/CSV 导入导出"
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6" />}
            title="多维度评测"
            description="准确性、鲁棒性、安全性、RAG 等全方位评测"
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="报告生成"
            description="一键生成专业评测报告，支持 HTML/PDF 导出"
          />
        </div>
      </div>
    </div>
  );
}

function ProjectStats({ projectId }: { projectId: number }) {
  const { data: stats, isLoading } = trpc.project.stats.useQuery({ projectId });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Bot className="w-5 h-5 text-blue-500" />}
        label="智能体"
        value={stats?.agents || 0}
      />
      <StatCard
        icon={<Database className="w-5 h-5 text-green-500" />}
        label="测试集"
        value={stats?.datasets || 0}
      />
      <StatCard
        icon={<BarChart3 className="w-5 h-5 text-purple-500" />}
        label="评测任务"
        value={stats?.tasks || 0}
      />
      <StatCard
        icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
        label="已完成"
        value={stats?.completedTasks || 0}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="p-2 bg-muted rounded-lg">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3 text-primary">
          {icon}
        </div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
