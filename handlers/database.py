import json
import logging
from bson import ObjectId, json_util
from tornado.web import RequestHandler
from utils.database import Database

logger = logging.getLogger(__name__)


class DatabaseHandler(RequestHandler):
    """数据库管理处理器"""

    def get(self, action=None):
        """处理GET请求"""
        try:
            if action == "collections":
                # 获取所有集合列表
                collections = Database.list_collections()
                self.write({"success": True, "collections": collections})

            elif action == "data":
                # 获取指定集合的数据
                collection = self.get_argument("collection", None)
                page = int(self.get_argument("page", 1))
                page_size = int(self.get_argument("page_size", 10))
                query = self.get_argument("query", "{}")

                if not collection:
                    raise ValueError("未指定集合名称")

                data = Database.get_collection_data(collection, query, page, page_size)
                self.write(json_util.dumps({"success": True, **data}))
                self.set_header("Content-Type", "application/json")

            else:
                self.set_status(400)
                self.write({"success": False, "error": "无效的操作"})

        except Exception as e:
            logger.error(f"数据库操作失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def post(self, action=None):
        """处理POST请求"""
        try:
            data = json.loads(self.request.body)
            collection = data.get("collection")

            if not collection:
                raise ValueError("未指定集合名称")

            if action == "update":
                # 更新数据
                doc_id = data.get("_id")
                if not doc_id:
                    raise ValueError("未指定文档ID")

                update_data = data.get("document", {})
                Database.update_document(collection, doc_id, update_data)
                self.write({"success": True})

            else:
                self.set_status(400)
                self.write({"success": False, "error": "无效的操作"})

        except Exception as e:
            logger.error(f"数据库操作失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def delete(self, action=None):
        """处理DELETE请求"""
        try:
            if action == "document":
                # 删除单个文档
                collection = self.get_argument("collection", None)
                doc_id = self.get_argument("id", None)

                if not collection or not doc_id:
                    raise ValueError("未指定集合名称或文档ID")

                Database.delete_document(collection, doc_id)
                self.write({"success": True})

            elif action == "truncate":
                # 清空集合
                collection = self.get_argument("collection", None)
                if not collection:
                    raise ValueError("未指定集合名称")

                Database.truncate_collection(collection)
                self.write({"success": True})

            else:
                self.set_status(400)
                self.write({"success": False, "error": "无效的操作"})

        except Exception as e:
            logger.error(f"数据库操作失败: {str(e)}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def set_default_headers(self):
        """设置CORS头"""
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, X-XSRFToken")
        self.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")

    def options(self, *args, **kwargs):
        """处理OPTIONS请求"""
        self.set_status(204)
        self.finish()
