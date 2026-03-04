"""LangChain-based LLM abstraction for CyberForge.

Provides drop-in replacements for the existing LLMClient interface using LangChain's
ChatModel ecosystem. Supports Google Gemini via langchain-google-genai, with automatic
fallback to a deterministic mock for CI/testing.

Classes:
- LangChainLLM: wraps any langchain ChatModel into CyberForge's LLMClient interface
- LangChainMock: deterministic mock implementing LLMClient for tests
- create_langchain_client: factory that returns a LangChain-backed LLMClient
"""
from __future__ import annotations

import logging
import os
from typing import Optional, List, Dict, Any

from core.ai.gemini_wrapper import LLMClient

logger = logging.getLogger("cyberforge.ai.langchain")


class LangChainMock(LLMClient):
    """Deterministic mock that mirrors LangChain ChatModel output shape."""

    def __init__(self):
        self.calls: List[Dict[str, Any]] = []
        self.provider = "mock-langchain"

    def generate(self, prompt: str, max_tokens: int = 512) -> str:
        self.calls.append({"prompt": prompt, "max_tokens": max_tokens})
        return f"[LangChain Mock] Generated for: {prompt[:200]}"


class LangChainLLM(LLMClient):
    """Wraps a langchain ChatModel into the CyberForge LLMClient interface.

    Supports:
    - Google Gemini (langchain-google-genai)
    - Any ChatModel that implements .invoke()
    """

    def __init__(
        self,
        provider: str = "gemini",
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.2,
        max_retries: int = 3,
    ):
        self.provider = provider
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model_name = model_name or os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        self.temperature = temperature
        self.max_retries = max_retries
        self._chat_model = self._build_chat_model()

    def _build_chat_model(self):
        """Construct the underlying LangChain ChatModel."""
        if self.provider == "gemini":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI

                model = ChatGoogleGenerativeAI(
                    model=self.model_name,
                    google_api_key=self.api_key,
                    temperature=self.temperature,
                    max_retries=self.max_retries,
                    max_output_tokens=8192,
                )
                logger.info(
                    "LangChainLLM: built ChatGoogleGenerativeAI model=%s",
                    self.model_name,
                )
                return model
            except Exception as exc:
                logger.exception("Failed to build ChatGoogleGenerativeAI: %s", exc)
                raise
        else:
            raise ValueError(f"Unsupported LangChain provider: {self.provider}")

    def generate(self, prompt: str, max_tokens: int = 8192) -> str:
        """Invoke the underlying ChatModel and return plain text."""
        from langchain_core.messages import HumanMessage

        try:
            response = self._chat_model.invoke(
                [HumanMessage(content=prompt)],
            )
            text = response.content if hasattr(response, "content") else str(response)
            return text
        except Exception as exc:
            logger.exception("LangChainLLM.generate failed: %s", exc)
            raise

    def generate_structured(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 8192
    ) -> str:
        """Generate with system + human messages for better agent control."""
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        try:
            response = self._chat_model.invoke(messages)
            return response.content if hasattr(response, "content") else str(response)
        except Exception as exc:
            logger.exception("LangChainLLM.generate_structured failed: %s", exc)
            raise

    @property
    def chat_model(self):
        """Expose the underlying LangChain ChatModel for direct use in chains/graphs."""
        return self._chat_model


def create_langchain_client(
    provider: str = "gemini",
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
) -> LLMClient:
    """Factory: create a LangChain-backed LLMClient.

    Falls back to LangChainMock when credentials are missing or init fails.
    """
    use_real = os.environ.get("USE_REAL_GEMINI") in ("1", "true", "True")
    key = api_key or os.environ.get("GEMINI_API_KEY", "")

    logger.info(
        "create_langchain_client: provider=%s, use_real=%s, key_present=%s",
        provider,
        use_real,
        bool(key),
    )

    if use_real and key:
        try:
            client = LangChainLLM(
                provider=provider, api_key=key, model_name=model_name
            )
            logger.info("LangChain client created: provider=%s, model=%s", provider, client.model_name)
            return client
        except Exception as exc:
            logger.warning("LangChain init failed, falling back to mock: %s", exc)
            return LangChainMock()

    logger.info("Using LangChainMock (USE_REAL_GEMINI not set or no API key)")
    return LangChainMock()
