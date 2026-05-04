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
    '''用户行为数据表'''
    __tablename__ = 'taobao_user_behavior'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)  # 用户ID
    item_id = db.Column(db.BigInteger, nullable=False, index=True)  # 商品ID
    category_id = db.Column(db.BigInteger, nullable=False)  # 品类ID
    behavior_type = db.Column(db.String(10), nullable=False)  # 行为类型: pv,cart,fav,buy
    timestamp = db.Column(db.BigInteger, nullable=False)  # 时间戳

    # 修改这里：将 datetime 改名，避免与模块冲突
    behavior_datetime = db.Column(db.DateTime, index=True)  # 修改字段名

    date = db.Column(db.Date, index=True)  # 日期
    hour = db.Column(db.Integer)  # 小时

    # 添加JSON格式存储的复杂特征
    user_features = db.Column(db.Text)  # 用户特征
    item_features = db.Column(db.Text)  # 商品特征

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
    '''数据上传历史记录表'''
    __tablename__ = 'upload_history'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.String(50))
    record_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='success')  # success / error
    error_log = db.Column(db.Text)
    operator = db.Column(db.String(100))
    upload_time = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'file_size': self.file_size,
            'record_count': self.record_count,
            'status': self.status,
            'error_log': self.error_log,
            'operator': self.operator,
            'upload_time': self.upload_time.strftime('%Y-%m-%d %H:%M:%S') if self.upload_time else '',
        }


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
