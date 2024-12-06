import logging
import hashlib
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
from config.settings import SETTINGS

logger = logging.getLogger(__name__)


class Database:
    """数据库操作类"""

    client = None
    db = None

    @classmethod
    def init(cls):
        """初始化数据库连接"""
        try:
            if cls.client is None:
                cls.client = MongoClient(
                    host=SETTINGS["database"]["host"],
                    port=SETTINGS["database"]["port"],
                )
                cls.db = cls.client[SETTINGS["database"]["name"]]
                logger.info("数据库连接成功")
        except Exception as e:
            logger.error(f"数据库连接失败: {str(e)}")
            cls.client = None
            cls.db = None
            raise

    @classmethod
    def cleanup(cls):
        """清理数据库连接"""
        if cls.client is not None:
            cls.client.close()
            cls.client = None
            cls.db = None
            logger.info("数据库连接已关闭")

    @classmethod
    def ensure_connection(cls):
        """确保数据库连接"""
        if cls.db is None:
            cls.init()
        return cls.db

    @classmethod
    def list_collections(cls):
        """获取所有集合名称"""
        try:
            db = cls.ensure_connection()
            return db.list_collection_names()
        except Exception as e:
            logger.error(f"获取集合列表失败: {str(e)}")
            return []

    @classmethod
    def get_collection_count(cls, collection_name):
        """获取集合中的文档数量"""
        try:
            db = cls.ensure_connection()
            return db[collection_name].count_documents({})
        except Exception as e:
            logger.error(f"获取集合 {collection_name} 文档数量失败: {str(e)}")
            return 0

    @classmethod
    def find_documents(cls, collection_name, query=None, skip=0, limit=10):
        """查询集合中的文档"""
        try:
            db = cls.ensure_connection()
            return db[collection_name].find(query or {}).skip(skip).limit(limit)
        except Exception as e:
            logger.error(f"查询集合 {collection_name} 失败: {str(e)}")
            return []

    @classmethod
    def insert_document(cls, collection_name, document):
        """插入文档"""
        try:
            db = cls.ensure_connection()
            result = db[collection_name].insert_one(document)
            return result.inserted_id
        except Exception as e:
            logger.error(f"插入文档到集合 {collection_name} 失败: {str(e)}")
            raise

    @classmethod
    def update_document(cls, collection_name, document_id, update_data):
        """更新文档"""
        try:
            db = cls.ensure_connection()
            result = db[collection_name].update_one(
                {"_id": ObjectId(document_id)}, {"$set": update_data}
            )
            return result.modified_count
        except Exception as e:
            logger.error(f"更新集合 {collection_name} 中的文档失败: {str(e)}")
            raise

    @classmethod
    def delete_document(cls, collection_name, document_id):
        """删除文档"""
        try:
            db = cls.ensure_connection()
            result = db[collection_name].delete_one({"_id": ObjectId(document_id)})
            return result.deleted_count
        except Exception as e:
            logger.error(f"从集合 {collection_name} 删除文档失败: {str(e)}")
            raise

    @classmethod
    def truncate_collection(cls, collection_name):
        """清空集合"""
        try:
            db = cls.ensure_connection()
            result = db[collection_name].delete_many({})
            return result.deleted_count
        except Exception as e:
            logger.error(f"清空集合 {collection_name} 失败: {str(e)}")
            raise

    @classmethod
    def clear_database(cls):
        """清空数据库"""
        try:
            if cls.db is None:
                cls.init()
            cls.db.conversations.delete_many({})
            cls.db.messages.delete_many({})
            cls.db.users.delete_many({})
            logger.info("数据库已清空")
        except Exception as e:
            logger.error(f"清空数据库失败: {str(e)}")
            raise

    @classmethod
    def create_conversation(cls, user_id, title, system_prompt=None, model_id=None):
        """创建新会话"""
        try:
            if cls.db is None:
                cls.init()
            conversation = {
                "user_id": ObjectId(user_id),
                "title": title,
                "system_prompt": system_prompt,
                "model_id": model_id,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            result = cls.db.conversations.insert_one(conversation)
            # 返回完整的会话文档
            return cls.get_conversation(str(result.inserted_id))
        except Exception as e:
            logger.error(f"创建会话失败: {str(e)}")
            raise

    @classmethod
    def create_message(cls, conversation_id, role, content, model_name=None):
        """创建新消息"""
        try:
            if cls.db is None:
                cls.init()
            current_time = datetime.utcnow()
            message = {
                "conversation_id": ObjectId(conversation_id),
                "role": role,
                "content": content,
                "model_name": model_name,
                "created_at": current_time,
            }
            result = cls.db.messages.insert_one(message)

            # 更新会话的 last_message_at 字段
            cls.db.conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {"$set": {"last_message_at": current_time, "updated_at": current_time}},
            )

            # 返回完整的消息文档
            return cls.get_message(str(result.inserted_id))
        except Exception as e:
            logger.error(f"创建消息失败: {str(e)}")
            raise

    @classmethod
    def get_message(cls, message_id):
        """获取单个消息"""
        try:
            if cls.db is None:
                cls.init()
            message = cls.db.messages.find_one({"_id": ObjectId(message_id)})
            if message:
                message["_id"] = str(message["_id"])
                message["conversation_id"] = str(message["conversation_id"])
            return message
        except Exception as e:
            logger.error(f"获取消息失败: {str(e)}")
            raise

    @classmethod
    def get_conversation(cls, conversation_id):
        """获单个会话"""
        try:
            if cls.db is None:
                cls.init()
            conversation = cls.db.conversations.find_one(
                {"_id": ObjectId(conversation_id)}
            )
            if conversation:
                conversation["_id"] = str(conversation["_id"])
                conversation["user_id"] = str(conversation["user_id"])
            return conversation
        except Exception as e:
            logger.error(f"获取会话失败: {str(e)}")
            raise

    @classmethod
    def get_conversations(cls, user_id):
        """获取用户的所有会话"""
        try:
            if cls.db is None:
                cls.init()
            conversations = list(
                cls.db.conversations.find({"user_id": ObjectId(user_id)}).sort(
                    "created_at", -1
                )
            )

            # 转换ObjectId为字符串
            for conv in conversations:
                conv["_id"] = str(conv["_id"])
                conv["user_id"] = str(conv["user_id"])

            return conversations
        except Exception as e:
            logger.error(f"获取会话列表失败: {str(e)}")
            raise

    @classmethod
    def get_messages(cls, conversation_id):
        """获取会话的所有消息"""
        try:
            if cls.db is None:
                cls.init()
            messages = list(
                cls.db.messages.find(
                    {"conversation_id": ObjectId(conversation_id)}
                ).sort("created_at", 1)
            )

            # 转换ObjectId为字符串
            for msg in messages:
                msg["_id"] = str(msg["_id"])
                msg["conversation_id"] = str(msg["conversation_id"])

            return messages
        except Exception as e:
            logger.error(f"获取消息列表失败: {str(e)}")
            raise

    @classmethod
    def delete_conversation(cls, conversation_id):
        """删除会话及其消息"""
        try:
            if cls.db is None:
                cls.init()
            # 删除会话
            cls.db.conversations.delete_one({"_id": ObjectId(conversation_id)})
            # 删除相关消息
            cls.db.messages.delete_many({"conversation_id": ObjectId(conversation_id)})
        except Exception as e:
            logger.error(f"删除会话失败: {str(e)}")
            raise

    @staticmethod
    def hash_password(password):
        """对密码进行哈希处理"""
        return hashlib.sha256(password.encode()).hexdigest()

    @classmethod
    def get_user(cls, username, password):
        """获取用户信息"""
        try:
            if cls.db is None:
                cls.init()
            # 对密码进行哈希处理
            hashed_password = cls.hash_password(password)
            user = cls.db.users.find_one(
                {"username": username, "password": hashed_password}
            )
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"获取用户信息失败: {str(e)}")
            raise

    @classmethod
    def get_user_by_id(cls, user_id):
        """根据ID获取用户信息"""
        try:
            if cls.db is None:
                cls.init()
            if not ObjectId.is_valid(user_id):
                return None
            user = cls.db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"根据ID获取用户信息失败: {str(e)}")
            raise

    @classmethod
    def create_user(cls, username, password):
        """创建新用户"""
        try:
            if cls.db is None:
                cls.init()

            # 检查用户名是否已存在
            if cls.db.users.find_one({"username": username}):
                raise ValueError("用户名已存在")

            # 对密码进行哈希处理
            hashed_password = cls.hash_password(password)

            user = {
                "username": username,
                "password": hashed_password,
                "created_at": datetime.utcnow(),
            }
            result = cls.db.users.insert_one(user)
            return cls.get_user_by_id(str(result.inserted_id))
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}")
            raise

    @classmethod
    def update_conversation(cls, conversation_id, model_id=None, system_prompt=None):
        """更新会话设置"""
        try:
            if cls.db is None:
                cls.init()

            logger.info(
                f"更新会话 {conversation_id}: model_id={model_id}, system_prompt={system_prompt}"
            )

            update_data = {"updated_at": datetime.utcnow()}

            if model_id is not None:
                update_data["model_id"] = model_id
            if system_prompt is not None:
                update_data["system_prompt"] = system_prompt

            logger.info(f"更新数据: {update_data}")

            result = cls.db.conversations.update_one(
                {"_id": ObjectId(conversation_id)}, {"$set": update_data}
            )

            if result.modified_count == 0:
                logger.warning(f"会话 {conversation_id} 未被修改")
                # 即使未修改也返回会话信息
                return cls.get_conversation(conversation_id)

            # 返回更新后的会话
            updated_conversation = cls.get_conversation(conversation_id)
            logger.info(f"更新后的会话: {updated_conversation}")
            return updated_conversation

        except Exception as e:
            logger.error(f"更新会话失败: {str(e)}")
            raise
