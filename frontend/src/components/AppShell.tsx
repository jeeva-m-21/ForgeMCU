import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Zap, FolderOpen, Hammer, Bot,
  ChevronLeft, ChevronRight, Cpu, Circle,
} from 'lucide-react'
import { useHealthCheck } from '../hooks/useHealthCheck'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/generate', icon: Zap, label: 'Generate' },
  { to: '/artifacts', icon: FolderOpen, label: 'Artifacts' },
  { to: '/build', icon: Hammer, label: 'Build' },
  { to: '/agents', icon: Bot, label: 'Agents' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const location = useLocation()
  const { healthy, checking } = useHealthCheck()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black">
      {/* Sidebar */}
      <aside
        className={clsx(
          'flex flex-col border-r border-[#1a1a1a] bg-black transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex-shrink-0',
          collapsed ? 'w-[56px]' : 'w-[200px]'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 h-[52px] border-b border-[#1a1a1a] flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center flex-shrink-0">
            <Cpu className="w-3.5 h-3.5 text-black" />
          </div>
          {!collapsed && (
            <span className="text-[13px] font-semibold text-white tracking-tight truncate">
              ForgeMCU
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={clsx(
                  'flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13px] transition-all duration-150 relative group',
                  isActive
                    ? 'bg-[#111] text-white font-medium'
                    : 'text-[#888] hover:text-white hover:bg-[#111]/50'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={clsx('w-[16px] h-[16px] flex-shrink-0', isActive ? 'text-white' : 'text-[#666]')} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-[#1a1a1a] p-2 space-y-1">
          {/* Status indicator */}
          <div className={clsx('flex items-center gap-2 px-2.5 py-2 text-[11px]', collapsed ? 'justify-center' : '')}>
            <Circle
              className={clsx(
                'w-[6px] h-[6px] flex-shrink-0',
                checking ? 'text-[#666] fill-[#666] animate-pulse-soft'
                  : healthy ? 'text-white fill-white'
                  : 'text-[#444] fill-[#444]'
              )}
            />
            {!collapsed && (
              <span className="text-[#666]">
                {checking ? 'Connecting...' : healthy ? 'Connected' : 'Offline'}
              </span>
            )}
          </div>

          {/* Collapse */}
          <button
            onClick={() => setCollapsed(v => !v)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#666] hover:text-white hover:bg-[#111]/50 w-full transition-all text-[11px]"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-[52px] flex items-center justify-between px-6 border-b border-[#1a1a1a] bg-black flex-shrink-0">
          <Breadcrumb />
          <div className="flex items-center gap-3 text-[12px] text-[#555] font-mono">
            <span>LangGraph v2</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-black">
          <div className="animate-fade-in p-6">
            {children}
          </div>
        </main>

        {/* Status bar */}
        <footer className="h-[28px] flex items-center justify-between px-4 border-t border-[#1a1a1a] bg-black text-[11px] text-[#444] flex-shrink-0 font-mono">
          <div className="flex items-center gap-4">
            <span>ForgeMCU Studio</span>
            <span className="text-[#222]">·</span>
            <span>LangChain + LangGraph</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Port 8000</span>
            <span className="text-[#222]">·</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Breadcrumb() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  const labels: Record<string, string> = {
    generate: 'Generate',
    artifacts: 'Artifacts',
    build: 'Build',
    agents: 'Agents',
  }

  if (segments.length === 0) {
    return <span className="text-[13px] text-[#888]">Dashboard</span>
  }

  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <NavLink to="/" className="text-[#555] hover:text-white transition-colors duration-150">
        Home
      </NavLink>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          <span className="text-[#333]">/</span>
          <span className={i === segments.length - 1 ? 'text-white' : 'text-[#555]'}>
            {labels[seg] || seg}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}
