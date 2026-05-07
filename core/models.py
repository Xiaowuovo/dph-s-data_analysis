from core import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
import json


class Admin(db.Model, UserMixin):
    '''管理员账户表'''
    __tablename__ = 'admin'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class UserBehavior(db.Model):
    '''用户行为数据表 (适配 UserBehavior_2025.csv)'''
    __tablename__ = 'taobao_user_behavior'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)   # 用户ID
    item_id = db.Column(db.BigInteger, nullable=False, index=True)   # 商品ID

    # 新增字段（来自 UserBehavior_2025.csv）
    brand = db.Column(db.String(100))                                 # 品牌
    brand_id = db.Column(db.BigInteger)                               # 品牌ID
    product_name = db.Column(db.String(500))                          # 商品名称
    category_name = db.Column(db.String(100), index=True)             # 商品类别

    category_id = db.Column(db.BigInteger, nullable=False)            # 商品类目ID
    behavior_type = db.Column(db.String(10), nullable=False)          # 行为类型: pv,cart,fav,buy
    timestamp = db.Column(db.BigInteger, nullable=False)              # 时间戳 (Unix秒)
    price = db.Column(db.Float)                                       # 售价

    behavior_datetime = db.Column(db.DateTime, index=True)            # 解析后的日期时间
    date = db.Column(db.Date, index=True)                             # 日期
    hour = db.Column(db.Integer)                                      # 小时

    user_features = db.Column(db.Text)
    item_features = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<UserBehavior {self.user_id}-{self.behavior_type}>'


class UserProfile(db.Model):
    '''用户画像表'''
    __tablename__ = 'user_profile'

    user_id = db.Column(db.BigInteger, primary_key=True)
    total_actions = db.Column(db.Integer, default=0)  # 总行为数
    total_purchases = db.Column(db.Integer, default=0)  # 总购买数
    active_days = db.Column(db.Integer, default=0)  # 活跃天数
    first_action_time = db.Column(db.DateTime)  # 首次行为时间
    last_action_time = db.Column(db.DateTime)  # 最后行为时间
    preferred_categories = db.Column(db.Text)  # 偏好品类
    purchase_rate = db.Column(db.Float, default=0.0)  # 购买转化率
    avg_daily_actions = db.Column(db.Float, default=0.0)  # 日均行为数

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'total_actions': self.total_actions,
            'total_purchases': self.total_purchases,
            'active_days': self.active_days,
            'purchase_rate': self.purchase_rate,
            'avg_daily_actions': self.avg_daily_actions
        }


class ItemProfile(db.Model):
    '''商品画像表'''
    __tablename__ = 'item_profile'

    item_id = db.Column(db.BigInteger, primary_key=True)
    category_id = db.Column(db.BigInteger, index=True)  # 所属品类
    total_views = db.Column(db.Integer, default=0)  # 总浏览量
    total_purchases = db.Column(db.Integer, default=0)  # 总购买量
    conversion_rate = db.Column(db.Float, default=0.0)  # 转化率
    avg_daily_views = db.Column(db.Float, default=0.0)  # 日均浏览量

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'item_id': self.item_id,
            'category_id': self.category_id,
            'total_views': self.total_views,
            'total_purchases': self.total_purchases,
            'conversion_rate': self.conversion_rate
        }


class UploadHistory(db.Model):
    '''数据上传历史记录表（扩展：支持独立数据表 + 字段检测）'''
    __tablename__ = 'upload_history'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.String(50))
    record_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='success')  # success / error
    error_log = db.Column(db.Text)
    operator = db.Column(db.String(100))
    upload_time = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # ── 新增：数据隔离 + 字段检测 ──
    table_name = db.Column(db.String(100), index=True)  # 独立表名，如 upload_20260507_183045
    data_type = db.Column(db.String(20))  # order / user / behavior
    min_time = db.Column(db.DateTime)  # 数据最小时间
    max_time = db.Column(db.DateTime)  # 数据最大时间（作为"今日"基准）
    available_fields = db.Column(db.Text)  # JSON 字符串，记录可用字段列表
    is_active = db.Column(db.Boolean, default=True)  # 是否为当前激活数据源

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'filename': self.filename,
            'file_size': self.file_size,
            'record_count': self.record_count,
            'status': self.status,
            'error_log': self.error_log,
            'operator': self.operator,
            'upload_time': self.upload_time.strftime('%Y-%m-%d %H:%M:%S') if self.upload_time else '',
            'table_name': self.table_name,
            'data_type': self.data_type,
            'min_time': self.min_time.strftime('%Y-%m-%d') if self.min_time else None,
            'max_time': self.max_time.strftime('%Y-%m-%d') if self.max_time else None,
            'available_fields': json.loads(self.available_fields) if self.available_fields else [],
            'is_active': self.is_active,
        }


class Order(db.Model):
    '''订单数据表 (适配 order.csv — 38万订单数据)'''
    __tablename__ = 'orders'

    id            = db.Column(db.Integer, primary_key=True)
    order_id      = db.Column(db.BigInteger, unique=True, index=True, nullable=False)
    user_id       = db.Column(db.BigInteger, nullable=False, index=True)
    product_id    = db.Column(db.BigInteger, index=True)

    order_time    = db.Column(db.DateTime, nullable=False, index=True)
    order_date    = db.Column(db.Date, index=True)
    order_hour    = db.Column(db.Integer)

    quantity      = db.Column(db.Integer, default=1)
    amount        = db.Column(db.Float)               # 实付金额（含折扣）
    payment_method= db.Column(db.String(50))          # Alipay/WeChatPay/DebitCard...
    promotion_type= db.Column(db.String(50))          # None/Coupon/...
    order_status  = db.Column(db.String(50), index=True)  # Delivered/Shipped/...
    shipping_city = db.Column(db.String(100))
    fulfillment_time = db.Column(db.Integer)          # 履单时长(小时)

    # 用户信息（冗余存储，方便聚合分析）
    gender        = db.Column(db.String(10))
    age           = db.Column(db.Integer)
    user_province = db.Column(db.String(100), index=True)

    # 商品信息
    product_name  = db.Column(db.String(500))
    brand         = db.Column(db.String(100), index=True)
    category      = db.Column(db.String(100), index=True)
    price         = db.Column(db.Float)               # 原价
    is_hot        = db.Column(db.Boolean, default=False)
    launch_date   = db.Column(db.DateTime)
    product_province = db.Column(db.String(100))
    product_region_level = db.Column(db.String(50))

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Order {self.order_id}>'


class UserAccount(db.Model):
    '''用户账户表 (适配 user.csv — 9.8万用户数据)'''
    __tablename__ = 'user_accounts'

    user_id       = db.Column(db.BigInteger, primary_key=True)
    user_name     = db.Column(db.String(200))
    gender        = db.Column(db.String(10))
    age           = db.Column(db.Integer)

    register_time = db.Column(db.DateTime)
    register_channel = db.Column(db.String(100))     # App Store/Web/Android Market/WeChat

    user_region_id    = db.Column(db.Integer)
    user_province     = db.Column(db.String(100), index=True)
    user_region_level = db.Column(db.String(50))     # 一线/二线/三线...
    province_population = db.Column(db.BigInteger)
    province_gdp        = db.Column(db.BigInteger)

    total_purchase_times  = db.Column(db.Integer, default=0)
    total_purchase_amount = db.Column(db.Float, default=0.0)
    last_purchase_time    = db.Column(db.DateTime)
    click_count           = db.Column(db.Integer, default=0)
    cart_count            = db.Column(db.Integer, default=0)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<UserAccount {self.user_id}>'


class Recommendation(db.Model):
    '''推荐结果表'''
    __tablename__ = 'recommendation'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)  # 用户ID
    recommended_items = db.Column(db.Text, nullable=False)  # JSON格式的推荐商品列表
    algorithm_type = db.Column(db.String(50), nullable=False)  # 算法类型: cf/cb/hybrid
    context_info = db.Column(db.Text)  # 上下文信息(JSON)
    score = db.Column(db.Float, default=0.0)  # 推荐得分
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    clicked = db.Column(db.Boolean, default=False)
    purchased = db.Column(db.Boolean, default=False)
    model_type = db.Column(db.String(20), default='hybrid')


    def set_items(self, items_list):
        self.recommended_items = json.dumps(items_list)

    def get_items(self):
        return json.loads(self.recommended_items) if self.recommended_items else []
