import json
import logging
import requests
from datetime import datetime
from config.settings import OPENAI_CONFIG

logger = logging.getLogger(__name__)


class OpenAIClient:
    def __init__(self):
        self.api_key = OPENAI_CONFIG["api_key"]
        self.base_url = OPENAI_CONFIG["base_url"]
        self.model = "gpt-3.5-turbo"

    def _convert_to_serializable(self, obj):
        """将对象转换为可序列化的格式"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif hasattr(obj, "__dict__"):
            return self._convert_to_serializable(obj.__dict__)
        elif isinstance(obj, dict):
            return {
                self._convert_to_serializable(key): self._convert_to_serializable(value)
                for key, value in obj.items()
            }
        elif isinstance(obj, list):
            return [self._convert_to_serializable(item) for item in obj]
        elif hasattr(obj, "_id"):  # 处理 MongoDB ObjectId
            return str(obj)
        else:
            return str(obj) if hasattr(obj, "__str__") else obj

    def _parse_sse_line(self, line):
        """解析 SSE 格式的数据行"""
        if not line:
            return None
        if line.startswith("data: "):
            try:
                data = json.loads(line[6:])  # 去掉 'data: ' 前缀
                if data.get("choices") and len(data["choices"]) > 0:
                    delta = data["choices"][0].get("delta", {})
                    return delta.get("content", "")
            except json.JSONDecodeError as e:
                logger.error(f"解析 SSE 数据失败: {str(e)}, line: {line}")
        return None

    def get_available_models(self):
        """获取可用模型列表"""
        try:
            url = f"{self.base_url}/v1/models"
            headers = {"Authorization": f"Bearer {self.api_key}"}

            response = requests.get(url, headers=headers)
            response.raise_for_status()

            return response.json()

        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            # 如果API调用失败，返回配置中的默认模型列表
            return {
                "object": "list",
                "data": [
                    {"id": "gpt-4", "object": "model", "owned_by": "openai"},
                    {"id": "gpt-4-32k", "object": "model", "owned_by": "openai"},
                    {"id": "gpt-3.5-turbo", "object": "model", "owned_by": "openai"},
                    {
                        "id": "gpt-3.5-turbo-16k",
                        "object": "model",
                        "owned_by": "openai",
                    },
                ],
            }

    def chat_stream(self, messages, model=None):
        """流式对话"""
        try:
            url = f"{self.base_url}/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "text/event-stream",
            }
            data = {
                "model": model or self.model,
                "messages": messages,
                "stream": True,
            }

            response = requests.post(url, headers=headers, json=data, stream=True)
            response.raise_for_status()

            for line in response.iter_lines():
                if line:
                    line = line.decode("utf-8")
                    if line.startswith("data: "):
                        if line.startswith("data: [DONE]"):
                            break
                        content = self._parse_sse_line(line)
                        if content:
                            yield content

        except Exception as e:
            logger.error(f"调用OpenAI API失败: {str(e)}")
            raise
