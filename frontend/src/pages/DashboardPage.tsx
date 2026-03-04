import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, FolderOpen, Hammer, Bot, ArrowRight, Cpu,
  Activity, ChevronRight, Terminal, Code2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, Badge, StatusBadge, SectionHeader, Button, ProgressBar } from '../components/ui'
import { apiClient, RunStatus } from '../api/client'

const codeLines = [
  '#include <stdio.h>',
  '#include "firmware.h"',
  '',
  'void setup() {',
  '  HAL_Init();',
  '  SystemClock_Config();',
  '  MX_GPIO_Init();',
  '  MX_USART2_Init();',
  '}',
  '',
  'int main(void) {',
  '  setup();',
  '  while (1) {',
  '    sensor_read();',
  '    process_data();',
  '    transmit_status();',
  '    HAL_Delay(100);',
  '  }',
  '}',
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRuns()
    const t = setInterval(loadRuns, 5000)
    return () => clearInterval(t)
  }, [])

  const loadRuns = async () => {
    try { setRuns(await apiClient.getRuns()) } catch {}
    finally { setLoading(false) }
  }

  const recentRuns = runs.slice(0, 5)
  const completedCount = runs.filter(r => r.status === 'completed').length
  const runningCount = runs.filter(r => ['running', 'queued', 'pending'].includes(r.status)).length
  const failedCount = runs.filter(r => r.status === 'failed').length

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-10">
        {/* Code animation background */}
        <div className="absolute top-0 right-0 w-[400px] h-full opacity-[0.04] pointer-events-none overflow-hidden select-none">
          <div className="font-mono text-[11px] leading-[1.8] text-white whitespace-pre pt-6 pr-6">
            {codeLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="code-line-appear"
              >
                {line}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
              <Cpu className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-white tracking-tight">ForgeMCU Studio</h1>
              <p className="text-[13px] text-[#666]">AI-Powered Firmware Generation</p>
            </div>
          </div>
          <p className="text-[14px] text-[#888] max-w-xl leading-relaxed mt-2">
            Generate production-grade embedded firmware using LangChain-powered AI agents.
            Architecture analysis, code generation, testing, and quality — all orchestrated through LangGraph.
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="primary" size="lg" onClick={() => navigate('/generate')}>
              <Zap className="w-4 h-4" /> New Generation
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/agents')}>
              <Bot className="w-4 h-4" /> View Agents
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Runs', value: runs.length, icon: Activity },
          { label: 'Completed', value: completedCount, icon: Code2 },
          { label: 'Running', value: runningCount, icon: Terminal },
          { label: 'Failed', value: failedCount, icon: Zap },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className="w-4 h-4 text-[#555]" />
                <span className="text-[24px] font-bold text-white tabular-nums">{stat.value}</span>
              </div>
              <p className="text-[12px] text-[#555]">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions + Recent Runs */}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="text-[13px] font-medium text-[#888] uppercase tracking-wider">Quick Actions</h3>
          {[
            { icon: Zap, title: 'Generate Firmware', to: '/generate' },
            { icon: FolderOpen, title: 'Browse Artifacts', to: '/artifacts' },
            { icon: Hammer, title: 'Build & Deploy', to: '/build' },
            { icon: Bot, title: 'Agent Pipeline', to: '/agents' },
          ].map((item) => (
            <Card
              key={item.title}
              hover
              className="flex items-center gap-3 p-3.5"
              onClick={() => navigate(item.to)}
            >
              <div className="w-8 h-8 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4 text-[#666]" />
              </div>
              <span className="flex-1 text-[13px] text-[#ccc]">{item.title}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#333]" />
            </Card>
          ))}
        </div>

        <div className="col-span-2">
          <SectionHeader
            title="Recent Runs"
            description="Latest firmware generation runs"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/build')}>
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            }
          />
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-11 rounded-lg" />)}
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="p-10 text-center text-[#555] text-[13px]">
                No runs yet. Start by generating firmware.
              </div>
            ) : (
              <div className="divide-y divide-[#1a1a1a]">
                {recentRuns.map((run) => (
                  <button
                    key={run.run_id}
                    className="flex items-center gap-4 px-5 py-3.5 w-full text-left hover:bg-[#111]/50 transition-colors duration-150"
                    onClick={() => navigate(`/build/${run.run_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-white font-mono">
                          {run.run_id}
                        </span>
                        <StatusBadge status={run.status} />
                      </div>
                      {run.message && (
                        <p className="text-[12px] text-[#555] truncate mt-0.5">{run.message}</p>
                      )}
                    </div>
                    <div className="w-24">
                      <ProgressBar value={run.progress || 0} />
                    </div>
                    <span className="text-[11px] text-[#444] font-mono w-10 text-right">
                      {run.progress || 0}%
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#333]" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
