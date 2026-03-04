import React, { useEffect, useState } from 'react'
import {
  Bot, Cpu, Code2, Shield, TestTube, Hammer,
  ArrowRight, Zap, GitBranch, Layers,
} from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { Card, Badge, SectionHeader } from '../components/ui'

interface AgentInfo {
  name: string
  role: string
  description: string
  capabilities: string[]
  status: string
}

interface StackInfo {
  orchestrator: string
  llm_framework: string
  agents: string[]
  features: string[]
}

const agentIcons: Record<string, React.ReactNode> = {
  'Architecture Agent': <Layers className="w-5 h-5" />,
  'Code Agent': <Code2 className="w-5 h-5" />,
  'Test Agent': <TestTube className="w-5 h-5" />,
  'Quality Agent': <Shield className="w-5 h-5" />,
  'Build Agent': <Hammer className="w-5 h-5" />,
}

const pipelineStages = [
  { name: 'Architecture', desc: 'System design & analysis' },
  { name: 'Code', desc: 'Firmware generation' },
  { name: 'Test', desc: 'Test suite creation' },
  { name: 'Quality', desc: 'Static analysis & MISRA' },
  { name: 'Build', desc: 'Compilation & linking' },
]

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [stack, setStack] = useState<StackInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get('http://localhost:8000/api/agents').then(r => setAgents(r.data)).catch(() => {}),
      axios.get('http://localhost:8000/api/stack').then(r => setStack(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-[22px] font-bold text-white tracking-tight">Agent Pipeline</h1>
        <p className="text-[13px] text-[#666] mt-1">LangGraph-orchestrated AI agent architecture</p>
      </div>

      {/* Pipeline Visualization */}
      <Card className="p-6">
        <span className="text-[11px] font-medium text-[#555] uppercase tracking-wider">Pipeline Flow</span>
        <div className="flex items-center justify-between mt-5 px-4">
          {pipelineStages.map((stage, i) => (
            <React.Fragment key={stage.name}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center group hover:border-[#444] hover:bg-[#1a1a1a] transition-all">
                  <span className="text-[#888] group-hover:text-white transition-colors">
                    {agentIcons[`${stage.name} Agent`] || <Bot className="w-5 h-5" />}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-[12px] text-white font-medium">{stage.name}</p>
                  <p className="text-[10px] text-[#555]">{stage.desc}</p>
                </div>
              </motion.div>
              {i < pipelineStages.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: i * 0.1 + 0.05 }}
                  className="flex-1 flex items-center justify-center -mt-6"
                >
                  <div className="h-px bg-[#222] flex-1" />
                  <ArrowRight className="w-3 h-3 text-[#333] mx-1 flex-shrink-0" />
                  <div className="h-px bg-[#222] flex-1" />
                </motion.div>
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        {/* Agent Cards */}
        <div className="col-span-2 space-y-3">
          <SectionHeader title="Agents" description="Individual agent capabilities" />
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
          ) : agents.length === 0 ? (
            // Fallback to static data
            <div className="space-y-3">
              {[
                { name: 'Architecture Agent', role: 'System Architect', description: 'Analyzes requirements and designs system architecture with module decomposition, data flow, and hardware abstraction layers.', capabilities: ['System decomposition', 'HAL design', 'Memory layout', 'Interrupt mapping'] },
                { name: 'Code Agent', role: 'Firmware Developer', description: 'Generates production-grade C firmware code with proper initialization, error handling, and documentation.', capabilities: ['C code generation', 'HAL implementation', 'Driver modules', 'Main loop logic'] },
                { name: 'Test Agent', role: 'Test Engineer', description: 'Creates comprehensive test suites including unit tests, integration tests, and hardware-in-the-loop stubs.', capabilities: ['Unit tests', 'Integration tests', 'Mock drivers', 'Coverage analysis'] },
                { name: 'Quality Agent', role: 'Quality Analyst', description: 'Performs static analysis, MISRA compliance checking, and generates quality metrics and reports.', capabilities: ['MISRA compliance', 'Static analysis', 'Complexity metrics', 'Code review'] },
                { name: 'Build Agent', role: 'Build Engineer', description: 'Handles compilation with arm-none-eabi-gcc, manages Makefiles, linker scripts, and binary output.', capabilities: ['Cross-compilation', 'Linker scripts', 'Binary generation', 'Size optimization'] },
              ].map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center flex-shrink-0 text-[#666]">
                        {agentIcons[agent.name] || <Bot className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium text-white">{agent.name}</span>
                          <Badge variant="default">{agent.role}</Badge>
                        </div>
                        <p className="text-[12px] text-[#666] mb-2">{agent.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.capabilities.map(cap => (
                            <span key={cap} className="text-[10px] px-2 py-0.5 rounded bg-[#111] text-[#555] border border-[#1a1a1a]">
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center flex-shrink-0 text-[#666]">
                        {agentIcons[agent.name] || <Bot className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium text-white">{agent.name}</span>
                          <Badge variant="default">{agent.role}</Badge>
                          <Badge variant={agent.status === 'active' ? 'success' : 'default'}>{agent.status}</Badge>
                        </div>
                        <p className="text-[12px] text-[#666] mb-2">{agent.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.capabilities.map(cap => (
                            <span key={cap} className="text-[10px] px-2 py-0.5 rounded bg-[#111] text-[#555] border border-[#1a1a1a]">
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Tech Stack Sidebar */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-[#555]" />
              <span className="text-[12px] font-medium text-[#888]">Tech Stack</span>
            </div>
            <div className="space-y-3 text-[12px]">
              <div>
                <span className="text-[#555] block mb-1">Orchestrator</span>
                <span className="text-white font-mono">{stack?.orchestrator || 'LangGraph'}</span>
              </div>
              <div>
                <span className="text-[#555] block mb-1">LLM Framework</span>
                <span className="text-white font-mono">{stack?.llm_framework || 'LangChain'}</span>
              </div>
              {stack?.features && (
                <div>
                  <span className="text-[#555] block mb-1">Features</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {stack.features.map(f => (
                      <span key={f} className="text-[10px] px-2 py-0.5 rounded bg-[#111] text-[#555] border border-[#1a1a1a]">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-[#555]" />
              <span className="text-[12px] font-medium text-[#888]">Architecture</span>
            </div>
            <pre className="text-[10px] font-mono text-[#555] leading-[1.8] whitespace-pre">
{`┌─────────────────────┐
│   LangGraph State   │
│     Orchestrator    │
└────────┬────────────┘
         │
    ┌────▼────┐
    │  Arch   │
    │  Agent  │
    └────┬────┘
         │
    ┌────▼────┐
    │  Code   │
    │  Agent  │
    └────┬────┘
         │
    ┌────▼────┐
    │  Test   │
    │  Agent  │
    └────┬────┘
         │
    ┌────▼────┐
    │ Quality │
    │  Agent  │
    └────┬────┘
         │
    ┌────▼────┐
    │  Build  │
    │  Agent  │
    └─────────┘`}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  )
}
