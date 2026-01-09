import { useEffect, useState } from 'react'
import { ArrowLeft, TrendingUp, DollarSign, Zap, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { statsApi } from '@/api'
import type { UsageOverview, DailyTrend, ModelRanking } from '@/api/stats'

export default function StatsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<UsageOverview | null>(null)
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const [modelRanking, setModelRanking] = useState<ModelRanking[]>([])
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30')

  useEffect(() => {
    loadStats()
  }, [dateRange])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [overviewData, trendData, rankingData] = await Promise.all([
        statsApi.getOverview(),
        statsApi.getDailyTrend(parseInt(dateRange)),
        statsApi.getModelRanking(10),
      ])
      setOverview(overviewData)
      setDailyTrend(trendData)
      setModelRanking(rankingData)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseInt(num) : num
    return n.toLocaleString()
  }

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`
  }

  const maxCostInTrend = Math.max(...dailyTrend.map((d) => d.costUsd), 1)
  const maxTokensInTrend = Math.max(
    ...dailyTrend.map((d) => parseInt(d.tokensInput) + parseInt(d.tokensOutput)),
    1
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载统计数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">使用统计</h1>
              <p className="text-sm text-muted-foreground">查看您的 Token 使用和成本分析</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['7', '30', '90'] as const).map((days) => (
              <Button
                key={days}
                variant={dateRange === days ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange(days)}
              >
                {days} 天
              </Button>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* 概览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总 Token 数</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overview?.totalTokens || '0')}</div>
              <p className="text-xs text-muted-foreground mt-1">累计使用量</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总请求数</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overview?.totalRequests || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">API 调用次数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总成本</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCost(overview?.totalCost || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">美元 (USD)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">模型数量</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.modelUsage.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">使用过的模型</p>
            </CardContent>
          </Card>
        </div>

        {/* 每日趋势图 */}
        <Card>
          <CardHeader>
            <CardTitle>Token 使用趋势</CardTitle>
            <CardDescription>最近 {dateRange} 天的 Token 消耗情况</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <div className="space-y-2">
                {dailyTrend.map((day) => {
                  const totalTokens = parseInt(day.tokensInput) + parseInt(day.tokensOutput)
                  const percentage = (totalTokens / maxTokensInTrend) * 100
                  return (
                    <div key={day.date} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{day.date}</span>
                        <span className="font-medium">{formatNumber(totalTokens)} tokens</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* 成本趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>成本趋势</CardTitle>
            <CardDescription>最近 {dateRange} 天的使用成本</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <div className="space-y-2">
                {dailyTrend.map((day) => {
                  const percentage = (day.costUsd / maxCostInTrend) * 100
                  return (
                    <div key={day.date} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{day.date}</span>
                        <span className="font-medium">{formatCost(day.costUsd)}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* 模型使用分布 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>模型使用分布</CardTitle>
              <CardDescription>各模型的成本占比</CardDescription>
            </CardHeader>
            <CardContent>
              {overview && overview.modelUsage.length > 0 ? (
                <div className="space-y-4">
                  {overview.modelUsage.map((model) => (
                    <div key={model.modelId} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate">{model.modelName}</span>
                        <span className="text-muted-foreground">{model.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                          style={{ width: `${model.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatNumber(model.tokensInput)} 输入</span>
                        <span>{formatNumber(model.tokensOutput)} 输出</span>
                        <span>{formatCost(model.costUsd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">暂无数据</div>
              )}
            </CardContent>
          </Card>

          {/* 模型排名 */}
          <Card>
            <CardHeader>
              <CardTitle>模型使用排名</CardTitle>
              <CardDescription>按总成本排序</CardDescription>
            </CardHeader>
            <CardContent>
              {modelRanking.length > 0 ? (
                <div className="space-y-3">
                  {modelRanking.map((model, index) => (
                    <div
                      key={model.modelId}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{model.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(model.totalTokens)} tokens · {model.requestCount} 次
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{formatCost(model.costUsd)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">暂无数据</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
