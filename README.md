<div align="center">

# ForgeMCU Studio

**AI-Assisted Governed Firmware Generation Platform**

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-v2.0-009688.svg)](https://fastapi.tiangolo.com/)
[![React + Vite](https://img.shields.io/badge/React-Vite-61DAFB.svg)](https://vitejs.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-orange.svg)](https://github.com/langchain-ai/langgraph)

[Features](#features) · [Architecture](#architecture) · [Getting Started](#getting-started) · [Usage](#usage) · [Authors](#authors)

</div>

---

## Overview

**ForgeMCU Studio** is a multi-agent AI platform that generates embedded C/C++ firmware, unit tests, quality reports, and build artifacts for any microcontroller — from a single JSON specification.

It is **not** a ChatGPT wrapper. It's a **governed pipeline** with specialized agents, strict MCP enforcement, RAG-grounded generation, and full artifact traceability.

### Key Capabilities

- **5 specialized AI agents** — Architecture, Code, Test, Quality, Build
- **LangGraph orchestration** — Typed state graph with conditional routing and checkpointing
- **LangChain + Gemini** — Drop-in LLM abstraction with mock mode for testing
- **MCP governance** — Model Context Protocol enforces safety and architectural rules
- **RAG grounding** — Embedded systems knowledge base (I2C, SPI, UART, OTA, power management, etc.)
- **Full-stack UI** — React SPA with real-time monitoring, artifact browsing, and build dashboards
- **MCU-agnostic** — Supports STM32, ESP32, Nordic, RP2040, Microchip, TI families

---

## Features

| Layer | What's included |
|-------|----------------|
| **Agents** | Architecture → Code → Test → Quality → Build pipeline |
| **Orchestration** | LangGraph `StateGraph` with typed `PipelineState`, conditional edges, error propagation. Legacy NetworkX DAG also available |
| **AI** | Google Gemini via LangChain adapter (`langchain-google-genai`). Auto-fallback to mock for CI |
| **Governance** | MCP validates every agent input/output against safety and architectural rules |
| **RAG** | 12 embedded-systems documents with metadata-driven retrieval |
| **Backend** | FastAPI v2.0 — REST + WebSocket, dual orchestrator support, `/api/agents`, `/api/stack` endpoints |
| **Frontend** | React + TypeScript + Vite + Tailwind + Framer Motion. 6 pages: Dashboard, Generate, Artifacts, Build, Agents, File Viewer |
| **CLI** | `python cli.py --input spec.json` for headless runs |

---

## Architecture

```
Frontend (React + Vite)  ──HTTP/WS──▶  Backend API (FastAPI v2.0)
                                              │
                                    LangGraph Orchestrator
                                    (StateGraph + Checkpoints)
                                              │
                    ┌─────────┬─────────┬─────────┬─────────┐
                   Arch     Code      Test    Quality    Build
                  Agent    Agent     Agent     Agent     Agent
                    └─────────┴─────────┴─────────┴─────────┘
                                      │
                          ┌───────────┼───────────┐
                         MCP        RAG       LangChain
                       Governor    Engine     LLM Client
                                      │
                              Output / Artifacts
```

---

## Project Structure

```
├── frontend/                # React + TypeScript + Vite SPA
│   └── src/
│       ├── pages/           # Dashboard, Generate, Artifacts, Build, Agents, FileViewer
│       ├── components/      # AppShell (sidebar), shared UI primitives
│       ├── api/             # Typed API client
│       ├── hooks/           # useHealthCheck
│       └── store/           # Generator state
│
├── backend_api/             # FastAPI v2.0 server
│   └── main.py              # REST + WebSocket endpoints
│
├── core/
│   ├── orchestration/
│   │   ├── orchestrator.py              # Legacy NetworkX DAG
│   │   └── langgraph_orchestrator.py    # LangGraph StateGraph (primary)
│   ├── ai/
│   │   ├── gemini_wrapper.py            # Direct Gemini client
│   │   └── langchain_llm.py            # LangChain adapter
│   ├── mcp/mcp.py                       # MCP governance
│   └── rag/rag.py                       # RAG retrieval engine
│
├── agents/                  # Architecture, Code, Test, Quality, Build agents
├── rag_docs/                # Embedded systems knowledge base (12 docs)
├── prompts/                 # Versioned prompt templates
├── schemas/                 # JSON validation schemas
├── examples/                # Sample input specifications
├── tests/                   # pytest test suite
├── cli.py                   # CLI entry point
├── requirements.txt         # Python deps (includes LangChain/LangGraph stack)
└── pyproject.toml           # Project metadata
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Google Gemini API key *(optional — mock mode works without it)*

### Installation

```bash
# Clone
git clone https://github.com/jeeva-m-21/Cyberforce-submission-V2.git
cd Cyberforce-submission-V2

# Backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### Configuration

Create a `.env` file in the project root:

```env
USE_REAL_GEMINI=0                    # Set to 1 for real AI generation
GEMINI_API_KEY=your_key_here         # Required if USE_REAL_GEMINI=1
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
VITE_API_URL=http://localhost:8000
```

---

## Usage

### Web UI (recommended)

```bash
# Terminal 1 — Backend
uvicorn backend_api.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**. The UI provides:
- **Dashboard** — Recent runs, system stats
- **Generate** — Full firmware spec builder with MCU family selection
- **Artifacts** — Browse/filter/search generated files
- **Build** — Compilation status, test results, deployment info
- **Agents** — Agent info cards and pipeline visualization

### CLI

```bash
python cli.py --input examples/sample_input.json
```

### API

```bash
# Swagger docs
open http://localhost:8000/docs

# Generate firmware
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d @examples/sample_input.json
```

### Example Input

```json
{
  "project_name": "Temperature Monitor",
  "mcu": "STM32F103",
  "clock_speed_mhz": 72,
  "modules": [
    { "name": "temp_sensor", "type": "sensor", "interface": "I2C" },
    { "name": "display", "type": "output", "interface": "SPI" }
  ],
  "requirements": [
    "Read temperature every 5 seconds",
    "Display with 0.1°C precision"
  ]
}
```

Output goes to `output/runs/run_YYYYMMDD_HHMMSS/` with subdirectories for architecture, code, tests, quality, and build artifacts.

---

## Development

```bash
# Install dev deps
pip install -r requirements-dev.txt

# Tests
pytest -v
pytest --cov=core --cov=agents

# Code quality
black . && flake8 . && mypy .

# Frontend
cd frontend && npm run lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Orchestration | LangGraph, NetworkX |
| LLM | Google Gemini via LangChain |
| Backend | FastAPI, Uvicorn |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Governance | Model Context Protocol (MCP) |
| Knowledge | RAG with embedded systems docs |
| CLI | Click |
| Testing | pytest |

---

## License

MIT — see [LICENSE](LICENSE).

## Authors

- **Jeeva M** — [GitHub](https://github.com/jeeva-m-21)
- **Sanjith Badri**
- **Krithik Vishal**

### Acknowledgments

- **HCLTech** — Hackathon sponsor and industry guidance
- **Google Gemini** — AI backbone
- **LangChain / LangGraph** — Orchestration framework

---

<div align="center">

**Built for the Embedded Systems Community**

</div>
