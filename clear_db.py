from utils.database import Database
from config.settings import SETTINGS

if __name__ == "__main__":
    try:
        Database.init()
        Database.clear_database()
        print("数据库已成功清空")
    except Exception as e:
        print(f"清空数据库失败: {str(e)}")
    finally:
        Database.cleanup()
