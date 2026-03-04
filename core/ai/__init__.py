"""AI helpers package — supports both native Gemini and LangChain backends."""
from .gemini_wrapper import create_llm_client, MockGemini, GeminiClient, LLMClient
from .langchain_llm import create_langchain_client, LangChainLLM, LangChainMock
from .prompt import PromptLoader
