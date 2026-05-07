# core/__init__.py
'''项目数据库配置模块'''
import os
import sys
import pymysql
from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy

'''数据库配置选项'''
pymysql.install_as_MySQLdb()  # 代替MySQLdb,使用pymysql

WIN = sys.platform.startswith('win')

if WIN:
    prefix = 'sqlite///'
else:
    prefix = 'sqlite////'

# 创建Flask应用
app = Flask(__name__,
            template_folder='templates',
            static_folder='static',
            static_url_path='/static')

# 配置
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'ecommerce-shopping-behavior-visualization')
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://graduation_project:Grad2026!@127.0.0.1:3306/grad_project_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['DEBUG'] = True

# 数据库和登录管理器
db = SQLAlchemy(app)
login_manager = LoginManager(app)

@login_manager.user_loader
def load_user(user_id):
    from core.models import Admin
    user = Admin.query.get(int(user_id))
    return user

login_manager.login_view = 'login'

# 导入视图（必须在创建app之后）
from core import views

# 自动创建缺失的表并迁移新字段
with app.app_context():
    from core import models
    db.create_all()
    # 自动补充 UserBehavior 新字段（不删除已有数据）
    try:
        from sqlalchemy import text, inspect as sa_inspect
        inspector = sa_inspect(db.engine)
        existing = {col['name'] for col in inspector.get_columns('taobao_user_behavior')}
        new_cols = {
            'brand':         'VARCHAR(100)',
            'brand_id':      'BIGINT',
            'product_name':  'VARCHAR(500)',
            'category_name': 'VARCHAR(100)',
            'price':         'DOUBLE',
        }
        with db.engine.connect() as conn:
            for col, dtype in new_cols.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE taobao_user_behavior ADD COLUMN {col} {dtype}'))
                    conn.commit()
    except Exception as _mig_err:
        print(f'[migration UserBehavior] {_mig_err}')

    # 迁移 orders 表新字段（如有）
    try:
        inspector = sa_inspect(db.engine)
        if 'orders' in inspector.get_table_names():
            order_cols = {col['name'] for col in inspector.get_columns('orders')}
            order_new = {
                'product_province': 'VARCHAR(100)',
                'product_region_level': 'VARCHAR(50)',
            }
            with db.engine.connect() as conn:
                for col, dtype in order_new.items():
                    if col not in order_cols:
                        conn.execute(text(f'ALTER TABLE orders ADD COLUMN {col} {dtype}'))
                        conn.commit()
    except Exception as _mig_err2:
        print(f'[migration orders] {_mig_err2}')

    # 迁移 upload_history 表新字段（数据隔离功能）
    try:
        inspector = sa_inspect(db.engine)
        if 'upload_history' in inspector.get_table_names():
            hist_cols = {col['name'] for col in inspector.get_columns('upload_history')}
            hist_new = {
                'table_name': 'VARCHAR(100)',
                'data_type': 'VARCHAR(20)',
                'min_time': 'DATETIME',
                'max_time': 'DATETIME',
                'available_fields': 'TEXT',
                'is_active': 'BOOLEAN DEFAULT 0',
            }
            with db.engine.connect() as conn:
                for col, dtype in hist_new.items():
                    if col not in hist_cols:
                        conn.execute(text(f'ALTER TABLE upload_history ADD COLUMN {col} {dtype}'))
                        conn.commit()
                        print(f'[migration] Added column {col} to upload_history')
                
                # 修复旧记录：将最新的成功上传记录设为激活
                if 'is_active' in hist_new:
                    # 先将所有记录设为非激活
                    conn.execute(text("UPDATE upload_history SET is_active = 0 WHERE status = 'success'"))
                    conn.commit()
                    
                    # 找到最新的成功记录并激活
                    result = conn.execute(text(
                        "SELECT id FROM upload_history WHERE status = 'success' AND table_name IS NOT NULL "
                        "ORDER BY upload_time DESC LIMIT 1"
                    ))
                    latest = result.fetchone()
                    if latest:
                        conn.execute(text(f"UPDATE upload_history SET is_active = 1 WHERE id = {latest[0]}"))
                        conn.commit()
                        print(f'[migration] Set upload_history id={latest[0]} as active')
    except Exception as _mig_err3:
        print(f'[migration upload_history] {_mig_err3}')
        import traceback
        traceback.print_exc()
