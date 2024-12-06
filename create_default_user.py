from utils.database import Database
from config.settings import SETTINGS

if __name__ == "__main__":
    try:
        Database.init()

        # 创建默认用户
        username = "admin"
        password = "admin123"

        # 检查用户是否已存在
        user = Database.get_user(username, password)
        if user:
            print(f"用户 {username} 已存在")
        else:
            user = Database.create_user(username, password)
            print(f"已创建默认用户: {username}")
            print(f"用户ID: {user['_id']}")

    except Exception as e:
        print(f"创建默认用户失败: {str(e)}")
    finally:
        Database.cleanup()
