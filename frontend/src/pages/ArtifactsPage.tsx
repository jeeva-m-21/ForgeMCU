import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, FileCode, FileText, FolderOpen,
  ChevronRight, Download, Filter,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, Badge, EmptyState, Button } from '../components/ui'
import { apiClient, ArtifactEntry } from '../api/client'

const categoryIcons: Record<string, React.ReactNode> = {
  architecture: <FolderOpen className="w-4 h-4" />,
  code: <FileCode className="w-4 h-4" />,
  tests: <FileCode className="w-4 h-4" />,
  build: <FileText className="w-4 h-4" />,
  reports: <FileText className="w-4 h-4" />,
}

const extColor = (name: string) => {
  if (name.endsWith('.c') || name.endsWith('.h')) return 'text-white'
  if (name.endsWith('.json')) return 'text-[#888]'
  if (name.endsWith('.md')) return 'text-[#888]'
  return 'text-[#666]'
}

export default function ArtifactsPage() {
  const navigate = useNavigate()
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [myRunsOnly, setMyRunsOnly] = useState(false)

  useEffect(() => {
    loadArtifacts()
  }, [])

  const loadArtifacts = async () => {
    try {
      setArtifacts(await apiClient.getArtifacts())
    } catch {}
    finally { setLoading(false) }
  }

  const myRuns: string[] = JSON.parse(localStorage.getItem('generated_runs') || '[]')

  const filtered = artifacts.filter(a => {
    if (search && !a.file_name.toLowerCase().includes(search.toLowerCase()) && !a.run_id.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter && a.category !== catFilter) return false
    if (myRunsOnly && !myRuns.includes(a.run_id)) return false
    return true
  })

  const grouped = filtered.reduce<Record<string, ArtifactEntry[]>>((acc, a) => {
    if (!acc[a.run_id]) acc[a.run_id] = []
    acc[a.run_id].push(a)
    return acc
  }, {})

  const categories = [...new Set(artifacts.map(a => a.category))]

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-white tracking-tight">Artifacts</h1>
        <p className="text-[13px] text-[#666] mt-1">Browse generated firmware files</p>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#444] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-2 text-[13px] text-white placeholder-[#444] focus:border-[#333] focus:outline-none transition-colors"
              placeholder="Search files or run IDs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#555]" />
            <button
              className={`px-3 py-1.5 rounded-md text-[11px] border transition-colors ${
                !catFilter ? 'bg-white text-black border-white' : 'bg-[#111] text-[#666] border-[#222] hover:border-[#333]'
              }`}
              onClick={() => setCatFilter(null)}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c}
                className={`px-3 py-1.5 rounded-md text-[11px] border transition-colors capitalize ${
                  catFilter === c ? 'bg-white text-black border-white' : 'bg-[#111] text-[#666] border-[#222] hover:border-[#333]'
                }`}
                onClick={() => setCatFilter(catFilter === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            className={`px-3 py-1.5 rounded-md text-[11px] border transition-colors ${
              myRunsOnly ? 'bg-white text-black border-white' : 'bg-[#111] text-[#666] border-[#222] hover:border-[#333]'
            }`}
            onClick={() => setMyRunsOnly(!myRunsOnly)}
          >
            My Runs
          </button>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <Card className="p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </Card>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No artifacts found"
          description={search || catFilter ? 'Try adjusting your filters' : 'Generate firmware to see artifacts here'}
          action={!search && !catFilter && (
            <Button variant="primary" onClick={() => navigate('/generate')}>Generate Firmware</Button>
          )}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([runId, files]) => (
            <motion.div
              key={runId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-mono font-medium text-white">{runId}</span>
                    <Badge variant="default">{files.length} files</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/build/${runId}`)}
                  >
                    View Run <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
                <div className="divide-y divide-[#111]">
                  {files.map((file) => (
                    <button
                      key={file.file_path}
                      className="flex items-center gap-3 w-full px-5 py-2.5 text-left hover:bg-[#111]/60 transition-colors"
                      onClick={() => navigate(`/artifacts/${file.run_id}/${encodeURIComponent(file.file_path)}`)}
                    >
                      <span className={`flex-shrink-0 ${extColor(file.file_name)}`}>
                        {categoryIcons[file.category] || <FileText className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[13px] font-mono ${extColor(file.file_name)}`}>
                          {file.file_name}
                        </span>
                        <span className="text-[11px] text-[#333] ml-3">
                          {file.file_path}
                        </span>
                      </div>
                      <Badge variant="default" className="text-[10px] capitalize">{file.category}</Badge>
                      <span className="text-[11px] text-[#444] font-mono w-14 text-right">
                        {formatSize(file.size)}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[#333]" />
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
