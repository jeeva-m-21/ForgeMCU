"""FastAPI backend for CyberForge-26 UI
Provides RESTful API endpoints for firmware generation and orchestration.
Powered by LangChain + LangGraph agentic AI stack.
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from pathlib import Path
from datetime import datetime
import json
import logging
import uuid
import sys
import os
from enum import Enum

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.orchestration.orchestrator import Orchestrator
from core.orchestration.langgraph_orchestrator import LangGraphOrchestrator
from core.ai.gemini_wrapper import create_llm_client
from core.ai.langchain_llm import create_langchain_client
from core.ai.prompt import PromptLoader
from core.mcp.mcp import MCP
from core.rag.rag import RAG

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cyberforge.api")

# Initialize FastAPI app
app = FastAPI(
    title="CyberForge-26 API",
    description="AI-assisted firmware generation platform — powered by LangChain & LangGraph",
    version="2.0.0"
)

# Add CORS middleware to allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Data Models ============

class AgentType(str, Enum):
    """Available agent types"""
    ARCHITECTURE = "architecture"
    CODE = "code"
    TEST = "test"
    QUALITY = "quality"
    BUILD = "build"


class ModuleConfig(BaseModel):
    """Configuration for a module"""
    id: str = Field(..., description="Module identifier (required)")
    name: Optional[str] = Field(None, description="Module name")
    description: Optional[str] = Field(None, description="Module description")
    type: Optional[str] = Field(None, description="Module type (e.g., 'comm', 'logger', 'sensor')")
    responsibility: Optional[str] = Field(None, description="Module responsibility/purpose")
    requirements: Optional[List[str]] = Field(None, description="Module requirements")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Module-specific parameters")


class SystemSpecification(BaseModel):
    """System specification for firmware generation"""
    project_name: str = Field(..., description="Project name")
    description: str = Field(..., description="System description")
    target_platform: str = Field(..., description="Target platform (e.g., 'ARM Cortex-M4')")
    modules: List[ModuleConfig] = Field(..., description="List of modules to generate")
    safety_critical: bool = Field(False, description="Whether this is safety-critical")
    optimization_goal: str = Field("balanced", description="Optimization goal: 'speed', 'size', 'power', 'balanced'")
    constraints: Optional[Dict[str, Any]] = Field(None, description="System-level numeric/textual constraints")


class GenerationRequest(BaseModel):
    """Request to generate firmware"""
    specification: SystemSpecification
    include_tests: bool = Field(True, description="Generate unit tests")
    include_docs: bool = Field(True, description="Generate documentation")
    run_quality_checks: bool = Field(True, description="Run quality checks")
    model_provider: Optional[str] = Field(None, description="LLM provider (e.g., 'mock', 'gemini')")
    model_name: Optional[str] = Field(None, description="LLM model name override")
    api_key: Optional[str] = Field(None, description="Optional API key for selected provider")
    architecture_only: bool = Field(False, description="Generate architecture only")


class GenerationStatus(str, Enum):
    """Generation status"""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class GenerationResponse(BaseModel):
    """Response for generation request"""
    run_id: str = Field(..., description="Unique run ID")
    status: GenerationStatus = Field(..., description="Current status")
    message: str = Field("", description="Status message")


class RunStatus(BaseModel):
    """Status of a generation run"""
    run_id: str
    status: GenerationStatus
    progress: int = Field(0, ge=0, le=100, description="Progress percentage")
    message: str = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    artifacts: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None
    output_dir: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: str
    engine: str = "langgraph"


# ============ In-Memory State ============
# In production, use a proper database
runs: Dict[str, RunStatus] = {}


# ============ API Endpoints ============

@app.get("/", tags=["health"])
@app.get("/health", tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        timestamp=datetime.utcnow().isoformat(),
        engine="langgraph",
    )


@app.get("/api/runs", tags=["runs"])
async def list_runs() -> List[RunStatus]:
    """List all generation runs"""
    # Start with in-memory runs
    run_list = list(runs.values())

    # Add on-disk runs (from output/runs) if not already in memory
    runs_dir = Path("output/runs")
    if runs_dir.exists():
        for p in runs_dir.iterdir():
            if p.is_dir():
                run_id = p.name
                if run_id not in runs:
                    run_list.append(
                        RunStatus(
                            run_id=run_id,
                            status=GenerationStatus.COMPLETED,
                            progress=100,
                            message="Loaded from disk",
                            started_at=None,
                            completed_at=None,
                            artifacts=None,
                            errors=None,
                            output_dir=run_id
                        )
                    )

    # Sort newest first by directory mtime when possible
    def _run_sort_key(r: RunStatus) -> float:
        try:
            p = Path("output/runs") / (r.output_dir or r.run_id)
            return p.stat().st_mtime
        except Exception:
            return 0.0

    return sorted(run_list, key=_run_sort_key, reverse=True)


@app.get("/api/runs/{run_id}", tags=["runs"])
async def get_run_status(run_id: str) -> RunStatus:
    """Get status of a specific run"""
    if run_id in runs:
        return runs[run_id]

    # Fallback: if a run folder exists on disk, return a synthetic completed status
    run_dir = Path("output/runs") / run_id
    if run_dir.exists() and run_dir.is_dir():
        return RunStatus(
            run_id=run_id,
            status=GenerationStatus.COMPLETED,
            progress=100,
            message="Loaded from disk",
            started_at=None,
            completed_at=None,
            artifacts=None,
            errors=None,
            output_dir=run_id
        )

    raise HTTPException(status_code=404, detail=f"Run {run_id} not found")


@app.post("/api/generate", tags=["generation"])
async def generate_firmware(
    request: GenerationRequest,
    background_tasks: BackgroundTasks
) -> GenerationResponse:
    """
    Start firmware generation process
    
    This endpoint accepts a system specification and starts an async
    orchestration pipeline that generates firmware, tests, and reports.
    """
    run_id = str(uuid.uuid4())[:8]

    # Create a unique run output folder using the project name + run id
    project_folder = request.specification.project_name.replace(" ", "_").replace("-", "_")
    unique_output_folder = f"{project_folder}_{run_id}"

    status = RunStatus(
        run_id=run_id,
        status=GenerationStatus.QUEUED,
        message="Generation queued",
        started_at=datetime.utcnow().isoformat(),
        output_dir=unique_output_folder
    )
    runs[run_id] = status
    
    # Apply per-request model configuration (best-effort)
    # Log incoming request (avoid printing secrets)
    try:
        logger.info(f"Incoming generate request: project={request.specification.project_name}, provider={request.model_provider}, model_name={request.model_name}, api_key_provided={bool(request.api_key)}")
    except Exception:
        logger.info("Incoming generate request (failed to format details)")

    if request.model_provider:
        provider = request.model_provider.lower()
        if provider == "gemini":
            os.environ["USE_REAL_GEMINI"] = "1"
        elif provider == "mock":
            os.environ["USE_REAL_GEMINI"] = "0"
        else:
            # leave as-is for unknown providers
            pass
    if request.api_key:
        # store key for background orchestration; avoid logging the secret
        os.environ["GEMINI_API_KEY"] = request.api_key
    if request.model_name:
        # allow per-request model override (e.g. gemini-pro-v1)
        os.environ["GEMINI_MODEL"] = request.model_name

    # DEBUG: confirm environment flags after applying
    logger.info(f"Env flags after request: USE_REAL_GEMINI={os.environ.get('USE_REAL_GEMINI')}, GEMINI_API_KEY_present={bool(os.environ.get('GEMINI_API_KEY'))}, GEMINI_MODEL={os.environ.get('GEMINI_MODEL')}")

    # Convert request to dict for orchestrator
    payload = {
        # Ensure orchestrator writes into the same unique folder used by the run status
        "project_name": unique_output_folder,
        "description": request.specification.description,
        "target_platform": request.specification.target_platform,
        "modules": [m.model_dump(exclude_none=True) for m in request.specification.modules],
        "constraints": request.specification.constraints or {},
        "safety_critical": request.specification.safety_critical,
        "optimization_goal": request.specification.optimization_goal,
        "include_tests": request.include_tests,
        "include_docs": request.include_docs,
        "run_quality_checks": request.run_quality_checks,
        "model_provider": request.model_provider or "mock",  # Ensure it defaults to mock if not provided
        "model_name": request.model_name,
        "architecture_only": request.architecture_only,
    }
    
    logger.info(f"Payload model_provider: {payload.get('model_provider')}")
    
    # Start orchestration in background
    background_tasks.add_task(
        _run_orchestration,
        run_id=run_id,
        payload=payload
    )
    
    return GenerationResponse(
        run_id=run_id,
        status=GenerationStatus.QUEUED,
        message=f"Generation started with run ID: {run_id}"
    )


@app.get("/api/output/{run_id}/{file_path:path}", tags=["output"])
async def get_output_file(run_id: str, file_path: str):
    """Get generated artifact file"""
    try:
        # run_id may be either the real run uuid (key in `runs`) or the folder name (legacy)
        folder = run_id
        if run_id in runs and runs[run_id].output_dir:
            folder = runs[run_id].output_dir

        output_path = Path("output/runs") / folder / file_path
        if not output_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        return {"content": output_path.read_text(encoding="utf-8", errors="ignore")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/artifacts/runs/{run_id}/{file_path:path}", tags=["artifacts"])
async def get_artifact_file(run_id: str, file_path: str):
    """Get artifact file - alias for output endpoint"""
    try:
        # run_id may be either the real run uuid (key in `runs`) or the folder name (legacy)
        folder = run_id
        if run_id in runs and runs[run_id].output_dir:
            folder = runs[run_id].output_dir

        output_path = Path("output/runs") / folder / file_path
        if not output_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

        # For JSON files, parse and return the actual JSON
        if output_path.suffix.lower() == '.json':
            try:
                content = output_path.read_text(encoding="utf-8", errors="ignore")
                return json.loads(content)
            except json.JSONDecodeError:
                # If JSON parsing fails, return as text
                return {"content": content}
        
        # For other files, return wrapped in content
        return {"content": output_path.read_text(encoding="utf-8", errors="ignore")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/templates", tags=["templates"])
async def get_templates() -> Dict[str, Any]:
    """Get available templates and examples"""
    examples_dir = Path("examples")
    templates = {}
    
    for example_file in examples_dir.glob("*.json"):
        try:
            templates[example_file.stem] = json.loads(example_file.read_text())
        except Exception as e:
            logger.warning(f"Failed to load template {example_file}: {e}")
    
    return templates


@app.get("/api/artifacts", tags=["artifacts"])
async def list_artifacts() -> List[Dict[str, Any]]:
    """List all generated artifacts across runs. Excludes metadata sidecars."""
    artifacts: List[Dict[str, Any]] = []
    runs_dir = Path("output/runs")
    if not runs_dir.exists():
        return artifacts

    for run_dir in runs_dir.iterdir():
        if not run_dir.is_dir():
            continue
        for category_dir in run_dir.iterdir():
            if not category_dir.is_dir():
                continue
            for artifact in category_dir.rglob("*"):
                if artifact.is_file():
                    # Skip metadata sidecars only
                    if artifact.name.endswith(".meta.json"):
                        continue
                    rel_path = artifact.relative_to(run_dir)
                    # try to find a matching run_id in memory where output_dir == run_dir.name
                    matched_run_id = None
                    for rid, rstatus in runs.items():
                        if (rstatus.output_dir or "") == run_dir.name:
                            matched_run_id = rid
                            break

                    artifacts.append({
                        "run_id": matched_run_id or run_dir.name,
                        "category": category_dir.name,
                        "file_path": str(rel_path).replace("\\", "/"),
                        "file_name": artifact.name,
                        "size": artifact.stat().st_size,
                        "updated_at": datetime.fromtimestamp(artifact.stat().st_mtime).isoformat(),
                    })

    artifacts.sort(key=lambda x: x["updated_at"], reverse=True)
    return artifacts


@app.get("/api/docs/rag", tags=["documentation"])
async def get_rag_docs() -> Dict[str, List[str]]:
    """Get available RAG documentation"""
    rag_dir = Path("rag_docs")
    docs = {}
    
    for doc_file in rag_dir.glob("*.md"):
        if doc_file.name != "README.md":
            docs[doc_file.stem] = [doc_file.stem, doc_file.read_text()[:500] + "..."]
    
    return docs


@app.get("/api/architectures", tags=["architecture"])
async def get_all_architectures() -> List[Dict[str, Any]]:
    """Get all generated architecture files"""
    architectures = []
    runs_dir = Path("output/runs")
    
    if not runs_dir.exists():
        return architectures
    
    for run_dir in runs_dir.iterdir():
        if run_dir.is_dir():
            arch_dir = run_dir / "architecture"
            if arch_dir.exists():
                for arch_file in arch_dir.glob("*.txt"):
                    try:
                        architectures.append({
                            "run_id": run_dir.name,
                            "filename": arch_file.name,
                            "content": arch_file.read_text(encoding='utf-8'),
                            "timestamp": datetime.fromtimestamp(arch_file.stat().st_mtime).isoformat()
                        })
                    except Exception as e:
                        logger.warning(f"Failed to read architecture file {arch_file}: {e}")
    
    # Sort by timestamp descending
    architectures.sort(key=lambda x: x["timestamp"], reverse=True)
    return architectures


@app.get("/api/runs/{run_id}/architecture", tags=["architecture"])
async def get_run_architecture(run_id: str) -> Dict[str, Any]:
    """Get architecture files for a specific run"""
    # map run_id (uuid) to folder name when available
    folder = run_id
    if run_id in runs and runs[run_id].output_dir:
        folder = runs[run_id].output_dir

    arch_dir = Path("output/runs") / folder / "architecture"
    
    if not arch_dir.exists():
        raise HTTPException(status_code=404, detail="No architecture found for this run")
    
    arch_files = list(arch_dir.glob("*.txt"))
    if not arch_files:
        raise HTTPException(status_code=404, detail="No architecture files found")
    
    # Get the most recent architecture file
    latest_file = max(arch_files, key=lambda f: f.stat().st_mtime)
    
    return {
        "run_id": run_id,
        "filename": latest_file.name,
        "content": latest_file.read_text(encoding='utf-8'),
        "timestamp": datetime.fromtimestamp(latest_file.stat().st_mtime).isoformat()
    }


@app.get("/api/runs/{run_id}/logs", tags=["runs"])
async def get_run_logs(run_id: str) -> Dict[str, Any]:
    """Get latest build log and quality report for a run."""
    output_dir_name = runs[run_id].output_dir if run_id in runs else run_id
    run_dir = Path("output/runs") / output_dir_name
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="Run output directory not found")

    def _latest_file(path: Path, extensions: Optional[List[str]] = None) -> Optional[Path]:
        if not path.exists():
            return None
        if extensions:
            files = [p for p in path.iterdir() if p.is_file() and p.suffix in extensions]
        else:
            files = [p for p in path.iterdir() if p.is_file()]
        if not files:
            return None
        return max(files, key=lambda p: p.stat().st_mtime)

    def _all_files(path: Path, extensions: Optional[List[str]] = None) -> List[Path]:
        """Get all files matching extensions, sorted by modification time (newest first)"""
        if not path.exists():
            return []
        if extensions:
            files = [p for p in path.iterdir() if p.is_file() and p.suffix in extensions]
        else:
            files = [p for p in path.iterdir() if p.is_file()]
        return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)

    # Get all build logs (newest first)
    build_log_dir = run_dir / "build_log"
    build_logs = []
    if build_log_dir.exists():
        log_files = sorted(
            [p for p in build_log_dir.iterdir() if p.is_file() and p.suffix == ".json"],
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        for log_file in log_files:
            try:
                log_data = json.loads(log_file.read_text(encoding="utf-8", errors="ignore"))
                build_logs.append({
                    "filename": log_file.name,
                    "path": str(log_file),
                    "timestamp": datetime.fromtimestamp(log_file.stat().st_mtime).isoformat(),
                    "data": log_data
                })
            except Exception as exc:
                logger.warning(f"Failed to read build log {log_file}: {exc}")
    
    # Get quality reports from reports/ folder
    # Prioritize the standardized quality_report_latest.json for primary access
    reports_dir = run_dir / "reports"
    quality_report_paths = []
    
    # First: Latest standardized file (always newest)
    latest_standardized = reports_dir / "quality_report_latest.json"
    if latest_standardized.exists():
        quality_report_paths.append(latest_standardized)
    
    # Then: All timestamped reports (for history)
    if reports_dir.exists():
        all_reports = [
            p for p in reports_dir.iterdir() 
            if p.is_file() and p.suffix in [".json", ".txt"] 
            and p.name != "quality_report_latest.json"
        ]
        # Sort by modification time (newest first)
        all_reports.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        quality_report_paths.extend(all_reports)

    def _read_json(path: Optional[Path]) -> Optional[Dict[str, Any]]:
        if not path:
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        except Exception as exc:
            logger.warning(f"Failed to read log {path}: {exc}")
            return None

    # Read all quality reports
    quality_reports = []
    for qr_path in quality_report_paths:
        qr_data = _read_json(qr_path)
        if qr_data:
            quality_reports.append({
                "filename": qr_path.name,
                "path": str(qr_path),
                "data": qr_data
            })

    return {
        "run_id": run_id,
        "output_dir": output_dir_name,
        "build_logs": build_logs,
        "quality_reports": quality_reports,
    }


# ============ Agent & Pipeline Endpoints ============

@app.get("/api/agents", tags=["agents"])
async def list_agents() -> List[Dict[str, Any]]:
    """Return metadata about all available agents and their capabilities."""
    return [
        {
            "id": "architecture_agent",
            "name": "Architecture Agent",
            "description": "Designs system architecture, module decomposition, and communication patterns",
            "capabilities": ["System decomposition", "Module planning", "Interface design", "Dependency graph"],
            "mcp_permissions": ["read:requirements", "write:architecture", "run:agent"],
            "status": "ready",
            "provider": "langchain",
        },
        {
            "id": "code_agent",
            "name": "Code Generation Agent",
            "description": "Generates production-quality C/C++ firmware code per module or as unified file",
            "capabilities": ["C/C++ generation", "Arduino .ino", "Header/source split", "MCU-aware templates"],
            "mcp_permissions": ["run:agent", "write:module_code", "read:architecture"],
            "status": "ready",
            "provider": "langchain",
        },
        {
            "id": "test_agent",
            "name": "Test Agent",
            "description": "Generates unit tests and test cases for generated firmware modules",
            "capabilities": ["Unit test generation", "Test case design", "Coverage analysis", "Edge case detection"],
            "mcp_permissions": ["run:agent", "read:module_code", "write:tests"],
            "status": "ready",
            "provider": "langchain",
        },
        {
            "id": "quality_agent",
            "name": "Quality Agent",
            "description": "Performs static analysis, MISRA compliance checks, and quality scoring",
            "capabilities": ["Static analysis", "MISRA compliance", "Complexity metrics", "Quality scoring"],
            "mcp_permissions": ["run:agent", "read:module_code", "read:tests", "write:reports"],
            "status": "ready",
            "provider": "langchain",
        },
        {
            "id": "build_agent",
            "name": "Build Agent",
            "description": "Compiles firmware, runs tests, generates build logs and deployment artifacts",
            "capabilities": ["GCC/Clang compilation", "Test execution", "Build log generation", "Binary output"],
            "mcp_permissions": ["run:agent", "read:module_code", "read:tests", "write:artifacts", "write:build_log"],
            "status": "ready",
            "provider": "langchain",
        },
    ]


@app.get("/api/pipeline/graph", tags=["pipeline"])
async def get_pipeline_graph() -> Dict[str, Any]:
    """Return the LangGraph pipeline visualization data."""
    orch = LangGraphOrchestrator(input_payload={}, output_dir="output")
    return orch.get_graph_visualization()


@app.get("/api/pipeline/status", tags=["pipeline"])
async def get_pipeline_status() -> Dict[str, Any]:
    """Return current pipeline engine info and statistics."""
    total = len(runs)
    completed = sum(1 for r in runs.values() if r.status == GenerationStatus.COMPLETED)
    failed = sum(1 for r in runs.values() if r.status == GenerationStatus.FAILED)
    running = sum(1 for r in runs.values() if r.status == GenerationStatus.RUNNING)
    return {
        "engine": "langgraph",
        "version": "2.0.0",
        "agents": 5,
        "pipeline_steps": ["init", "architecture_agent", "code_agents", "test_agent", "quality_agent", "build_agent"],
        "features": ["conditional_routing", "state_management", "error_recovery", "mcp_enforcement", "rag_context"],
        "stats": {
            "total_runs": total,
            "completed": completed,
            "failed": failed,
            "running": running,
        },
    }


@app.get("/api/stack", tags=["system"])
async def get_tech_stack() -> Dict[str, Any]:
    """Return the current technology stack details."""
    langchain_version = "unknown"
    langgraph_version = "unknown"
    try:
        import langchain_core
        langchain_version = getattr(langchain_core, "__version__", "installed")
    except ImportError:
        langchain_version = "not installed"
    try:
        import langgraph
        langgraph_version = getattr(langgraph, "__version__", "installed")
    except ImportError:
        langgraph_version = "not installed"

    return {
        "backend": "FastAPI",
        "orchestration": "LangGraph",
        "llm_framework": "LangChain",
        "llm_provider": "Google Gemini",
        "security": "MCP (Model Context Protocol)",
        "knowledge": "RAG (Retrieval-Augmented Generation)",
        "versions": {
            "langchain_core": langchain_version,
            "langgraph": langgraph_version,
        },
    }


# ============ Background Tasks ============

async def _run_orchestration(run_id: str, payload: Dict[str, Any]) -> None:
    """Run orchestration in background using LangGraph pipeline."""
    try:
        # Update status to running
        runs[run_id].status = GenerationStatus.RUNNING
        runs[run_id].progress = 10
        runs[run_id].message = "Starting LangGraph orchestration..."
        
        logger.info(f"Starting LangGraph orchestration for run {run_id}")
        
        # Set up model provider based on payload
        model_provider = payload.get("model_provider", "mock").lower()
        use_real_gemini = model_provider == "gemini"
        if use_real_gemini:
            logger.info(f"Using LangChain + Gemini for run {run_id}")
            runs[run_id].message = "Initializing LangChain with Gemini..."
            runs[run_id].progress = 15
        else:
            logger.info(f"Using LangChain Mock for run {run_id}")
            runs[run_id].message = "Using LangChain Mock LLM..."
        
        # Use LangGraph orchestrator
        runs[run_id].progress = 20
        runs[run_id].message = "Running architecture analysis via LangGraph..."
        
        orch = LangGraphOrchestrator(
            payload,
            output_dir="output",
            run_id=run_id,
            use_real_gemini=use_real_gemini,
        )
        result = orch.run()
        
        if result.success:
            runs[run_id].status = GenerationStatus.COMPLETED
            runs[run_id].progress = 100
            runs[run_id].message = "Generation completed successfully"
            runs[run_id].completed_at = datetime.utcnow().isoformat()
            
            # Try to collect artifacts - use project name as folder
            project_name = payload.get("project_name", run_id).replace(" ", "_").replace("-", "_")
            run_output_dir = Path("output/runs") / project_name
            if run_output_dir.exists():
                test_files = [p for p in run_output_dir.glob("tests/*") if p.is_file() and not p.name.endswith(".meta.json")]
                artifacts = {
                    "architecture": len(list(run_output_dir.glob("architecture/*.txt"))),
                    "code": len(list(run_output_dir.glob("module_code/**/*.c"))),
                    "tests": len(test_files),
                    "build": len(list(run_output_dir.glob("build_log/*.json"))),
                    "reports": len(list(run_output_dir.glob("quality_report/*.json"))),
                }
                runs[run_id].artifacts = artifacts
        else:
            runs[run_id].status = GenerationStatus.FAILED
            runs[run_id].message = f"Generation failed: {result.message}"
            runs[run_id].errors = [result.message]
            runs[run_id].completed_at = datetime.utcnow().isoformat()
            
    except Exception as e:
        logger.error(f"Orchestration failed for run {run_id}: {e}", exc_info=True)
        runs[run_id].status = GenerationStatus.FAILED
        runs[run_id].message = f"Error: {str(e)}"
        runs[run_id].errors = [str(e)]
        runs[run_id].completed_at = datetime.utcnow().isoformat()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
