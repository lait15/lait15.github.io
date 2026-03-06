from .base import BaseLLMProvider
from .google import GoogleProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider


def get_provider(provider_name: str, model_name: str) -> BaseLLMProvider:
    providers = {
        "google": GoogleProvider,
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
    }
    if provider_name not in providers:
        raise ValueError(f"Unknown provider: {provider_name}. Choose from: {list(providers.keys())}")
    return providers[provider_name](model_name)
