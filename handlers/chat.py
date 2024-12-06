import json
import logging
from datetime import datetime
from tornado.websocket import WebSocketHandler
from utils.database import Database
from utils.openai_client import OpenAIClient
from bson import ObjectId, json_util

logger = logging.getLogger(__name__)


class ChatWebSocket(WebSocketHandler):
    """聊天WebSocket处理器"""

    def check_origin(self, origin):
        """允许WebSocket跨域"""
        return True

    def get_current_user(self):
        """获取当前用户"""
        user_id = self.get_secure_cookie("user_id")
        return user_id.decode("utf-8") if user_id else None

    def open(self):
        """处理WebSocket连接打开"""
        if not self.current_user:
            self.close(403, "未登录")
            return
        logger.info(f"WebSocket连接已打开: {self.current_user}")

    def on_close(self):
        """处理WebSocket连接关闭"""
        logger.info(f"WebSocket连接已关闭: {self.current_user}")

    def _format_message(self, message):
        """格式化消息，只保留 OpenAI API 所需的字段"""
        # 只保留 OpenAI API 所需的基本字段
        formatted = {"role": message["role"], "content": message["content"]}

        # 如果有 name 字段（用于 function calling），也保留它
        if "name" in message:
            formatted["name"] = message["name"]

        return formatted

    def on_message(self, message):
        """处理接收到的消息"""
        try:
            data = json.loads(message)
            conversation_id = data.get("conversation_id")
            content = data.get("content")
            role = data.get("role", "user")

            if not conversation_id or not content:
                self.write_message(
                    {"type": "error", "error": "会话ID和消息内容不能为空"}
                )
                return

            # 获取会话信息
            conversation = Database.get_conversation(conversation_id)
            if not conversation:
                self.write_message({"type": "error", "error": "会话不存在"})
                return

            logger.info(f"获取到会话信息: {conversation}")

            # 验证用户权限
            if str(conversation["user_id"]) != self.current_user:
                self.write_message({"type": "error", "error": "无权访问此会话"})
                return

            # 保存用户消息
            user_message = Database.create_message(conversation_id, role, content)
            self.write_message(
                {"type": "user", "message": json.loads(json_util.dumps(user_message))}
            )

            # 获取会话历史
            messages = Database.get_messages(conversation_id)
            formatted_messages = []

            # 检查系统提示词
            system_prompt = None
            if isinstance(conversation.get("model_id"), dict):
                system_prompt = conversation["model_id"].get("system_prompt")
            else:
                system_prompt = conversation.get("system_prompt")

            logger.info(f"系统提示词: {system_prompt}")

            # 添加系统提示
            if system_prompt:
                formatted_messages.append({"role": "system", "content": system_prompt})
                logger.info("已添加系统提示词到消息列表")

            # 添加历史消息，确保每条消息都是可序列化的
            for msg in messages:
                formatted_messages.append(self._format_message(msg))

            # logger.info(f"格式化后的消息列表: {formatted_messages}")

            # 调用OpenAI API
            client = OpenAIClient()
            try:
                # 直接使用会话中的model_id
                model_id = conversation.get("model_id")
                if isinstance(model_id, dict):
                    model_id = model_id.get("model_id")

                logger.info(f"使用的模型ID: {model_id}")

                response = client.chat_stream(
                    messages=formatted_messages, model=model_id or "gpt-3.5-turbo"
                )

                # 处理流式响应
                collected_content = []
                for content in response:
                    if content:
                        collected_content.append(content)
                        self.write_message({"type": "stream", "content": content})

                # 保存完整的助手回复
                full_content = "".join(collected_content)
                if full_content:
                    ai_message = Database.create_message(
                        conversation_id, "assistant", full_content
                    )
                    self.write_message(
                        {
                            "type": "done",
                            "message": json.loads(json_util.dumps(ai_message)),
                        }
                    )

            except Exception as e:
                logger.error(f"调用OpenAI API失败: {str(e)}")
                self.write_message(
                    {"type": "error", "error": f"调用AI服务失败: {str(e)}"}
                )

        except json.JSONDecodeError:
            self.write_message({"type": "error", "error": "无效的JSON数据"})
        except Exception as e:
            logger.error(f"处理消息失败: {str(e)}")
            self.write_message({"type": "error", "error": str(e)})

    def write_message(self, message):
        """发送消息给客户端"""
        if isinstance(message, dict):
            message = json.dumps(message)
        super().write_message(message)
