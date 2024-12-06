# app.py
import os
import logging
from tornado.web import Application, RequestHandler
from tornado.ioloop import IOLoop
from handlers.chat import ChatWebSocket
from handlers.model import ModelsHandler
from handlers.database import DatabaseHandler
from handlers.auth import AuthHandler
from handlers.conversation import ConversationHandler
from config.settings import SETTINGS
from utils.database import Database


class BaseHandler(RequestHandler):
    """基础处理器"""

    def get_current_user(self):
        """获取当前用户"""
        user_id = self.get_secure_cookie("user_id")
        return user_id.decode("utf-8") if user_id else None


class MainHandler(BaseHandler):
    """主页处理器"""

    def get(self):
        """处理GET请求"""
        if not self.current_user:
            self.redirect("/login")
            return
        self.render("chat.html")


class LoginHandler(BaseHandler):
    """登录页面处理器"""

    def get(self):
        """处理GET请求"""
        if self.current_user:
            self.redirect("/")
            return
        self.render("login.html")


class ModelsPageHandler(BaseHandler):
    """模型管理页面处理器"""

    def get(self):
        """处理GET请求"""
        if not self.current_user:
            self.redirect("/login")
            return
        self.render("models.html")


class DatabasePageHandler(BaseHandler):
    """数据库管理页面处理器"""

    def get(self):
        """处理GET请求"""
        if not self.current_user:
            self.redirect("/login")
            return
        self.render("database.html")


def make_app():
    """创建Tornado应用"""
    return Application(
        [
            (r"/", MainHandler),  # 主页
            (r"/login", LoginHandler),  # 登录页面
            (r"/models", ModelsPageHandler),  # 模型管理页面
            (r"/database", DatabasePageHandler),  # 数据库管理页面
            (r"/ws/chat", ChatWebSocket),  # WebSocket连接
            (r"/api/auth", AuthHandler),  # 用户认证
            (r"/api/models", ModelsHandler),  # 模型管理API
            (r"/api/database(?:/([^/]+))?", DatabaseHandler),  # 数据库管理API
            (
                r"/api/conversations(?:/([^/]+))?(?:/([^/]+))?",
                ConversationHandler,
            ),  # 会话管理API
        ],
        template_path=os.path.join(os.path.dirname(__file__), "templates"),
        static_path=os.path.join(os.path.dirname(__file__), "static"),
        cookie_secret=SETTINGS["cookie_secret"],  # 用于安全cookie
        login_url="/login",  # 登录页面URL
        xsrf_cookies=True,  # 启用XSRF保护
        debug=SETTINGS["debug"],
    )


def main():
    """主函数"""
    try:
        app = make_app()
        app.listen(SETTINGS["port"])
        logging.info(f"服务器启动在 http://localhost:{SETTINGS['port']}")

        # 注册清理函数
        def cleanup():
            logging.info("正在关闭服务器...")
            Database.cleanup()
            logging.info("服务器已关闭")

        import atexit

        atexit.register(cleanup)

        # 启动事件循环
        IOLoop.current().start()
    except Exception as e:
        logging.error(f"服务器启动失败: {str(e)}")
        raise
    finally:
        Database.cleanup()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    main()