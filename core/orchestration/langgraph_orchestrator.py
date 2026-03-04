"""LangGraph-based orchestrator for CyberForge agent pipeline.

Replaces the simple networkx DAG with a LangGraph StateGraph that provides:
- Typed state passing between agents
- Conditional routing (architecture-only mode, error recovery)
- Built-in checkpointing / tracing hooks
- Parallel node execution for independent agents

The graph mirrors the existing pipeline:
  architecture_agent → code_agents → test_agent → quality_agent → build_agent

But adds LangGraph-native features like conditional edges, state management,
and proper error propagation.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

logger = logging.getLogger("cyberforge.orchestrator.langgraph")


# ─── State Schema ───────────────────────────────────────────────────────────

class PipelineState(TypedDict, total=False):
    """Typed state flowing through the LangGraph pipeline."""
    # Input
    payload: Dict[str, Any]
    run_id: str
    output_dir: str
    use_real_gemini: bool

    # Shared context objects (set once at init)
    context: Any  # ExecutionContext

    # Per-step results
    architecture_result: Optional[Dict[str, Any]]
    code_results: Optional[List[Dict[str, Any]]]
    test_result: Optional[Dict[str, Any]]
    quality_result: Optional[Dict[str, Any]]
    build_result: Optional[Dict[str, Any]]

    # Control flow
    current_step: str
    steps_completed: List[str]
    errors: List[str]
    is_architecture_only: bool
    success: bool
    message: str


# ─── Orchestration Result (matches existing interface) ───────────────────────

@dataclass
class OrchestrationResult:
    success: bool
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


# ─── Node Functions ──────────────────────────────────────────────────────────

def _init_context(state: PipelineState) -> PipelineState:
    """Initialize execution context with MCP, RAG, LLM, PromptLoader."""
    from core.mcp.mcp import MCP
    from core.rag.rag import RAG
    from core.ai.langchain_llm import create_langchain_client
    from core.ai.prompt import PromptLoader
    from core.orchestration.orchestrator import ExecutionContext

    payload = state["payload"]
    output_dir = state.get("output_dir", "output")
    run_id = state.get("run_id") or datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    use_real = state.get("use_real_gemini", False)

    if use_real:
        os.environ["USE_REAL_GEMINI"] = "1"
    else:
        os.environ["USE_REAL_GEMINI"] = "0"

    project_root = Path(__file__).parent.parent.parent
    mcp = MCP(
        audit_log=Path(output_dir) / "mcp_audit.log",
    )
    rag = RAG(project_root / "rag_docs")
    llm = create_langchain_client()
    prompt_loader = PromptLoader(project_root / "prompts")

    ctx = ExecutionContext(
        mcp=mcp,
        rag=rag,
        llm=llm,
        prompt_loader=prompt_loader,
        output_dir=output_dir,
        run_id=run_id,
        project_name=payload.get("project_name"),
        payload=payload,
    )

    return {
        **state,
        "context": ctx,
        "run_id": run_id,
        "is_architecture_only": bool(payload.get("architecture_only")),
        "steps_completed": [],
        "errors": [],
        "success": True,
        "current_step": "init",
    }


def _run_architecture(state: PipelineState) -> PipelineState:
    """Run the architecture agent."""
    from agents.architecture_agent import ArchitectureAgent
    from core.mcp.mcp import MCPViolation

    ctx = state["context"]
    payload = state["payload"]
    agent = ArchitectureAgent()

    try:
        ctx.mcp.check_run(agent.agent_id)
        result = agent.execute(ctx, payload)
        completed = list(state.get("steps_completed", []))
        completed.append("architecture_agent")
        return {
            **state,
            "architecture_result": {
                "success": result.success,
                "message": result.message,
                "artifact_path": result.artifact_path,
            },
            "steps_completed": completed,
            "current_step": "architecture_agent",
            "success": state.get("success", True) and result.success,
            "message": result.message if not result.success else state.get("message", ""),
        }
    except MCPViolation as mv:
        errors = list(state.get("errors", []))
        errors.append(str(mv))
        return {**state, "success": False, "message": str(mv), "errors": errors}
    except Exception as exc:
        errors = list(state.get("errors", []))
        errors.append(str(exc))
        return {**state, "success": False, "message": str(exc), "errors": errors}


def _run_code_agents(state: PipelineState) -> PipelineState:
    """Run code generation agents (single-file or per-module)."""
    from agents.code_agent import CodeAgent
    from core.mcp.mcp import MCPViolation

    ctx = state["context"]
    payload = state["payload"]

    target_mcu = payload.get("target_mcu", "").lower()
    mcu_format = CodeAgent.determine_mcu_format(target_mcu)
    is_single_file = mcu_format["is_single_file"]
    modules = payload.get("modules", [])
    code_results = []

    try:
        if is_single_file:
            project_name = payload.get("project_name", "firmware")
            agent = CodeAgent("unified_firmware")
            ctx.mcp.check_run(agent.agent_id)
            unified_input = {
                "id": project_name.replace(" ", "_"),
                "name": project_name,
                "type": "unified",
                "target_mcu": payload.get("target_mcu"),
                "modules": modules,
                "all_modules": modules,
                "project_name": project_name,
            }
            result = agent.execute(ctx, unified_input)
            code_results.append({
                "module": "unified",
                "success": result.success,
                "message": result.message,
            })
            if not result.success:
                return {
                    **state,
                    "code_results": code_results,
                    "success": False,
                    "message": f"Code agent failed: {result.message}",
                }
        else:
            for mod in modules:
                module_id = mod.get("id")
                if not module_id:
                    continue
                agent = CodeAgent(module_id)
                ctx.mcp.check_run(agent.agent_id)
                result = agent.execute(ctx, mod)
                code_results.append({
                    "module": module_id,
                    "success": result.success,
                    "message": result.message,
                })
                if not result.success:
                    return {
                        **state,
                        "code_results": code_results,
                        "success": False,
                        "message": f"Code agent ({module_id}) failed: {result.message}",
                    }

        completed = list(state.get("steps_completed", []))
        completed.append("code_agents")
        return {
            **state,
            "code_results": code_results,
            "steps_completed": completed,
            "current_step": "code_agents",
        }
    except MCPViolation as mv:
        errors = list(state.get("errors", []))
        errors.append(str(mv))
        return {**state, "code_results": code_results, "success": False, "message": str(mv), "errors": errors}
    except Exception as exc:
        errors = list(state.get("errors", []))
        errors.append(str(exc))
        return {**state, "code_results": code_results, "success": False, "message": str(exc), "errors": errors}


def _run_test_agent(state: PipelineState) -> PipelineState:
    """Run the test generation agent."""
    from agents.test_agent import TestAgent
    from core.mcp.mcp import MCPViolation

    ctx = state["context"]
    payload = state["payload"]
    agent = TestAgent()

    try:
        ctx.mcp.check_run(agent.agent_id)
        result = agent.execute(ctx, payload)
        completed = list(state.get("steps_completed", []))
        completed.append("test_agent")
        return {
            **state,
            "test_result": {
                "success": result.success,
                "message": result.message,
                "artifact_path": result.artifact_path,
            },
            "steps_completed": completed,
            "current_step": "test_agent",
            "success": state.get("success", True) and result.success,
        }
    except MCPViolation as mv:
        errors = list(state.get("errors", []))
        errors.append(str(mv))
        return {**state, "success": False, "message": str(mv), "errors": errors}
    except Exception as exc:
        errors = list(state.get("errors", []))
        errors.append(str(exc))
        return {**state, "success": False, "message": str(exc), "errors": errors}


def _run_quality_agent(state: PipelineState) -> PipelineState:
    """Run the quality analysis agent."""
    from agents.quality_agent import QualityAgent
    from core.mcp.mcp import MCPViolation

    ctx = state["context"]
    payload = state["payload"]
    agent = QualityAgent()

    try:
        ctx.mcp.check_run(agent.agent_id)
        result = agent.execute(ctx, payload)
        completed = list(state.get("steps_completed", []))
        completed.append("quality_agent")
        return {
            **state,
            "quality_result": {
                "success": result.success,
                "message": result.message,
                "artifact_path": result.artifact_path,
            },
            "steps_completed": completed,
            "current_step": "quality_agent",
            "success": state.get("success", True) and result.success,
        }
    except MCPViolation as mv:
        errors = list(state.get("errors", []))
        errors.append(str(mv))
        return {**state, "success": False, "message": str(mv), "errors": errors}
    except Exception as exc:
        errors = list(state.get("errors", []))
        errors.append(str(exc))
        return {**state, "success": False, "message": str(exc), "errors": errors}


def _run_build_agent(state: PipelineState) -> PipelineState:
    """Run the build / compilation agent."""
    from agents.build_agent import BuildAgent
    from core.mcp.mcp import MCPViolation

    ctx = state["context"]
    payload = state["payload"]
    agent = BuildAgent()

    try:
        ctx.mcp.check_run(agent.agent_id)
        result = agent.execute(ctx, payload)
        completed = list(state.get("steps_completed", []))
        completed.append("build_agent")
        return {
            **state,
            "build_result": {
                "success": result.success,
                "message": result.message,
                "artifact_path": result.artifact_path,
            },
            "steps_completed": completed,
            "current_step": "build_agent",
            "success": state.get("success", True) and result.success,
        }
    except MCPViolation as mv:
        errors = list(state.get("errors", []))
        errors.append(str(mv))
        return {**state, "success": False, "message": str(mv), "errors": errors}
    except Exception as exc:
        errors = list(state.get("errors", []))
        errors.append(str(exc))
        return {**state, "success": False, "message": str(exc), "errors": errors}


# ─── Routing ─────────────────────────────────────────────────────────────────

def _should_continue_after_arch(state: PipelineState) -> str:
    """Decide whether to continue to code agents or end (arch-only mode)."""
    if not state.get("success", True):
        return "end"
    if state.get("is_architecture_only"):
        return "end"
    return "code_agents"


def _should_continue(state: PipelineState) -> str:
    """Generic continuation check – abort on failure."""
    if not state.get("success", True):
        return "end"
    return "continue"


# ─── Graph Builder ───────────────────────────────────────────────────────────

def build_pipeline_graph():
    """Build and compile the LangGraph StateGraph for the CyberForge pipeline.

    Returns a compiled graph that can be invoked with an initial PipelineState.
    """
    try:
        from langgraph.graph import StateGraph, END
    except ImportError:
        logger.error("langgraph is not installed. Install with: pip install langgraph")
        raise

    workflow = StateGraph(PipelineState)

    # Add nodes
    workflow.add_node("init", _init_context)
    workflow.add_node("architecture_agent", _run_architecture)
    workflow.add_node("code_agents", _run_code_agents)
    workflow.add_node("test_agent", _run_test_agent)
    workflow.add_node("quality_agent", _run_quality_agent)
    workflow.add_node("build_agent", _run_build_agent)

    # Set entry point
    workflow.set_entry_point("init")

    # Edges: init → architecture
    workflow.add_edge("init", "architecture_agent")

    # Conditional: architecture → code_agents | end
    workflow.add_conditional_edges(
        "architecture_agent",
        _should_continue_after_arch,
        {
            "code_agents": "code_agents",
            "end": END,
        },
    )

    # Conditional: code → test | end
    workflow.add_conditional_edges(
        "code_agents",
        _should_continue,
        {"continue": "test_agent", "end": END},
    )

    # Conditional: test → quality | end
    workflow.add_conditional_edges(
        "test_agent",
        _should_continue,
        {"continue": "quality_agent", "end": END},
    )

    # Conditional: quality → build | end
    workflow.add_conditional_edges(
        "quality_agent",
        _should_continue,
        {"continue": "build_agent", "end": END},
    )

    # build → END
    workflow.add_edge("build_agent", END)

    return workflow.compile()


# ─── Public Orchestrator Class ───────────────────────────────────────────────

class LangGraphOrchestrator:
    """LangGraph-based orchestrator — drop-in replacement for Orchestrator.

    Usage:
        orch = LangGraphOrchestrator(payload, output_dir="output", run_id="abc")
        result = orch.run()  # returns OrchestrationResult
    """

    def __init__(
        self,
        input_payload: Dict[str, Any],
        output_dir: str = "output",
        run_id: str | None = None,
        use_real_gemini: bool = False,
    ):
        self.payload = input_payload
        self.output_dir = output_dir
        self.run_id = run_id or datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        self.use_real_gemini = use_real_gemini
        self._compiled_graph = build_pipeline_graph()

    def run(self) -> OrchestrationResult:
        """Execute the full pipeline via LangGraph and return an OrchestrationResult."""
        logger.info("LangGraphOrchestrator: starting run %s", self.run_id)

        initial_state: PipelineState = {
            "payload": self.payload,
            "run_id": self.run_id,
            "output_dir": self.output_dir,
            "use_real_gemini": self.use_real_gemini,
            "steps_completed": [],
            "errors": [],
            "success": True,
            "message": "",
            "current_step": "init",
            "is_architecture_only": False,
        }

        try:
            final_state = self._compiled_graph.invoke(initial_state)

            details = {}
            for key in ("architecture_result", "code_results", "test_result", "quality_result", "build_result"):
                if final_state.get(key):
                    details[key] = final_state[key]

            success = final_state.get("success", False)
            message = final_state.get("message", "")
            if success:
                message = message or "All steps executed via LangGraph"

            logger.info(
                "LangGraphOrchestrator: run %s finished — success=%s, steps=%s",
                self.run_id,
                success,
                final_state.get("steps_completed", []),
            )

            return OrchestrationResult(
                success=success,
                message=message,
                details=details,
            )
        except Exception as exc:
            logger.exception("LangGraphOrchestrator: run failed")
            return OrchestrationResult(
                success=False,
                message=str(exc),
                details={},
            )

    def get_graph_visualization(self) -> Dict[str, Any]:
        """Return a JSON-serializable representation of the pipeline graph."""
        nodes = [
            {"id": "init", "label": "Initialize Context", "type": "setup"},
            {"id": "architecture_agent", "label": "Architecture Agent", "type": "agent"},
            {"id": "code_agents", "label": "Code Generation", "type": "agent"},
            {"id": "test_agent", "label": "Test Agent", "type": "agent"},
            {"id": "quality_agent", "label": "Quality Agent", "type": "agent"},
            {"id": "build_agent", "label": "Build Agent", "type": "agent"},
            {"id": "end", "label": "Complete", "type": "terminal"},
        ]
        edges = [
            {"from": "init", "to": "architecture_agent"},
            {"from": "architecture_agent", "to": "code_agents", "condition": "full mode"},
            {"from": "architecture_agent", "to": "end", "condition": "arch-only"},
            {"from": "code_agents", "to": "test_agent", "condition": "success"},
            {"from": "code_agents", "to": "end", "condition": "failure"},
            {"from": "test_agent", "to": "quality_agent", "condition": "success"},
            {"from": "test_agent", "to": "end", "condition": "failure"},
            {"from": "quality_agent", "to": "build_agent", "condition": "success"},
            {"from": "quality_agent", "to": "end", "condition": "failure"},
            {"from": "build_agent", "to": "end"},
        ]
        return {"nodes": nodes, "edges": edges}
