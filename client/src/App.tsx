import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";

// 页面组件
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Agents from "./pages/Agents";
import Datasets from "./pages/Datasets";
import EvalTasks from "./pages/EvalTasks";
import TaskResults from "./pages/TaskResults";
import ReportGenerator from "./pages/ReportGenerator";
import Leaderboard from "./pages/Leaderboard";
import TraceViewer from "./pages/TraceViewer";
import DiffCompare from "./pages/DiffCompare";

// 需要登录的路由包装器
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }
  
  return <Component />;
}

// Dashboard 布局包装器
function DashboardRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <DashboardLayout>
      <ProtectedRoute component={Component} />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* 登录页面 */}
      <Route path="/login" component={Login} />

      {/* 首页重定向到 Dashboard */}
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      
      {/* Dashboard 相关页面 */}
      <Route path="/dashboard">
        <DashboardRoute component={Dashboard} />
      </Route>
      
      {/* 项目管理 */}
      <Route path="/projects">
        <DashboardRoute component={Projects} />
      </Route>
      <Route path="/projects/new">
        <DashboardRoute component={Projects} />
      </Route>
      
      {/* 全局智能体管理 */}
      <Route path="/agents">
        <DashboardRoute component={Agents} />
      </Route>
      
      {/* 全局测试集管理 */}
      <Route path="/datasets">
        <DashboardRoute component={Datasets} />
      </Route>
      
      {/* 全局评测任务 */}
      <Route path="/tasks">
        <DashboardRoute component={EvalTasks} />
      </Route>
      <Route path="/tasks/:taskId">
        <DashboardRoute component={TaskResults} />
      </Route>
      
      {/* 全局排行榜 */}
      <Route path="/leaderboard">
        <DashboardRoute component={Leaderboard} />
      </Route>
      
      {/* 全局 Trace 查看器 */}
      <Route path="/traces">
        <DashboardRoute component={TraceViewer} />
      </Route>
      <Route path="/traces/:traceId">
        <DashboardRoute component={TraceViewer} />
      </Route>
      
      {/* 全局 Diff 对比 */}
      <Route path="/diff">
        <DashboardRoute component={DiffCompare} />
      </Route>
      
      {/* 全局报告生成 */}
      <Route path="/reports">
        <DashboardRoute component={ReportGenerator} />
      </Route>
      
      {/* 项目详情页面 - 智能体管理 */}
      <Route path="/projects/:projectId/agents">
        <DashboardRoute component={Agents} />
      </Route>
      
      {/* 项目详情页面 - 测试集管理 */}
      <Route path="/projects/:projectId/datasets">
        <DashboardRoute component={Datasets} />
      </Route>
      
      {/* 项目详情页面 - 评测任务 */}
      <Route path="/projects/:projectId/tasks">
        <DashboardRoute component={EvalTasks} />
      </Route>
      
      {/* 评测任务结果 */}
      <Route path="/projects/:projectId/tasks/:taskId">
        <DashboardRoute component={TaskResults} />
      </Route>
      
      {/* 报告生成 */}
      <Route path="/projects/:projectId/tasks/:taskId/report">
        <DashboardRoute component={ReportGenerator} />
      </Route>
      
      {/* 排行榜 */}
      <Route path="/projects/:projectId/leaderboard">
        <DashboardRoute component={Leaderboard} />
      </Route>
      
      {/* Trace 轨迹查看器 */}
      <Route path="/projects/:projectId/tasks/:taskId/results/:resultId/trace">
        <DashboardRoute component={TraceViewer} />
      </Route>
      
      {/* 版本对比 */}
      <Route path="/projects/:projectId/compare">
        <DashboardRoute component={DiffCompare} />
      </Route>
      
      {/* 项目详情默认页 */}
      <Route path="/projects/:projectId">
        {(params) => <Redirect to={`/projects/${params.projectId}/agents`} />}
      </Route>
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
