"""LLM client abstraction and a Gemini wrapper (and a test-friendly MockGemini).

This module provides:
- LLMClient: simple interface with generate(prompt, max_tokens=...) -> str
- MockGemini: deterministic mock used in CI and tests
- GeminiClient: placeholder for real Gemini integration (not implemented by default)
- create_llm_client: factory that returns GeminiClient if GEMINI_API_KEY is set, else MockGemini
"""
from __future__ import annotations

import os
import logging
import time
import random
from typing import Optional

logger = logging.getLogger("cyberforge.ai.gemini")


class LLMClient:
    def generate(self, prompt: str, max_tokens: int = 512) -> str:
        raise NotImplementedError


class MockGemini(LLMClient):
    def __init__(self):
        self.calls = []

    def generate(self, prompt: str, max_tokens: int = 512) -> str:
        self.calls.append({"prompt": prompt, "max_tokens": max_tokens})
        # Return a deterministic, short response useful for tests
        return f"GENERATED (mock): {prompt[:200]}"


class GeminiClient(LLMClient):
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model_name = model_name or os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
        if not self.api_key:
            raise RuntimeError("No GEMINI_API_KEY configured for GeminiClient")
        # lazily import the official GenAI client
        try:
            from google import genai
        except Exception as exc:  # pragma: no cover - integration only
            logger.exception("GenAI SDK import failed: %s", exc)
            raise
        self._genai = genai

    def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Call Google GenAI to generate content with retry/backoff for transient errors.

        Retries are attempted on transient server-side errors (5xx / ServerError / UNAVAILABLE).
        """
        logger.debug("GeminiClient: generating content (max_tokens=%s, model=%s)", max_tokens, self.model_name)
        client = self._genai.Client(api_key=self.api_key)

        max_attempts = 3
        base_backoff = 2.0
        last_exc = None

        for attempt in range(1, max_attempts + 1):
            try:
                response = client.models.generate_content(model=self.model_name, contents=prompt)
                text = getattr(response, "text", None)
                if text is None:
                    text = str(response)
                if attempt > 1:
                    logger.info("GeminiClient: succeeded on attempt %d", attempt)
                return text
            except Exception as exc:  # pragma: no cover - runtime/SDK errors
                last_exc = exc
                # Try to decide if it's transient (server-side) or fatal
                name = type(exc).__name__
                msg = str(exc)
                status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                is_server_error = False
                try:
                    # numeric status codes are common on HTTP error wrappers
                    is_server_error = isinstance(status_code, int) and status_code >= 500
                except Exception:
                    is_server_error = False

                retryable = is_server_error or ("ServerError" in name) or ("UNAVAILABLE" in msg) or ("timed out" in msg.lower())

                if attempt < max_attempts and retryable:
                    backoff = base_backoff * (2 ** (attempt - 1)) + random.uniform(0, 0.5)
                    logger.warning("GeminiClient: transient error (attempt %d/%d): %s — retrying in %.2fs", attempt, max_attempts, name, backoff)
                    time.sleep(backoff)
                    continue
                # Not retryable, or last attempt — re-raise
                logger.exception("GeminiClient: generation failed (attempt %d/%d): %s", attempt, max_attempts, name)
                raise
        # If we exhausted attempts, raise the last exception
        if last_exc:
            raise last_exc
        raise RuntimeError("GeminiClient: failed to generate content for unknown reasons")


def create_llm_client() -> LLMClient:
    # Default to MockGemini for tests and local development. To use a real Gemini client,
    # set USE_REAL_GEMINI=1 and provide GEMINI_API_KEY in the environment.
    use_real = os.environ.get("USE_REAL_GEMINI") in ("1", "true", "True")
    key_present = bool(os.environ.get("GEMINI_API_KEY"))
    logger.info(f"create_llm_client: USE_REAL_GEMINI={use_real}, GEMINI_API_KEY_present={key_present}")
    
    if use_real:
        if not key_present:
            logger.warning("USE_REAL_GEMINI requested but GEMINI_API_KEY missing; falling back to MockGemini")
            return MockGemini()
        try:
            logger.info("Attempting to create GeminiClient...")
            client = GeminiClient()
            logger.info(f"✅ GeminiClient created successfully with model={client.model_name}")
            return client
        except Exception as exc:
            logger.exception("Failed to initialize GeminiClient, falling back to MockGemini: %s", exc)
            return MockGemini()
    
    logger.info("Using MockGemini (USE_REAL_GEMINI not set to 1)")
    return MockGemini()
