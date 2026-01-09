import { useState, useMemo } from 'react'
import { 
  Plus, MessageSquare, Archive, LogOut, ChevronLeft, 
  Search, Trash2, Key, Bot, BarChart3, Share2, ArchiveRestore,
  MoreHorizontal
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ThemeSwitcher } from './ThemeSwitcher'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import type { Session } from '@ai-chat-hub/shared'

interface SidebarProps {
  onNewChat: () => void
  onSelectSession: (session: Session) => void
  onDeleteSession: (sessionId: string) => void
  onArchiveSession: (sessionId: string) => void
  onUnarchiveSession: (sessionId: string) => void
  onShareSession: (sessionId: string) => void
  onLogout: () => void
}

export function Sidebar({ 
  onNewChat, 
  onSelectSession, 
  onDeleteSession, 
  onArchiveSession, 
  onUnarchiveSession, 
  onShareSession, 
  onLogout 
}: SidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { sessions, currentSession, sidebarOpen, toggleSidebar } = useChatStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  // 过滤和分组会话
  const groupedSessions = useMemo(() => {
    const filtered = sessions.filter(session => {
      const matchesSearch = !searchQuery || 
        session.title?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesArchived = showArchived ? !!session.archivedAt : !session.archivedAt
      return matchesSearch && matchesArchived
    })

    const groups: Record<string, Session[]> = {}
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    filtered.forEach(session => {
      const date = new Date(session.updatedAt)
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
    })

    return groups
  }, [sessions, searchQuery, showArchived])

  // 收缩状态的侧边栏
  if (!sidebarOpen) {
    return (
      <aside className="w-[72px] h-full flex-shrink-0 bg-secondary/30 backdrop-blur-xl border-r border-border/40 flex flex-col items-center py-4 gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 mb-2">
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-lg w-10 h-10 hover:bg-accent"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </Button>
        
        <div className="flex-1" />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="rounded-xl w-10 h-10 bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </aside>
    )
  }

  // 展开状态的侧边栏
  return (
    <aside className="w-72 h-full flex-shrink-0 bg-secondary/30 backdrop-blur-xl border-r border-border/40 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">AI-Chat</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-lg w-8 h-8 hover:bg-accent"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 mb-3 flex-shrink-0">
        <Button
          onClick={onNewChat}
          className="w-full h-11 justify-start gap-3 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">新对话</span>
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 mb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/30 border-border/50 rounded-lg"
          />
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 px-3">
        <div className="py-2 space-y-4">
          {Object.entries(groupedSessions).map(([group, groupSessions]) => (
            <div key={group}>
              <p className="px-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group}
              </p>
              <div className="space-y-1">
                {groupSessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={currentSession?.id === session.id}
                    onSelect={() => onSelectSession(session)}
                    onShare={() => onShareSession(session.id)}
                    onArchive={() => session.archivedAt 
                      ? onUnarchiveSession(session.id) 
                      : onArchiveSession(session.id)
                    }
                    onDelete={() => onDeleteSession(session.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          
          {Object.keys(groupedSessions).length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? '没有找到匹配的会话' : '暂无会话'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border/40 space-y-2 flex-shrink-0">
        {/* Actions */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-9 justify-start gap-2 px-3 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            <span className="text-sm">{showArchived ? '活动会话' : '归档'}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-9 justify-start gap-2 px-3 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/stats')}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">使用统计</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-9 justify-start gap-2 px-3 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/keys')}
          >
            <Key className="w-4 h-4" />
            <span className="text-sm">API 密钥</span>
          </Button>
          <ThemeSwitcher />
        </div>

        {/* User */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-accent/30">
          <Avatar className="w-9 h-9 rounded-lg">
            <AvatarImage src={user?.avatarUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm rounded-lg">
              {user?.nickname?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.nickname || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-muted-foreground">Free Plan</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}

// Session Item Component
interface SessionItemProps {
  session: Session
  isActive: boolean
  onSelect: () => void
  onShare: () => void
  onArchive: () => void
  onDelete: () => void
}

function SessionItem({ session, isActive, onSelect, onShare, onArchive, onDelete }: SessionItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
      onClick={onSelect}
    >
      <MessageSquare className={cn(
        "w-4 h-4 flex-shrink-0",
        isActive ? "text-primary" : "text-muted-foreground/50"
      )} />
      <span className="flex-1 truncate text-sm">
        {session.title || '新对话'}
      </span>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {!session.archivedAt && (
            <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onShare(); }}>
              <Share2 className="w-4 h-4 mr-2" />
              分享
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onArchive(); }}>
            {session.archivedAt ? (
              <>
                <ArchiveRestore className="w-4 h-4 mr-2" />
                取消归档
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 mr-2" />
                归档
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
