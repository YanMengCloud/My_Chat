import json
import logging
from datetime import datetime
from bson import ObjectId, json_util
from tornado.web import RequestHandler
from utils.database import Database
from utils.openai_client import OpenAIClient

logger = logging.getLogger(__name__)


class ConversationHandler(RequestHandler):
    """会话管理处理器"""

    def get_current_user(self):
        """获取当前用户"""
        user_id = self.get_secure_cookie("user_id")
        return user_id.decode("utf-8") if user_id else None

    def get(self, conversation_id=None, action=None):
        """处理GET请求"""
        try:
            if not self.current_user:
                self.set_status(401)
                self.write({"success": False, "error": "未登录"})
                return

            if conversation_id:
                # 获取单个会话
                conversation = Database.get_conversation(conversation_id)
                if not conversation:
                    self.set_status(404)
                    self.write({"success": False, "error": "会话不存在"})
                    return

                # 验证用户权限
                if str(conversation["user_id"]) != self.current_user:
                    self.set_status(403)
                    self.write({"success": False, "error": "无权访问此会话"})
                    return

                if action == "messages":
                    # 获取会话消息
                    messages = Database.get_messages(conversation_id)
                    self.write(
                        {
                            "success": True,
                            "messages": json.loads(json_util.dumps(messages)),
                        }
                    )
                else:
                    # 返回会话信息
                    self.write(
                        {
                            "success": True,
                            "conversation": json.loads(json_util.dumps(conversation)),
                        }
                    )
            else:
                # 获取用户的所有会话
                conversations = Database.get_conversations(self.current_user)
                self.write(
                    {
                        "success": True,
                        "conversations": json.loads(json_util.dumps(conversations)),
                    }
                )

        except Exception as e:
            logger.error(f"处理请求失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def post(self, conversation_id=None, action=None):
        """处理POST请求"""
        try:
            if not self.current_user:
                self.set_status(401)
                self.write({"success": False, "error": "未登录"})
                return

            if conversation_id:
                # 获取会话
                conversation = Database.get_conversation(conversation_id)
                if not conversation:
                    self.set_status(404)
                    self.write({"success": False, "error": "会话不存在"})
                    return

                # 验证用户权限
                if str(conversation["user_id"]) != self.current_user:
                    self.set_status(403)
                    self.write({"success": False, "error": "无权访问此会话"})
                    return

                if action == "messages":
                    # 添加新消息
                    data = json.loads(self.request.body)
                    content = data.get("content")
                    role = data.get("role", "user")

                    if not content:
                        self.set_status(400)
                        self.write({"success": False, "error": "消息内容不能为空"})
                        return

                    # 保存用户消息
                    message = Database.create_message(conversation_id, role, content)
                    self.write(
                        {
                            "success": True,
                            "message": json.loads(json_util.dumps(message)),
                        }
                    )
                    return

            # 创建新会话
            data = json.loads(self.request.body)
            title = data.get("title", "新会话")
            model_id = data.get("model_id")  # 直接使用model_id
            system_prompt = data.get("system_prompt", "")

            if not model_id:
                self.set_status(400)
                self.write({"success": False, "error": "模型ID不能为空"})
                return

            # 创建会话
            conversation = Database.create_conversation(
                user_id=self.current_user,
                title=title,
                system_prompt=system_prompt,
                model_id=model_id,
            )

            self.write(
                {
                    "success": True,
                    "conversation": json.loads(json_util.dumps(conversation)),
                }
            )

        except Exception as e:
            logger.error(f"处理请求失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def patch(self, conversation_id=None, action=None):
        """处理PATCH请求"""
        try:
            if not self.current_user:
                self.set_status(401)
                self.write({"success": False, "error": "未登录"})
                return

            if not conversation_id:
                self.set_status(400)
                self.write({"success": False, "error": "会话ID不能为空"})
                return

            # 获取会话
            conversation = Database.get_conversation(conversation_id)
            if not conversation:
                self.set_status(404)
                self.write({"success": False, "error": "会话不存在"})
                return

            # 验证用户权限
            if str(conversation["user_id"]) != self.current_user:
                self.set_status(403)
                self.write({"success": False, "error": "无权修改此会话"})
                return

            # 更新会话
            data = json.loads(self.request.body)
            update_data = {}

            if "title" in data:
                update_data["title"] = data["title"]
            if "system_prompt" in data:
                update_data["system_prompt"] = data["system_prompt"]
            if "model_id" in data:
                update_data["model_id"] = data["model_id"]  # 直接更新model_id

            if update_data:
                update_data["updated_at"] = datetime.utcnow()
                Database.update_conversation(conversation_id, update_data)
                conversation.update(update_data)

            self.write(
                {
                    "success": True,
                    "conversation": json.loads(json_util.dumps(conversation)),
                }
            )

        except Exception as e:
            logger.error(f"处理请求失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def put(self, conversation_id=None, action=None):
        """处理PUT请求"""
        try:
            if not self.current_user:
                self.set_status(401)
                self.write({"success": False, "error": "未登录"})
                return

            if not conversation_id:
                self.set_status(400)
                self.write({"success": False, "error": "会话ID不能为空"})
                return

            # 获取会话
            conversation = Database.get_conversation(conversation_id)
            if not conversation:
                self.set_status(404)
                self.write({"success": False, "error": "会话不存在"})
                return

            # 验证用户权限
            if str(conversation["user_id"]) != self.current_user:
                self.set_status(403)
                self.write({"success": False, "error": "无权修改此会话"})
                return

            # 更新会话
            data = json.loads(self.request.body)
            update_data = {}

            if "title" in data:
                update_data["title"] = data["title"]
            if "system_prompt" in data:
                update_data["system_prompt"] = data["system_prompt"]
            if "model_id" in data:
                update_data["model_id"] = data["model_id"]

            if update_data:
                update_data["updated_at"] = datetime.utcnow()
                Database.update_conversation(conversation_id, update_data)
                conversation.update(update_data)

            self.write(
                {
                    "success": True,
                    "conversation": json.loads(json_util.dumps(conversation)),
                }
            )

        except Exception as e:
            logger.error(f"处理请求失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def delete(self, conversation_id=None, action=None):
        """处理DELETE请求"""
        try:
            if not self.current_user:
                self.set_status(401)
                self.write({"success": False, "error": "未登录"})
                return

            if not conversation_id:
                self.set_status(400)
                self.write({"success": False, "error": "会话ID不能为空"})
                return

            # 获取会话
            conversation = Database.get_conversation(conversation_id)
            if not conversation:
                self.set_status(404)
                self.write({"success": False, "error": "会话不存在"})
                return

            # 验证用户权限
            if str(conversation["user_id"]) != self.current_user:
                self.set_status(403)
                self.write({"success": False, "error": "无权删除此会话"})
                return

            # 删除会话及其消息
            Database.delete_conversation(conversation_id)
            self.write({"success": True})

        except Exception as e:
            logger.error(f"处理请求失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def check_xsrf_cookie(self):
        """禁用XSRF检查，因为我们使用自定义的XSRF令牌"""
        pass

    def set_default_headers(self):
        """设置CORS头"""
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, X-XSRFToken")
        self.set_header(
            "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        )

    def options(self, *args, **kwargs):
        """处理OPTIONS请求"""
        self.set_status(204)
        self.finish()
