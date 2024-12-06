import json
import logging
import requests
from collections import defaultdict
from tornado.web import RequestHandler
from config.settings import OPENAI_CONFIG

logger = logging.getLogger(__name__)


class ModelsHandler(RequestHandler):
    """模型管理处理器"""

    def initialize(self):
        self.api_key = OPENAI_CONFIG["api_key"]
        self.base_url = OPENAI_CONFIG["base_url"]

    def get(self):
        """获取模型列表"""
        try:
            models = self.get_models_list()

            # 检查是否需要分组显示（用于模型管理页面）
            group_by_provider = self.get_argument("group", "false").lower() == "true"

            if group_by_provider:
                # 按 owned_by 分组（用于模型管理页面）
                grouped_models = defaultdict(list)
                for model in models:
                    owned_by = model.get("owned_by", "unknown")
                    grouped_models[owned_by].append(model)

                # 转换为列表格式
                result = [
                    {"provider": provider, "models": models_list}
                    for provider, models_list in grouped_models.items()
                ]

                logger.info(f"返回分组后的模型列表: {len(result)} 个提供商")
                self.write({"success": True, "model_groups": result})
            else:
                # 返回简单列表格式（用于聊天页面的下拉框）
                simple_models = [
                    {
                        "id": model["id"],
                        "name": model["name"],
                        "owned_by": model.get("owned_by", "unknown"),
                    }
                    for model in models
                ]
                logger.info(f"返回模型列表: {len(simple_models)} 个模型")
                self.write({"success": True, "models": simple_models})

        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def get_models_list(self):
        """获取完整的模型列表"""
        try:
            url = f"{self.base_url}/v1/models"
            headers = {"Authorization": f"Bearer {self.api_key}"}

            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            data = response.json()
            if not isinstance(data, dict) or "data" not in data:
                logger.error("API响应格式不正确")
                return self.get_default_models()

            models_data = data.get("data", [])
            if not models_data:
                return self.get_default_models()

            return [
                {
                    "id": model.get("id"),
                    "name": model.get("id").replace("-", " ").title(),
                    "owned_by": model.get("owned_by", "unknown"),
                    "created": model.get("created"),
                    "object": model.get("object"),
                    "permission": model.get("permission"),
                }
                for model in models_data
                if isinstance(model, dict) and "id" in model
            ]

        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            return self.get_default_models()

    def get_default_models(self):
        """返回默认的模型列表"""
        return [
            {
                "id": "gpt-4",
                "name": "GPT-4",
                "owned_by": "openai",
                "created": 1687882410,
                "object": "model",
                "permission": None,
            },
            {
                "id": "gpt-4-32k",
                "name": "GPT-4 32K",
                "owned_by": "openai",
                "created": 1687882410,
                "object": "model",
                "permission": None,
            },
            {
                "id": "gpt-3.5-turbo",
                "name": "GPT-3.5 Turbo",
                "owned_by": "openai",
                "created": 1687882410,
                "object": "model",
                "permission": None,
            },
            {
                "id": "gemini-1.0-pro-latest",
                "name": "Gemini Pro",
                "owned_by": "google",
                "created": 1687882410,
                "object": "model",
                "permission": None,
            },
        ]

    def set_default_headers(self):
        """设置CORS头"""
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, X-XSRFToken")
        self.set_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def options(self):
        """处理OPTIONS请求"""
        self.set_status(204)
        self.finish()
