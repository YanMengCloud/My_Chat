import os
from dotenv import load_dotenv

# 加载.env文件中的环境变量
load_dotenv()

SETTINGS = {
    "debug": True,
    "port": int(os.getenv("PORT", 8888)),
    "cookie_secret": os.getenv("COOKIE_SECRET", "your-secret-key"),
    "openai_api_key": os.getenv("OPENAI_API_KEY"),
    "database": {
        "host": os.getenv("MONGODB_HOST", "localhost"),
        "port": int(os.getenv("MONGODB_PORT", 27018)),
        "name": os.getenv("MONGODB_NAME", "ymbox_ai_chat"),
    },
}

# OpenAI API配置
OPENAI_CONFIG = {
    "api_key": os.getenv("OPENAI_API_KEY"),
    "base_url": os.getenv("OPENAI_BASE_URL", "https://api.apiyi.com"),
    "default_model": "gpt-3.5-turbo",
    "models": [
        {"id": "gpt-4", "object": "model", "owned_by": "openai", "permission": []},
        {"id": "gpt-4-0314", "object": "model", "owned_by": "openai", "permission": []},
        {"id": "gpt-4-0613", "object": "model", "owned_by": "openai", "permission": []},
        {"id": "gpt-4-32k", "object": "model", "owned_by": "openai", "permission": []},
        {
            "id": "gpt-4-32k-0314",
            "object": "model",
            "owned_by": "openai",
            "permission": [],
        },
        {
            "id": "gpt-4-32k-0613",
            "object": "model",
            "owned_by": "openai",
            "permission": [],
        },
        {
            "id": "gpt-3.5-turbo",
            "object": "model",
            "owned_by": "openai",
            "permission": [],
        },
        {
            "id": "gpt-3.5-turbo-0301",
            "object": "model",
            "owned_by": "openai",
            "permission": [],
        },
        {
            "id": "gpt-3.5-turbo-0613",
            "object": "model",
            "owned_by": "openai",
            "permission": [],
        },
        {
            "id": "gpt-3.5-turbo-16k",
            "object": "model",
            "owned_by": "openai",
            "permission": [],
        },
        {
            "id": "gpt-3.5-turbo-16k-0613",
            "object": "model",
            "owned_by": "openai",
            "permission": [],
        },
    ],
}
