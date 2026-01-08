import { useState } from 'react'
import { Plus, MessageSquare, Archive, Settings, LogOut, ChevronLeft, Search, MoreHorizontal, Trash2, Edit3, Key, Bot } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ThemeSwitcher } from './ThemeSwitcher'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import type { Session } from '@ai-chat-hub/shared'

interface SidebarProps {
  onNewChat: () => void
  onSelectSession: (session: Session) => void
  onDeleteSession: (sessionId: string) => void
  onLogout: () => void
}

export function Sidebar({ onNewChat, onSelectSession, onDeleteSession, onLogout }: SidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { sessions, currentSession, sidebarOpen, toggleSidebar } = useChatStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const filteredSessions = sessions.filter(
    (session) =>
      !searchQuery ||
      session.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 按日期分组
  const groupedSessions = filteredSessions.reduce(
    (groups, session) => {
      const date = new Date(session.updatedAt)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)

      let group: string
      if (date.toDateString() === today.toDateString()) {
        group = '今天'
      } else if (date.toDateString() === yesterday.toDateString()) {
        group = '昨天'
      } else if (date > weekAgo) {
        group = '最近 7 天'
      } else {
        group = '更早'
      }

      if (!groups[group]) groups[group] = []
      groups[group].push(session)
      return groups
    },
    {} as Record<string, Session[]>
  )

  if (!sidebarOpen) {
    return (
      <div className="w-16 bg-secondary/30 backdrop-blur-xl border-r border-border/40 flex flex-col items-center py-6 gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 mb-2">
          <Bot className="w-6 h-6 text-primary-foreground" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-full w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="rounded-full w-10 h-10 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="w-72 bg-secondary/30 backdrop-blur-xl border-r border-border/40 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <span>AI-Chat</span>
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="px-4 mb-4">
        <Button
          onClick={onNewChat}
          className={cn(
            "w-full h-12 justify-start gap-3 px-4 rounded-2xl transition-all duration-300",
            "bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20",
            "hover:scale-[1.02] active:scale-95 border-0"
          )}
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold text-[15px]">新 对 话</span>
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 mb-2">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="搜索会话记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-muted/20 border-border/50 rounded-xl focus:bg-muted/40 focus:ring-4 focus:ring-primary/5 transition-all"
          />
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 px-3">
        <div className="py-4 space-y-6">
          {Object.entries(groupedSessions).map(([group, groupSessions]) => (
            <div key={group} className="space-y-2">
              <p className="px-3 text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">
                {group}
              </p>
              <div className="space-y-1">
                {groupSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200',
                      currentSession?.id === session.id
                        ? 'bg-accent/80 text-foreground shadow-sm ring-1 ring-border/50'
                        : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                    )}
                    onClick={() => onSelectSession(session)}
                    onMouseEnter={() => setHoveredId(session.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <MessageSquare className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      currentSession?.id === session.id ? "text-primary" : "text-muted-foreground/40 group-hover:text-primary/60"
                    )} />
                    <span className="truncate flex-1 text-[13.5px] font-medium">
                      {session.title || '新对话'}
                    </span>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSession(session.id)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 mt-auto border-t border-border/40 space-y-4 bg-muted/10 backdrop-blur-sm">
        {/* Actions */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-10 justify-start gap-3 px-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={() => navigate('/keys')}
          >
            <Key className="w-4 h-4" />
            <span className="text-sm font-medium">API 密钥管理</span>
          </Button>
          <ThemeSwitcher />
        </div>

        {/* User Section */}
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-accent/30 ring-1 ring-border/20">
          <Avatar className="w-10 h-10 rounded-xl border border-border/50">
            <AvatarImage src={user?.avatarUrl || undefined} className="rounded-xl" />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold rounded-xl">
              {user?.nickname?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate leading-tight">
              {user?.nickname || user?.email?.split('@')[0]}
            </p>
            <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-medium">
              Free Plan
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
