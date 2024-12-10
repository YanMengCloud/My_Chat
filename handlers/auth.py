import json
import logging
from tornado.web import RequestHandler
from utils.database import Database
from bson import ObjectId

logger = logging.getLogger(__name__)


class AuthHandler(RequestHandler):
    """用户认证处理器"""

    def check_xsrf_cookie(self):
        """禁用XSRF检查，因为我们使用自定义的XSRF令牌"""
        pass

    def get_current_user(self):
        """获取当前用户"""
        user_id = self.get_secure_cookie("user_id")
        if user_id:
            try:
                return user_id.decode("utf-8")
            except:
                return None
        return None

    def post(self):
        """处理登录请求"""
        try:
            data = json.loads(self.request.body)
            username = data.get("username")
            password = data.get("password")

            logger.info(f"尝试登录用户: {username}")

            if not username or not password:
                logger.warning("登录失败：用户名或密码为空")
                self.set_status(400)
                self.write({"error": "用户名和��码不能为空"})
                return

            # 查找用户
            user = Database.get_user(username, password)
            if user:
                user_id = str(user["_id"])
                logger.info(f"用户 {username} 登录成功，ID: {user_id}")
                # 设置会话cookie
                self.set_secure_cookie("user_id", user_id)
                self.write(
                    {
                        "success": True,
                        "user": {"id": user_id, "username": user["username"]},
                    }
                )
            else:
                logger.warning(f"用户 {username} 登录失败：用户名或密码错误")
                self.set_status(401)
                self.write({"error": "用户名或密码错误"})

        except json.JSONDecodeError:
            logger.error("登录失败：无效的JSON数据")
            self.set_status(400)
            self.write({"error": "无效的JSON数据"})
        except Exception as e:
            logger.error(f"登录失败: {str(e)}")
            self.set_status(500)
            self.write({"error": str(e)})

    def get(self):
        """获取当前用户信息"""
        user_id = self.get_current_user()
        if not user_id:
            self.set_status(401)
            self.write({"error": "未登录"})
            return

        try:
            # 确保user_id是有效的ObjectId
            if not ObjectId.is_valid(user_id):
                logger.warning(f"无效的用户ID: {user_id}")
                self.clear_cookie("user_id")
                self.set_status(401)
                self.write({"error": "无效的用户ID"})
                return

            user = Database.get_user_by_id(user_id)
            if user:
                logger.info(f"获取用户信息成功: {user['username']}")
                self.write(
                    {
                        "user": {
                            "id": str(user["_id"]),
                            "username": user["username"],
                        },
                    }
                )
            else:
                logger.warning(f"用户不存在: {user_id}")
                self.clear_cookie("user_id")
                self.set_status(401)
                self.write({"error": "用户不存在"})

        except Exception as e:
            logger.error(f"获取用户信息失败: {str(e)}")
            self.set_status(500)
            self.write({"error": str(e)})

    def delete(self):
        """退出登录"""
        user_id = self.get_current_user()
        if user_id:
            logger.info(f"用户 {user_id} 退出登录")
        self.clear_cookie("user_id")
        self.write({"success": True})

    def set_default_headers(self):
        """设置CORS头"""
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, X-XSRFToken")
        self.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")

    def options(self):
        """处理OPTIONS请求"""
        self.set_status(204)
        self.finish()
