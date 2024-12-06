import json
import logging
from bson import ObjectId, json_util
from tornado.web import RequestHandler
from utils.database import Database

logger = logging.getLogger(__name__)


class DatabaseHandler(RequestHandler):
    """数据库管理处理器"""

    def initialize(self):
        """初始化处理器"""
        if Database.db is None:
            Database.init()

    def get(self, action=None):
        """处理GET请求"""
        try:
            if Database.db is None:
                raise ValueError("数据库未连接")

            if action == "collections":
                # 获取所有集合列表
                collections = Database.list_collections()
                collections_info = []
                for col in collections:
                    count = Database.get_collection_count(col)
                    collections_info.append({"name": col, "count": count})
                self.write({"success": True, "collections": collections_info})

            elif action == "data":
                # 获取指定集合的数据
                collection = self.get_argument("collection", None)
                page = int(self.get_argument("page", 1))
                limit = int(self.get_argument("limit", 10))
                query = self.get_argument("query", "{}")

                if not collection:
                    raise ValueError("未指定集合名称")

                # 解析查询条件
                try:
                    query_dict = json.loads(query)
                except json.JSONDecodeError:
                    query_dict = {}

                # 获取总数
                total = Database.get_collection_count(collection)

                # 获取数据
                skip = (page - 1) * limit
                cursor = Database.find_documents(collection, query_dict, skip, limit)

                # 使用json_util处理MongoDB特殊类型
                data = json.loads(json_util.dumps(list(cursor)))

                self.write(
                    {
                        "success": True,
                        "data": data,
                        "total": total,
                        "page": page,
                        "limit": limit,
                    }
                )

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

            if action == "insert":
                # 插入数据
                doc = data.get("document", {})
                result = Database.insert_document(collection, doc)
                self.write({"success": True, "inserted_id": str(result)})

            elif action == "update":
                # 更新数据
                doc_id = data.get("_id")
                if not doc_id:
                    raise ValueError("未指定文档ID")

                update_data = data.get("document", {})
                if "_id" in update_data:
                    del update_data["_id"]

                result = Database.update_document(collection, doc_id, update_data)
                self.write({"success": True, "modified_count": result})

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

                result = Database.delete_document(collection, doc_id)
                self.write({"success": True, "deleted_count": result})

            elif action == "truncate":
                # 清空集合
                collection = self.get_argument("collection", None)
                if not collection:
                    raise ValueError("未指定集合名称")

                result = Database.truncate_collection(collection)
                self.write({"success": True, "deleted_count": result})

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
