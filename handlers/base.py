import tornado.web


class BaseHandler(tornado.web.RequestHandler):
    """基础处理器"""

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header(
            "Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE"
        )
