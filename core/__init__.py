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

# 自动创建缺失的表（新增模型时生效）
with app.app_context():
    from core import models
    db.create_all()
