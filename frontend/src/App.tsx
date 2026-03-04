import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import GeneratePage from './pages/GeneratePage'
import ArtifactsPage from './pages/ArtifactsPage'
import FileViewerPage from './pages/FileViewerPage'
import BuildPage from './pages/BuildPage'
import AgentsPage from './pages/AgentsPage'

function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111',
            color: '#ededed',
            border: '1px solid #222',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#fff', secondary: '#111' } },
          error: { iconTheme: { primary: '#fff', secondary: '#111' } },
        }}
      />
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/artifacts" element={<ArtifactsPage />} />
          <Route path="/artifacts/:runId/:filePath" element={<FileViewerPage />} />
          <Route path="/build" element={<BuildPage />} />
          <Route path="/build/:runId" element={<BuildPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </>
  )
}

export default App
