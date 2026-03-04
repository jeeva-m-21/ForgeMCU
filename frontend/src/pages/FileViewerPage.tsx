import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Copy, Download, FileCode, Check,
} from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Card, Button, Badge } from '../components/ui'
import { apiClient } from '../api/client'

const langMap: Record<string, string> = {
  c: 'c', h: 'c', cpp: 'cpp', py: 'python', json: 'json',
  md: 'markdown', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  mk: 'makefile', cmake: 'cmake', sh: 'bash', bat: 'batch',
}

// Override vscDarkPlus for full B&W
const bwTheme: Record<string, React.CSSProperties> = {}
Object.keys(vscDarkPlus).forEach(k => {
  bwTheme[k] = { ...(vscDarkPlus as any)[k] }
})
bwTheme['pre[class*="language-"]'] = {
  ...(bwTheme['pre[class*="language-"]'] || {}),
  background: '#0a0a0a',
  margin: 0,
  padding: '1.25rem',
  fontSize: '12px',
  lineHeight: '1.8',
}
bwTheme['code[class*="language-"]'] = {
  ...(bwTheme['code[class*="language-"]'] || {}),
  background: 'none',
  fontSize: '12px',
}

export default function FileViewerPage() {
  const { runId, filePath: rawFilePath } = useParams()
  const navigate = useNavigate()
  const filePath = rawFilePath ? decodeURIComponent(rawFilePath) : ''
  const fileName = filePath.split('/').pop() || filePath
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  const lang = langMap[ext] || ext

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (runId && filePath) {
      apiClient.getArtifactContent(runId, filePath)
        .then(r => setContent(r.content))
        .catch(() => toast.error('Failed to load file'))
        .finally(() => setLoading(false))
    }
  }, [runId, filePath])

  const copyContent = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadFile = () => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const isMarkdown = ext === 'md'
  const isJson = ext === 'json'
  const lineCount = content.split('\n').length

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-[#555] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <span className="text-[#333]">/</span>
        <button
          onClick={() => navigate('/artifacts')}
          className="text-[#555] hover:text-white transition-colors"
        >
          Artifacts
        </button>
        <span className="text-[#333]">/</span>
        <span className="text-[#666] font-mono">{runId}</span>
        <span className="text-[#333]">/</span>
        <span className="text-white font-mono">{fileName}</span>
      </div>

      {/* File Header */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <FileCode className="w-4 h-4 text-[#555]" />
            <span className="text-[13px] font-mono text-white">{fileName}</span>
            <Badge variant="default" className="text-[10px] uppercase">{ext}</Badge>
            <span className="text-[11px] text-[#444]">{lineCount} lines</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyContent}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadFile}>
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-4 rounded" style={{ width: `${40 + Math.random() * 50}%` }} />
            ))}
          </div>
        ) : isMarkdown ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-6 py-5 prose prose-invert max-w-none text-[13px]"
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="relative">
              {/* Line numbers gutter */}
              <SyntaxHighlighter
                language={lang}
                style={bwTheme}
                showLineNumbers
                lineNumberStyle={{
                  color: '#333',
                  fontSize: '11px',
                  minWidth: '3em',
                  paddingRight: '1em',
                  userSelect: 'none',
                }}
                wrapLines
                customStyle={{
                  background: '#0a0a0a',
                  margin: 0,
                  borderRadius: 0,
                }}
              >
                {content}
              </SyntaxHighlighter>
            </div>
          </motion.div>
        )}
      </Card>
    </div>
  )
}
