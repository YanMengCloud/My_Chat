import logging
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from bson import ObjectId
from pymongo import MongoClient
import hashlib

logger = logging.getLogger(__name__)


class Database:
    client = None
    db = None

    @classmethod
    def initialize(cls, mongodb_uri: str, database_name: str) -> None:
        """初始化数据库连接

        Args:
            mongodb_uri: MongoDB连接URI
            database_name: 数据库名称
        """
        try:
            if cls.client is None:
                cls.client = MongoClient(mongodb_uri)
                cls.db = cls.client[database_name]
                # 测试连接
                cls.db.command("ping")
                logger.info("数据库连接初始化成功")
        except Exception as e:
            logger.error(f"数据库连接初始化失败: {str(e)}")
            raise

    @classmethod
    def ensure_connection(cls):
        """确保数据库连接存在"""
        if cls.db is None:
            raise RuntimeError("数据库未初始化")
        return cls.db

    @classmethod
    def list_collections(cls) -> List[Dict[str, Any]]:
        """获取数据库中的所有集合信息

        Returns:
            List[Dict[str, Any]]: 集合信息列表，每个集合包含名称和文档数量
        """
        try:
            db = cls.ensure_connection()
            collections = []

            # 获取所有集合
            for collection_name in db.list_collection_names():
                # 获取集合文档数量
                count = db[collection_name].count_documents({})
                collections.append({"name": collection_name, "count": count})

            # 按名称排序
            collections.sort(key=lambda x: x["name"])
            return collections

        except Exception as e:
            logger.error(f"获取集合列表失败: {str(e)}")
            raise

    @classmethod
    def get_collection_count(cls, collection_name: str) -> int:
        """获取集合中的文档数量

        Args:
            collection_name: 集合名称

        Returns:
            int: 文档数量
        """
        try:
            db = cls.ensure_connection()
            return db[collection_name].count_documents({})
        except Exception as e:
            logger.error(f"获取集合 {collection_name} 文档数量失败: {str(e)}")
            raise

    @classmethod
    def get_collection_data(
        cls, collection_name: str, query: str = "{}", page: int = 1, page_size: int = 10
    ) -> Dict[str, Any]:
        """获取集合中的数据

        Args:
            collection_name: 集合名称
            query: JSON格式的查询条件
            page: 页码
            page_size: 每页数量

        Returns:
            Dict[str, Any]: 包含数据和分页信息
        """
        try:
            db = cls.ensure_connection()
            collection = db[collection_name]

            # 解析查询条件
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                query_dict = {}

            # 计算总数
            total = collection.count_documents(query_dict)

            # 计算分页
            skip = (page - 1) * page_size

            # 获取数据
            cursor = collection.find(query_dict).skip(skip).limit(page_size)
            documents = []

            for doc in cursor:
                # 处理ObjectId
                doc["_id"] = str(doc["_id"])
                # 处理日期字段
                for key, value in doc.items():
                    if isinstance(value, datetime):
                        doc[key] = value.isoformat()
                documents.append(doc)

            return {
                "total": total,
                "page": page,
                "page_size": page_size,
                "data": documents,
            }

        except Exception as e:
            logger.error(f"获取集合 {collection_name} 数据失败: {str(e)}")
            raise

    @classmethod
    def truncate_collection(cls, collection_name: str) -> None:
        """清空集合中的所有数据

        Args:
            collection_name: 集合名称
        """
        try:
            db = cls.ensure_connection()
            db[collection_name].delete_many({})
        except Exception as e:
            logger.error(f"清空集合 {collection_name} 失败: {str(e)}")
            raise

    @classmethod
    def delete_document(cls, collection_name: str, document_id: str) -> None:
        """删除集合中的指定文档

        Args:
            collection_name: 集合名称
            document_id: 文档ID
        """
        try:
            db = cls.ensure_connection()
            if not ObjectId.is_valid(document_id):
                raise ValueError("无效的文档ID")

            result = db[collection_name].delete_one({"_id": ObjectId(document_id)})
            if result.deleted_count == 0:
                raise ValueError("文档不存在")

        except Exception as e:
            logger.error(f"删除文档失败: {str(e)}")
            raise

    @classmethod
    def update_document(
        cls, collection_name: str, document_id: str, data: Dict[str, Any]
    ) -> None:
        """更新集合中的指定文档

        Args:
            collection_name: 集合名称
            document_id: 文档ID
            data: 更新的数据
        """
        try:
            db = cls.ensure_connection()
            if not ObjectId.is_valid(document_id):
                raise ValueError("无效的文档ID")

            # 移除_id字段（如果存在）
            if "_id" in data:
                del data["_id"]

            result = db[collection_name].update_one(
                {"_id": ObjectId(document_id)}, {"$set": data}
            )

            if result.matched_count == 0:
                raise ValueError("文档不存在")

        except Exception as e:
            logger.error(f"更新文档失败: {str(e)}")
            raise

    @classmethod
    def get_messages(
        cls,
        conversation_id: str,
        page_size: int = 10,
        page_token: str = None,
        target_message_id: str = None,
    ) -> Dict[str, Any]:
        """获取会话的消息列表

        Args:
            conversation_id: 会话ID
            page_size: 每页消息数量
            page_token: 分页标记，为消息ID，如果提供则获取该消息之前的消息
            target_message_id: 目标消息ID，如果提供则返回包含该消息的一页数据
        """
        try:
            db = cls.ensure_connection()

            if not ObjectId.is_valid(conversation_id):
                logger.error(f"无效的会话ID: {conversation_id}")
                return {"messages": [], "total": 0, "next_page_token": None}

            # 获取消息总数
            total = db.messages.count_documents(
                {"conversation_id": ObjectId(conversation_id)}
            )

            # 如果指定了目标消息ID
            if target_message_id and ObjectId.is_valid(target_message_id):
                # 获取目标消息
                target_message = db.messages.find_one(
                    {"_id": ObjectId(target_message_id)}
                )
                if target_message:
                    # 获取目标消息前后的消息
                    messages = list(
                        db.messages.find(
                            {
                                "conversation_id": ObjectId(conversation_id),
                                "created_at": {"$lte": target_message["created_at"]},
                            }
                        )
                        .sort("created_at", -1)
                        .limit(page_size)
                    )

                    # 判断是否还有更多消息
                    has_more = len(messages) == page_size
                    next_page_token = str(messages[-1]["_id"]) if has_more else None

                    # 序列化消息
                    serialized_messages = [cls.serialize_doc(msg) for msg in messages]

                    return {
                        "messages": serialized_messages,
                        "total": total,
                        "next_page_token": next_page_token,
                        "target_message_id": target_message_id,
                    }

            # 常规分页逻辑
            query = {"conversation_id": ObjectId(conversation_id)}
            if page_token and ObjectId.is_valid(page_token):
                last_message = db.messages.find_one({"_id": ObjectId(page_token)})
                if last_message:
                    query["created_at"] = {"$lt": last_message["created_at"]}

            # 获取消息并按时间倒序排序
            messages = list(
                db.messages.find(query)
                .sort("created_at", -1)  # -1 表示降序，最新的消息在前
                .limit(page_size + 1)  # 多获取一条用于判断是否还有更多
            )

            # 判断是否还有更多消息
            has_more = len(messages) > page_size
            if has_more:
                messages = messages[:page_size]
                next_page_token = str(messages[-1]["_id"])
            else:
                next_page_token = None

            # 序列化消息
            serialized_messages = [cls.serialize_doc(msg) for msg in messages]

            return {
                "messages": serialized_messages,
                "total": total,
                "next_page_token": next_page_token,
            }
        except Exception as e:
            logger.error(f"获取消息列表失败: {str(e)}")
            raise

    @classmethod
    def serialize_doc(cls, doc: Dict[str, Any]) -> Dict[str, Any]:
        """序列化文档，处理特殊类型（如ObjectId和datetime）

        Args:
            doc: MongoDB文档

        Returns:
            Dict[str, Any]: 序列化后的文档
        """
        serialized = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, datetime):
                serialized[key] = value.isoformat()
            else:
                serialized[key] = value
        return serialized

    @classmethod
    def get_conversations(cls, user_id: str) -> List[Dict[str, Any]]:
        """获取用户的所有会话

        Args:
            user_id: 用户ID

        Returns:
            List[Dict[str, Any]]: 会话列表
        """
        try:
            db = cls.ensure_connection()

            if not ObjectId.is_valid(user_id):
                logger.error(f"无效的用户ID: {user_id}")
                return []

            # 使用同步方法获取会话列表
            conversations = list(
                db.conversations.find({"user_id": ObjectId(user_id)}).sort(
                    "last_message_at", -1
                )
            )

            # 序列化文档
            return [cls.serialize_doc(conv) for conv in conversations]
        except Exception as e:
            logger.error(f"获取会话列表失败: {str(e)}")
            raise

    @classmethod
    def get_conversation(cls, conversation_id: str) -> Optional[Dict[str, Any]]:
        """获取单个会话的详细信息

        Args:
            conversation_id: 会话ID

        Returns:
            Optional[Dict[str, Any]]: 会话信息
        """
        try:
            db = cls.ensure_connection()

            if not ObjectId.is_valid(conversation_id):
                logger.error(f"无效的会话ID: {conversation_id}")
                return None

            conversation = db.conversations.find_one({"_id": ObjectId(conversation_id)})
            if conversation:
                return cls.serialize_doc(conversation)
            return None
        except Exception as e:
            logger.error(f"获取会话详情失败: {str(e)}")
            raise

    @classmethod
    def create_message(
        cls, conversation_id: str, role: str, content: str
    ) -> Dict[str, Any]:
        """创建新的消息

        Args:
            conversation_id: 会话ID
            role: 消息角色
            content: 消息内容

        Returns:
            Dict[str, Any]: 创建的消息
        """
        try:
            db = cls.ensure_connection()

            if not ObjectId.is_valid(conversation_id):
                logger.error(f"无效的会话ID: {conversation_id}")
                raise ValueError("无效的会话ID")

            # 创建消息文档
            message = {
                "conversation_id": ObjectId(conversation_id),
                "role": role,
                "content": content,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }

            # 插入消息
            result = db.messages.insert_one(message)
            message["_id"] = result.inserted_id

            # 更新会话的最后消息时间
            db.conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {"$set": {"last_message_at": datetime.utcnow()}},
            )

            # 序列化并返回消息
            return cls.serialize_doc(message)
        except Exception as e:
            logger.error(f"创建消息失败: {str(e)}")
            raise

    @classmethod
    def search_messages(cls, conversation_id: str, query: str) -> List[Dict[str, Any]]:
        """搜索会话中的消息

        Args:
            conversation_id: 会话ID
            query: 搜索关键词

        Returns:
            List[Dict[str, Any]]: 匹配的消息列表
        """
        try:
            db = cls.ensure_connection()

            if not ObjectId.is_valid(conversation_id):
                logger.error(f"无效的会话ID: {conversation_id}")
                return []

            if not query:
                return []

            # 使用正则表达式进行模糊搜索
            regex_pattern = {"$regex": query, "$options": "i"}
            messages = list(
                db.messages.find(
                    {
                        "conversation_id": ObjectId(conversation_id),
                        "content": regex_pattern,
                    }
                ).sort("created_at", -1)
            )

            # 序列化消息
            return [cls.serialize_doc(msg) for msg in messages]
        except Exception as e:
            logger.error(f"搜索消息失败: {str(e)}")
            raise

    @classmethod
    def get_user(cls, username: str, password: str) -> Optional[Dict[str, Any]]:
        """获取用户

        Args:
            username: 用户名
            password: 密码

        Returns:
            Optional[Dict[str, Any]]: 用户信息
        """
        try:
            db = cls.ensure_connection()
            # 对密码进行哈希处理
            hashed_password = hashlib.sha256(password.encode()).hexdigest()
            user = db.users.find_one(
                {"username": username, "password": hashed_password}
            )
            if user:
                return cls.serialize_doc(user)
            return None
        except Exception as e:
            logger.error(f"获取用户失败: {str(e)}")
            raise

    @classmethod
    def get_user_by_id(cls, user_id: str) -> Optional[Dict[str, Any]]:
        """通过ID获取用户

        Args:
            user_id: 用户ID

        Returns:
            Optional[Dict[str, Any]]: 用户信息
        """
        try:
            db = cls.ensure_connection()
            if not ObjectId.is_valid(user_id):
                return None
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                return cls.serialize_doc(user)
            return None
        except Exception as e:
            logger.error(f"通过ID获取用户失败: {str(e)}")
            raise

    @classmethod
    def create_user(cls, username: str, password: str) -> Dict[str, Any]:
        """创建新用户

        Args:
            username: 用户名
            password: 密码

        Returns:
            Dict[str, Any]: 创建的用户信息
        """
        try:
            db = cls.ensure_connection()
            # 检查用户名是否已存在
            if db.users.find_one({"username": username}):
                raise ValueError("用户名已存在")

            # 对密码进行哈希处理
            hashed_password = hashlib.sha256(password.encode()).hexdigest()

            user = {
                "username": username,
                "password": hashed_password,
                "created_at": datetime.utcnow(),
            }
            result = db.users.insert_one(user)
            user["_id"] = result.inserted_id
            return cls.serialize_doc(user)
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}")
            raise
