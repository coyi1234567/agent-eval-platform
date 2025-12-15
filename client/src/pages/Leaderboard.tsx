import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useParams } from "wouter";

export default function Leaderboard() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");

  const { data: leaderboard, isLoading } = trpc.leaderboard.get.useQuery(
    { projectId, limit: 20 },
    { enabled: projectId > 0 }
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">{rank}</span>;
    }
  };

  const getTrendIcon = (diff: number | null | undefined) => {
    if (diff === null || diff === undefined) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (diff > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (diff < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">排行榜</h1>
        <p className="text-muted-foreground mt-1">智能体评测综合排名</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 前三名展示 */}
        {leaderboard && leaderboard.length >= 3 && (
          <>
            {/* 第二名 */}
            <Card className="lg:order-1">
              <CardContent className="pt-6 text-center">
                <Medal className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <h3 className="text-lg font-semibold">智能体 #{leaderboard[1]?.agentId || '-'}</h3>
                <p className="text-sm text-muted-foreground">综合得分</p>
                <p className="text-3xl font-bold mt-2">{leaderboard[1]?.overallScore || '-'}</p>
                <p className="text-sm text-muted-foreground">综合得分</p>
              </CardContent>
            </Card>

            {/* 第一名 */}
            <Card className="lg:order-0 border-yellow-200 bg-yellow-50/50">
              <CardContent className="pt-6 text-center">
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-2" />
                <h3 className="text-xl font-bold">智能体 #{leaderboard[0]?.agentId || '-'}</h3>
                <p className="text-sm text-muted-foreground">综合得分</p>
                <p className="text-4xl font-bold mt-2 text-yellow-600">{leaderboard[0]?.overallScore || '-'}</p>
                <p className="text-sm text-muted-foreground">综合得分</p>
              </CardContent>
            </Card>

            {/* 第三名 */}
            <Card className="lg:order-2">
              <CardContent className="pt-6 text-center">
                <Award className="w-12 h-12 text-amber-600 mx-auto mb-2" />
                <h3 className="text-lg font-semibold">智能体 #{leaderboard[2]?.agentId || '-'}</h3>
                <p className="text-sm text-muted-foreground">综合得分</p>
                <p className="text-3xl font-bold mt-2">{leaderboard[2]?.overallScore || '-'}</p>
                <p className="text-sm text-muted-foreground">综合得分</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 完整排行榜 */}
      <Card>
        <CardHeader>
          <CardTitle>完整排名</CardTitle>
          <CardDescription>按综合得分排序的智能体列表</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard && leaderboard.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">排名</TableHead>
                  <TableHead>智能体 ID</TableHead>
                  <TableHead>任务 ID</TableHead>
                  <TableHead>准确率</TableHead>
                  <TableHead>安全性</TableHead>
                  <TableHead>延迟 P50</TableHead>
                  <TableHead>综合得分</TableHead>
                  <TableHead>趋势</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((item, index) => (
                  <TableRow key={item.agentId} className={index < 3 ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">#{item.agentId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">#{item.taskId}</Badge>
                    </TableCell>
                    <TableCell>{item.accuracy ?? '-'}%</TableCell>
                    <TableCell>{item.securityScore ?? '-'}%</TableCell>
                    <TableCell>{item.latencyP50 ?? '-'}ms</TableCell>
                    <TableCell>
                      <Badge variant={
                        (item.overallScore ?? 0) >= 80 ? "default" :
                        (item.overallScore ?? 0) >= 60 ? "secondary" : "destructive"
                      }>
                        {item.overallScore ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(item.baselineDiff)}
                        {item.baselineDiff !== null && item.baselineDiff !== undefined && (
                          <span className={
                            item.baselineDiff > 0 ? 'text-green-500' :
                            item.baselineDiff < 0 ? 'text-red-500' : 'text-muted-foreground'
                          }>
                            {item.baselineDiff > 0 ? '+' : ''}{item.baselineDiff}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无排行数据</p>
              <p className="text-sm mt-1">完成评测任务后将自动生成排行榜</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
