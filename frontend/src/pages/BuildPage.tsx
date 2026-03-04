import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Hammer, RefreshCw, FileCode, Terminal,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
  Activity, Loader2, AlertTriangle, Cpu, Package,
  FileText, Gauge, Shield, Bug, Zap, HardDrive,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { Card, Badge, StatusBadge, Button, ProgressBar, EmptyState } from '../components/ui'
import { apiClient, RunStatus, RunLogs } from '../api/client'

type Tab = 'overview' | 'build' | 'tests' | 'deploy'

/* ─── helpers ─── */
const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`)
const fmtTime = (ts: string) => {
  try { return new Date(ts).toLocaleString() } catch { return ts }
}
const shortPath = (p: string) => {
  const parts = p.split('/')
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : p
}

const compilationStatusColor = (s: string) => {
  if (s === 'success' || s === 'passed') return 'text-emerald-400'
  if (s === 'partial_success') return 'text-amber-400'
  if (s === 'failed') return 'text-red-400'
  return 'text-[#888]'
}
const compilationStatusBg = (s: string) => {
  if (s === 'success' || s === 'passed') return 'bg-emerald-400/10 border-emerald-400/20'
  if (s === 'partial_success') return 'bg-amber-400/10 border-amber-400/20'
  if (s === 'failed') return 'bg-red-400/10 border-red-400/20'
  return 'bg-[#111] border-[#222]'
}
const compilationStatusIcon = (s: string) => {
  if (s === 'success' || s === 'passed') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
  if (s === 'partial_success') return <AlertTriangle className="w-4 h-4 text-amber-400" />
  if (s === 'failed') return <XCircle className="w-4 h-4 text-red-400" />
  return <Clock className="w-4 h-4 text-[#555]" />
}
const metricStatusColor = (s: string) => {
  if (s === 'pass') return 'text-emerald-400'
  if (s === 'warning') return 'text-amber-400'
  if (s === 'fail') return 'text-red-400'
  return 'text-[#888]'
}
const metricIcon = (key: string) => {
  const map: Record<string, React.ReactNode> = {
    code_coverage: <Shield className="w-3.5 h-3.5" />,
    cyclomatic_complexity: <Activity className="w-3.5 h-3.5" />,
    misra_violations: <Bug className="w-3.5 h-3.5" />,
    memory_issues: <HardDrive className="w-3.5 h-3.5" />,
    lines_of_code: <FileText className="w-3.5 h-3.5" />,
    documentation_coverage: <FileText className="w-3.5 h-3.5" />,
    dead_code: <Zap className="w-3.5 h-3.5" />,
    code_duplication: <Package className="w-3.5 h-3.5" />,
  }
  return map[key] || <Gauge className="w-3.5 h-3.5" />
}

/* ─── Module Error Accordion ─── */
function ModuleErrorPanel({ error }: { error: string }) {
  const [open, setOpen] = useState(false)
  // Extract just the first error line for summary
  const lines = error.split('\n').filter(l => l.trim())
  const firstError = lines.find(l => l.includes('error:')) || lines[0] || ''
  const shortError = firstError.length > 120 ? firstError.slice(0, 120) + '…' : firstError

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-red-400/80 hover:text-red-400 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-mono truncate max-w-[340px]">{shortError}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="mt-2 p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] text-[10px] font-mono text-[#888] leading-relaxed max-h-[200px] overflow-auto whitespace-pre-wrap break-all">
              {error}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Build Summary Section ─── */
function BuildSummary({ log }: { log: any }) {
  const status = log.compilation_status || log.compilation_details?.status || 'unknown'
  const compiler = log.compiler || log.compilation_details?.compiler || '—'
  const compiled = log.modules_compiled ?? 0
  const total = log.total_modules ?? 0
  const pct = total > 0 ? Math.round((compiled / total) * 100) : 0

  return (
    <div className={`p-4 rounded-lg border ${compilationStatusBg(status)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {compilationStatusIcon(status)}
          <div>
            <span className={`text-[13px] font-semibold capitalize ${compilationStatusColor(status)}`}>
              {status.replace(/_/g, ' ')}
            </span>
            <p className="text-[11px] text-[#666] mt-0.5">
              {log.build_type?.replace(/_/g, ' ') || 'Compilation'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[18px] font-bold text-white">{compiled}<span className="text-[#555]">/{total}</span></span>
            <p className="text-[10px] text-[#555]">modules compiled</p>
          </div>
          <div className="w-16 h-16 relative">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1a1a1a" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={status === 'success' ? '#34d399' : status === 'partial_success' ? '#fbbf24' : '#f87171'}
                strokeWidth="3"
                strokeDasharray={`${pct * 0.942} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
              {pct}%
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-[#555]" />
          <span className="text-[11px] text-[#888] font-mono">{compiler}</span>
        </div>
        {log.timestamp && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-[#555]" />
            <span className="text-[11px] text-[#666]">{fmtTime(log.timestamp)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Module Cards Grid ─── */
function ModuleCards({ log }: { log: any }) {
  const modules = log.modules || {}
  const compDetails = log.compilation_details?.modules || {}

  if (Object.keys(modules).length === 0 && Object.keys(compDetails).length === 0) return null

  // Merge module info + compilation status
  const allModuleNames = [...new Set([...Object.keys(modules), ...Object.keys(compDetails)])]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="w-3.5 h-3.5 text-[#555]" />
        <span className="text-[11px] font-medium text-[#888] uppercase tracking-wider">Modules</span>
        <span className="text-[10px] text-[#444]">({allModuleNames.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {allModuleNames.map(name => {
          const mod = modules[name] || {}
          const comp = compDetails[name] || {}
          const status = comp.status || 'unknown'
          const hasError = comp.error && comp.error.length > 0

          return (
            <div
              key={name}
              className={`p-3 rounded-lg border transition-colors ${
                status === 'success' || status === 'passed'
                  ? 'bg-[#0a0a0a] border-emerald-400/10'
                  : status === 'failed'
                  ? 'bg-[#0a0a0a] border-red-400/10'
                  : 'bg-[#0a0a0a] border-[#1a1a1a]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === 'success' || status === 'passed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : status === 'failed' ? (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-[#555]" />
                  )}
                  <span className="text-[12px] font-mono font-medium text-white">{name}</span>
                  <span className={`text-[10px] capitalize ${compilationStatusColor(status)}`}>
                    {status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {mod.header_size != null && (
                    <span className="text-[10px] text-[#555]">.h {fmtBytes(mod.header_size)}</span>
                  )}
                  {mod.source_size != null && (
                    <span className="text-[10px] text-[#555]">.c {fmtBytes(mod.source_size)}</span>
                  )}
                </div>
              </div>
              {/* File paths */}
              {(mod.header || mod.source) && (
                <div className="flex items-center gap-3 mt-1.5">
                  {mod.header && (
                    <span className="text-[10px] text-[#444] font-mono">{shortPath(mod.header)}</span>
                  )}
                  {mod.source && (
                    <span className="text-[10px] text-[#444] font-mono">{shortPath(mod.source)}</span>
                  )}
                </div>
              )}
              {/* Error details */}
              {hasError && <ModuleErrorPanel error={comp.error} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Unit Tests Section ─── */
function UnitTestsSection({ tests }: { tests: any }) {
  if (!tests || typeof tests !== 'object') return null

  const allPassed = tests.all_passed ?? false
  const testModules = tests.test_modules || {}
  const testEntries = Object.entries(testModules)

  if (testEntries.length === 0) return null

  const passedCount = testEntries.filter(([, v]: any) => v.passed).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-3.5 h-3.5 text-[#555]" />
          <span className="text-[11px] font-medium text-[#888] uppercase tracking-wider">Unit Tests</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${allPassed ? 'text-emerald-400' : 'text-red-400'}`}>
            {passedCount}/{testEntries.length} passed
          </span>
        </div>
      </div>

      {testEntries.map(([key, val]: any) => (
        <div
          key={key}
          className={`p-3 rounded-lg border ${val.passed ? 'bg-[#0a0a0a] border-emerald-400/10' : 'bg-[#0a0a0a] border-red-400/10'}`}
        >
          <div className="flex items-center gap-2">
            {val.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className="text-[11px] font-mono text-[#888] truncate max-w-[300px]">
              {key.replace(/^\d{8}T\d{6}Z_/, '').replace(/-/g, '…')}
            </span>
            <span className={`text-[10px] ${val.passed ? 'text-emerald-400' : 'text-red-400'}`}>
              {val.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>
          {val.error && (
            <p className="mt-1.5 text-[10px] text-red-400/70 font-mono">{val.error}</p>
          )}
          {val.compile_output && (
            <ModuleErrorPanel error={val.compile_output} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Build Notes Section ─── */
function BuildNotes({ notes }: { notes: string[] }) {
  if (!notes || notes.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-[#555]" />
        <span className="text-[11px] font-medium text-[#888] uppercase tracking-wider">Notes</span>
      </div>
      <div className="space-y-1">
        {notes.map((note, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px]">
            <span className="text-[#333] mt-0.5">•</span>
            <span className="text-[#666]">{note}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Quality Report Section ─── */
function QualityReportView({ report }: { report: any }) {
  const data = report?.data || report || {}
  const overall = data.overall_score ?? null
  const metrics = data.metrics || {}
  const recommendations = data.recommendations || []
  const analysisSummary = data.analysis_summary || {}
  const notes = data.notes || []

  const metricEntries = Object.entries(metrics)

  // Determine ring color for overall score
  const scoreColor = overall != null
    ? overall >= 80 ? '#34d399' : overall >= 60 ? '#fbbf24' : '#f87171'
    : '#555'

  return (
    <div className="space-y-5 p-5">
      {/* Score + Summary Header */}
      {overall != null && (
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 relative flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={scoreColor}
                strokeWidth="2.5"
                strokeDasharray={`${overall * 0.942} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[16px] font-bold text-white">
              {overall}
            </span>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white">Quality Score</h3>
            <p className="text-[11px] text-[#666] mt-0.5">
              {data.report_type?.replace(/_/g, ' ') || 'Code quality analysis'}
              {data.focus ? ` · ${data.focus.replace(/_/g, ' ')}` : ''}
            </p>
            {analysisSummary.modules_analyzed != null && (
              <p className="text-[10px] text-[#555] mt-1">
                {analysisSummary.modules_analyzed} modules · {analysisSummary.total_lines || '?'} lines · {analysisSummary.test_files_found || 0} test files
              </p>
            )}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {metricEntries.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-[#888] uppercase tracking-wider">Metrics</span>
          <div className="grid grid-cols-2 gap-2">
            {metricEntries.map(([key, val]: any) => (
              <div key={key} className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={metricStatusColor(val.status)}>{metricIcon(key)}</span>
                  <div>
                    <span className="text-[11px] text-[#888] capitalize">{key.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[14px] font-bold text-white">{val.value}</span>
                      {val.unit && <span className="text-[10px] text-[#555]">{val.unit}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {val.target != null && (
                    <span className="text-[10px] text-[#444]">target: {val.target}{typeof val.target === 'number' && val.unit ? val.unit : ''}</span>
                  )}
                  <div className={`text-[10px] font-medium uppercase ${metricStatusColor(val.status)}`}>
                    {val.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-[#888] uppercase tracking-wider">Recommendations</span>
          <div className="space-y-1.5">
            {recommendations.map((rec: string, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#0a0a0a]">
                <span className="text-amber-400/60 mt-0.5 text-[10px]">→</span>
                <span className="text-[11px] text-[#888]">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-[#555] uppercase tracking-wider">Notes</span>
          {notes.map((n: string, i: number) => (
            <p key={i} className="text-[10px] text-[#555]">• {n}</p>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main BuildPage ─── */
export default function BuildPage() {
  const { runId: paramRunId } = useParams()
  const navigate = useNavigate()

  const [runs, setRuns] = useState<RunStatus[]>([])
  const [selectedRun, setSelectedRun] = useState<RunStatus | null>(null)
  const [logs, setLogs] = useState<RunLogs | null>(null)
  const [buildLog, setBuildLog] = useState<any>(null)
  const [qualityReport, setQualityReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    loadAll()
    const t = setInterval(loadAll, 4000)
    return () => clearInterval(t)
  }, [paramRunId])

  const loadAll = async () => {
    try {
      const allRuns = await apiClient.getRuns()
      setRuns(allRuns)
      const target = paramRunId ? allRuns.find(r => r.run_id === paramRunId) : allRuns[0]
      if (target) {
        setSelectedRun(target)
        try { setLogs(await apiClient.getRunLogs(target.run_id)) } catch {}
        // Build log
        try {
          const bl = await axios.get(`http://localhost:8000/api/output/${target.run_id}/build_log/build_log.json`)
          setBuildLog(bl.data?.content ? JSON.parse(bl.data.content) : bl.data)
        } catch { setBuildLog(null) }
        // Quality report
        try {
          const qr = await axios.get(`http://localhost:8000/api/output/${target.run_id}/reports/quality_report_latest.json`)
          setQualityReport(qr.data?.content ? JSON.parse(qr.data.content) : qr.data)
        } catch { setQualityReport(null) }
      }
    } catch {}
    finally { setLoading(false) }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-3 h-3" /> },
    { id: 'build', label: 'Build Log', icon: <Terminal className="w-3 h-3" /> },
    { id: 'tests', label: 'Quality', icon: <Shield className="w-3 h-3" /> },
    { id: 'deploy', label: 'Deploy', icon: <Zap className="w-3 h-3" /> },
  ]

  const run = selectedRun

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle2 className="w-4 h-4 text-white" />
    if (s === 'failed') return <XCircle className="w-4 h-4 text-[#888]" />
    if (s === 'running') return <Loader2 className="w-4 h-4 animate-spin text-[#888]" />
    return <Clock className="w-4 h-4 text-[#555]" />
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Build & Deploy</h1>
          <p className="text-[13px] text-[#666] mt-1">Monitor compilation, tests, and deployment</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadAll}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Run List Sidebar */}
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-[#555] uppercase tracking-wider">Runs</span>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : runs.length === 0 ? (
            <p className="text-[12px] text-[#444]">No runs yet</p>
          ) : (
            runs.slice(0, 15).map(r => (
              <button
                key={r.run_id}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  run?.run_id === r.run_id
                    ? 'bg-[#111] border-[#333]'
                    : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#222]'
                }`}
                onClick={() => navigate(`/build/${r.run_id}`)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-[#888] truncate max-w-[100px]">{r.run_id}</span>
                  {statusIcon(r.status)}
                </div>
                <ProgressBar value={r.progress || 0} />
              </button>
            ))
          )}
        </div>

        {/* Main Content */}
        <div className="col-span-3 space-y-4">
          {!run ? (
            <EmptyState
              icon={Hammer}
              title="No run selected"
              description="Select a run from the sidebar or generate firmware first"
              action={<Button variant="primary" onClick={() => navigate('/generate')}>Generate</Button>}
            />
          ) : (
            <>
              {/* Run Header */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-mono font-semibold text-white">{run.run_id}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/artifacts`)}>
                    <FileCode className="w-3.5 h-3.5" /> Artifacts
                  </Button>
                </div>
                <ProgressBar value={run.progress || 0} />
                <div className="flex items-center gap-4 mt-3 text-[11px] text-[#555]">
                  {run.current_stage && <span>Stage: <span className="text-[#888]">{run.current_stage}</span></span>}
                  {run.message && <span>{run.message}</span>}
                </div>
                {run.artifacts && (
                  <div className="flex gap-3 mt-3">
                    {Object.entries(run.artifacts).map(([cat, count]) => (
                      <div key={cat} className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#555] capitalize">{cat}</span>
                        <Badge variant="default" className="text-[10px]">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {run.errors && run.errors.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-[#111] border border-[#1a1a1a]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3 h-3 text-[#888]" />
                      <span className="text-[11px] font-medium text-[#888]">Errors</span>
                    </div>
                    {run.errors.map((e, i) => (
                      <p key={i} className="text-[11px] text-[#666] font-mono">{e}</p>
                    ))}
                  </div>
                )}
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-[#1a1a1a]">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                      tab === t.id
                        ? 'text-white border-white'
                        : 'text-[#555] border-transparent hover:text-[#888]'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                {tab === 'overview' && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <span className="text-[11px] text-[#555] uppercase tracking-wider">Pipeline</span>
                      <div className="mt-3 space-y-2">
                        {['architecture', 'code', 'test', 'quality', 'build'].map((stage) => {
                          const isDone = run.artifacts && (run.artifacts as any)[stage === 'test' ? 'tests' : stage] > 0
                          const isCurrent = run.current_stage?.toLowerCase().includes(stage)
                          return (
                            <div key={stage} className="flex items-center gap-2">
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              ) : isCurrent ? (
                                <Loader2 className="w-3.5 h-3.5 text-[#888] animate-spin" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-[#333]" />
                              )}
                              <span className={`text-[12px] capitalize ${isDone ? 'text-white' : isCurrent ? 'text-[#888]' : 'text-[#444]'}`}>
                                {stage}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <span className="text-[11px] text-[#555] uppercase tracking-wider">Info</span>
                      <div className="mt-3 space-y-2 text-[12px]">
                        <div className="flex justify-between">
                          <span className="text-[#555]">Status</span>
                          <span className="text-white capitalize">{run.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#555]">Progress</span>
                          <span className="text-white">{run.progress}%</span>
                        </div>
                        {run.started_at && (
                          <div className="flex justify-between">
                            <span className="text-[#555]">Started</span>
                            <span className="text-[#888] font-mono text-[11px]">{run.started_at}</span>
                          </div>
                        )}
                        {run.output_dir && (
                          <div className="flex justify-between">
                            <span className="text-[#555]">Output</span>
                            <span className="text-[#888] font-mono text-[11px] truncate max-w-[160px]">{run.output_dir}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                )}

                {tab === 'build' && (
                  <Card className="p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-[#555]" />
                        <span className="text-[12px] text-[#888]">Build Output</span>
                      </div>
                      {buildLog && (
                        <span className={`text-[10px] font-medium uppercase ${compilationStatusColor(buildLog.compilation_status || '')}`}>
                          {(buildLog.compilation_status || '').replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {buildLog ? (
                      <div className="p-5 space-y-5 max-h-[600px] overflow-auto">
                        <BuildSummary log={buildLog} />
                        <ModuleCards log={buildLog} />
                        <UnitTestsSection tests={buildLog.unit_tests} />
                        <BuildNotes notes={buildLog.notes} />
                        {/* Compilation errors summary */}
                        {buildLog.compilation_details?.errors?.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400/60" />
                              <span className="text-[11px] font-medium text-[#888] uppercase tracking-wider">
                                Compilation Errors ({buildLog.compilation_details.errors.length})
                              </span>
                            </div>
                            {buildLog.compilation_details.errors.map((err: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-[#0a0a0a] border border-red-400/10">
                                <div className="flex items-center gap-2 mb-1">
                                  <XCircle className="w-3 h-3 text-red-400" />
                                  <span className="text-[11px] font-mono text-red-400/80">{err.module || `Error ${i + 1}`}</span>
                                </div>
                                {err.error && <ModuleErrorPanel error={err.error} />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : logs?.build_logs && logs.build_logs.length > 0 ? (
                      <div className="p-5 space-y-3 max-h-[600px] overflow-auto">
                        {logs.build_logs.map((bl, i) => (
                          <div key={i} className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-mono text-[#888]">{bl.filename}</span>
                              {bl.timestamp && <span className="text-[10px] text-[#555]">{fmtTime(bl.timestamp)}</span>}
                            </div>
                            {bl.data ? (
                              <>
                                <BuildSummary log={bl.data} />
                                <div className="mt-3"><ModuleCards log={bl.data} /></div>
                              </>
                            ) : (
                              <p className="text-[11px] text-[#555]">No data</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-10 text-center text-[#444] text-[12px]">No build logs available</div>
                    )}
                  </Card>
                )}

                {tab === 'tests' && (
                  <Card className="p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-[#555]" />
                        <span className="text-[12px] text-[#888]">Quality & Tests</span>
                      </div>
                      {qualityReport?.overall_score != null && (
                        <span className={`text-[11px] font-bold ${
                          qualityReport.overall_score >= 80 ? 'text-emerald-400' :
                          qualityReport.overall_score >= 60 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          Score: {qualityReport.overall_score}/100
                        </span>
                      )}
                    </div>
                    {qualityReport ? (
                      <div className="max-h-[600px] overflow-auto">
                        <QualityReportView report={qualityReport} />
                      </div>
                    ) : logs?.quality_reports && logs.quality_reports.length > 0 ? (
                      <div className="max-h-[600px] overflow-auto">
                        {logs.quality_reports.map((qr, i) => (
                          <div key={i}>
                            {i > 0 && <div className="border-t border-[#1a1a1a]" />}
                            <div className="px-5 py-2 bg-[#0a0a0a] border-b border-[#1a1a1a]">
                              <span className="text-[10px] text-[#555] font-mono">{qr.filename}</span>
                            </div>
                            <QualityReportView report={qr} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-10 text-center text-[#444] text-[12px]">No quality reports available</div>
                    )}
                  </Card>
                )}

                {tab === 'deploy' && (
                  <Card className="p-8 text-center">
                    <Hammer className="w-8 h-8 text-[#333] mx-auto mb-3" />
                    <p className="text-[14px] text-[#888]">Deployment</p>
                    <p className="text-[12px] text-[#555] mt-1">Flash firmware via USB/JTAG. Coming soon.</p>
                  </Card>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
