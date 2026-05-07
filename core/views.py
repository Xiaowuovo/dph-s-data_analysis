# -*- coding: utf-8 -*-
"""web程序 flask路由文件"""
from core import app, db
from core.utility import Utility
from core.models import UserBehavior, UserProfile, ItemProfile, Recommendation, Admin, UploadHistory, Order, UserAccount
import core.data_engine as de
from flask_login import login_user, logout_user, login_required, current_user
from flask import render_template, request, url_for, redirect, flash, jsonify
import pandas as pd
import numpy as np
import random
import io
import os
import tempfile
import json
from datetime import datetime, timedelta
from sqlalchemy import func
from core.rfm_analysis import (
    calculate_rfm_analysis,
    generate_segment_insights,
    get_default_rfm_data,
    calculate_complete_rfm_analysis,
    prepare_rfm_matrix_data,
    prepare_segment_distribution,
    prepare_segment_trends,
    prepare_segment_comparison
)

from core.chart_generator import generate_chart_data_based_on_config



# 定义过滤器函数
def format_number(value, decimals=0):
    """格式化数字，添加千位分隔符"""
    if value is None:
        return "0"
    try:
        num = float(value)
        return f"{num:,.{decimals}f}".rstrip('0').rstrip('.')
    except (ValueError, TypeError):
        return str(value)

# 注册过滤器
app.jinja_env.filters['format_number'] = format_number


# 导入数据分析模块
try:
    from core.data_fenxi import DataPreprocessor, BehaviorAnalyzer
except ImportError:
    # 如果导入失败，创建空类避免错误
    class DataPreprocessor:
        def load_from_csv(self, file):
            return pd.DataFrame()

        def load_from_database(self, start_date=None, end_date=None):
            return pd.DataFrame()


    class BehaviorAnalyzer:
        def __init__(self, data):
            self.data = data

        def analyze用户行为(self, user_id):
            return {}

        def get_trend_analysis(self, start_date, end_date):
            return {}

        def analyze_conversion_funnel(self):
            return {}

        def analyze_rfm_segmentation(self):
            return {}

        def analyze_user_demographics(self):
            return {}

        def analyze_behavior_patterns(self):
            return {}

        def analyze_category_preference(self):
            return {}

        def analyze_hot_items(self):
            return []

# 导入推荐系统
try:
    from core.recommendation_system import RecommenderSystem
except ImportError:
    class RecommenderSystem:
        def __init__(self, data):
            self.data = data

        def collaborative_filtering_recommend(self, user_id, n_recommendations):
            return []

        def content_based_recommend(self, user_id, n_recommendations):
            return []

        def hybrid_recommend(self, user_id, n_recommendations):
            return []


# 导入可视化函数（处理可能的导入错误）
def create_fallback_chart():
    """创建备用图表函数"""
    return None


# 尝试导入可视化函数，如果失败则使用备用函数
try:
    from core.user_behavior_visualization import (
        create_user_profile_chart, create_purchase_behavior_chart,
        create_user_segment_chart, create_purchase_pattern_chart,
        create_gender_distribution_chart, create_age_distribution_chart,
        create_behavior_trend_chart, create_time_pattern_chart,
        create_category_preference_chart, create_conversion_funnel_chart,
        create_rfm_analysis_chart, create_hot_items_chart,
        create_key_metrics_chart, create_dashboard_trend_chart,
        create_dashboard_segment_chart
    )
except ImportError:
    # 如果导入失败，创建备用函数
    create_user_profile_chart = create_fallback_chart
    create_purchase_behavior_chart = create_fallback_chart
    create_user_segment_chart = create_fallback_chart
    create_purchase_pattern_chart = create_fallback_chart
    create_gender_distribution_chart = create_fallback_chart
    create_age_distribution_chart = create_fallback_chart
    create_behavior_trend_chart = create_fallback_chart
    create_time_pattern_chart = create_fallback_chart
    create_category_preference_chart = create_fallback_chart
    create_conversion_funnel_chart = create_fallback_chart
    create_rfm_analysis_chart = create_fallback_chart
    create_hot_items_chart = create_fallback_chart
    create_key_metrics_chart = create_fallback_chart
    create_dashboard_trend_chart = create_fallback_chart
    create_dashboard_segment_chart = create_fallback_chart


# ========== 登录界面视图函数 ==========
@app.route("/", methods=['GET', 'POST'])
@app.route("/login", methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if not username or not password:
            flash('用户名和密码不能为空', 'error')
            return redirect(url_for('login'))

        # 查询用户
        admin_user = Admin.query.filter_by(username=username).first()
        if admin_user and admin_user.check_password(password):
            login_user(admin_user)
            flash('登录成功', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('用户名或密码错误', 'error')
            return redirect(url_for('login'))

    return render_template('login.html')


# ========== 注册界面视图函数 ==========
@app.route("/register", methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('zusername')
        password = request.form.get('zpassword')

        # 更详细的用户名验证
        if not username or username.strip() == "":
            flash('用户名不能为空', 'error')
            return redirect(url_for('register'))

        username_cleaned = username.strip()

        # 检查长度
        if len(username_cleaned) < 3 or len(username_cleaned) > 20:
            flash('用户名必须是3-20个字符', 'error')
            return redirect(url_for('register'))

        # 检查字符有效性（只允许中文、英文、数字、下划线）
        import re
        if not re.match(r'^[a-zA-Z0-9_\u4e00-\u9fa5]+$', username_cleaned):
            flash('用户名只能包含中文、英文、数字和下划线', 'error')
            return redirect(url_for('register'))

        # 检查密码
        if not password or password.strip() == "":
            flash('密码不能为空', 'error')
            return redirect(url_for('register'))

        if len(password.strip()) < 6:
            flash('密码至少需要6个字符', 'error')
            return redirect(url_for('register'))

        # 检查用户名是否已存在
        existing_user = Admin.query.filter_by(username=username).first()
        if existing_user:
            flash('用户名已存在', 'error')
            return redirect(url_for('register'))

        # 创建新用户
        new_user = Admin(username=username)
        new_user.set_password(password)
        new_user.created_at = datetime.utcnow()

        try:
            db.session.add(new_user)
            db.session.commit()
            flash('注册成功，请登录', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            db.session.rollback()
            flash(f'注册失败: {str(e)}', 'error')
            return redirect(url_for('register'))

    return render_template('register.html')


# ========== 主页视图函数 ==========
@app.route('/base')
@login_required
def base():
    """重定向到数据看板"""
    return redirect(url_for('dashboard'))


# ========== 淘宝数据上传视图函数 ==========
@app.route('/taobao/upload', methods=['GET', 'POST'])
@login_required
def taobao_upload():
    """淘宝用户行为数据上传"""
    if request.method == 'POST':
        upload_file = request.files.get('taobao_file')
        filename = upload_file.filename if upload_file else ''
        file_size_str = ''
        records_saved = 0
        error_msg = None

        if not upload_file or filename == "":
            flash('请选择要上传的淘宝数据文件', 'error')
            return redirect(url_for('taobao_upload'))

        if not filename.lower().endswith('.csv'):
            flash('请上传CSV格式的淘宝数据文件', 'error')
            return redirect(url_for('taobao_upload'))

        try:
            raw = upload_file.read()
            file_size_bytes = len(raw)
            file_size_str = _fmt_size(file_size_bytes)
            upload_file.seek(0)

            # ── 自动识别 CSV 格式（用 BytesIO，避免游标污染）──
            df, enc = _read_csv_auto(raw)
            if df is None:
                error_msg = '无法解析 CSV，请确认文件编码为 UTF-8 或 GBK'
                flash(error_msg, 'error')
                _log_upload(filename, file_size_str, 0, 'error', error_msg)
                return redirect(url_for('taobao_upload'))

            csv_type = _detect_csv_type(set(df.columns))
            
            # ── 新模式：每次上传创建独立表 ──
            table_name, records_saved = _create_isolated_table(df, csv_type, filename, file_size_str)
            flash(f'数据导入成功：创建表 {table_name}，共 {records_saved} 条记录 · 类型：{csv_type}', 'success')

        except Exception as e:
            db.session.rollback()
            error_msg = str(e)
            _log_upload(filename, file_size_str, records_saved, 'error', error_msg)
            flash(f'数据导入失败: {error_msg}', 'error')

    try:
        recent = UploadHistory.query.order_by(UploadHistory.upload_time.desc()).limit(5).all()
        upload_history_list = [r.to_dict() for r in recent]
        total_records = UserBehavior.query.count()
        total_uploads = UploadHistory.query.count()
        storage_stats = {
            'uploaded_files': total_uploads,
            'total_records':  total_records,
            'used_storage':   _fmt_size(total_records * 512),
        }
    except Exception:
        upload_history_list = []
        storage_stats = {'uploaded_files': 0, 'total_records': 0, 'used_storage': '0 B'}
    return render_template('taobao_upload.html',
                           upload_history=upload_history_list,
                           storage_stats=storage_stats)


# CSV 列名映射：支持中文列名(UserBehavior_2025.csv) 和 旧英文列名两种格式
# ── UserBehavior_2025.csv 列映射 ──
_CSV_COL_MAP = {
    '用户ID':    'user_id',
    '商品ID':    'item_id',
    '品牌':      'brand',
    '品牌ID':    'brand_id',
    '商品名称':  'product_name',
    '商品类别':  'category_name',
    '商品类目ID':'category_id',
    '行为类型':  'behavior_type',
    '时间戳':    'timestamp',
    '售价':      'price',
}
_REQUIRED_INTERNAL = ['user_id', 'item_id', 'category_id', 'behavior_type', 'timestamp']
_VALID_BEHAVIORS   = {'pv', 'cart', 'fav', 'buy'}

# ── order.csv 必须包含的核心列 ──
_ORDER_REQUIRED = {'order_id', 'user_id', 'product_id', 'order_time', 'amount'}
# ── user.csv 必须包含的核心列 ──
_USER_REQUIRED  = {'user_id', 'register_time', 'total_purchase_times', 'click_count'}


def _detect_csv_type(df_columns: set) -> str:
    """根据列名自动判断 CSV 格式：返回 'order' / 'user' / 'behavior'"""
    cols = {c.lower().strip() for c in df_columns}
    if _ORDER_REQUIRED <= {c for c in df_columns}:
        return 'order'
    if _USER_REQUIRED <= {c for c in df_columns}:
        return 'user'
    return 'behavior'


def _read_csv_auto(raw_bytes: bytes):
    """用多种编码尝试解析 CSV 字节，返回 (df, encoding) 或 (None, None)。
    接受 bytes，内部每次用全新的 BytesIO，彻底避免游标污染导致的编码错误。
    """
    for enc in ['utf-8-sig', 'utf-8', 'gbk', 'gb18030']:
        try:
            df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc)
            if not df.empty:
                return df, enc
        except Exception:
            continue
    return None, None


def _create_isolated_table(df, data_type: str, filename: str, file_size_str: str):
    """为每次上传创建独立数据表，记录元数据到 UploadHistory"""
    import json
    from sqlalchemy import MetaData, Table, Column, Integer, BigInteger, String, Float, DateTime, Boolean, Text
    
    # 生成唯一表名
    table_name = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # 检测可用字段
    available_fields = list(df.columns)
    
    # 检测时间范围（根据数据类型选择时间列）
    time_col = None
    if data_type == 'order' and 'order_time' in df.columns:
        time_col = 'order_time'
    elif data_type == 'behavior' and 'timestamp' in df.columns:
        # 将 Unix 时间戳转为 datetime
        df['behavior_datetime'] = pd.to_datetime(df['timestamp'], unit='s', errors='coerce')
        time_col = 'behavior_datetime'
    elif 'register_time' in df.columns:
        time_col = 'register_time'
    
    min_time = max_time = None
    if time_col and time_col in df.columns:
        try:
            df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
            min_time = df[time_col].min()
            max_time = df[time_col].max()
            if pd.isna(min_time): min_time = None
            if pd.isna(max_time): max_time = None
        except:
            pass
    
    # 动态创建表结构（通用字段映射）
    metadata = MetaData()
    columns = [Column('id', Integer, primary_key=True)]
    
    for col in df.columns:
        col_lower = col.lower()
        if col == 'id': continue  # 跳过主键
        
        # 智能类型推断：先检查数据内容，再结合列名
        sample_val = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
        
        # 1. 数值型字段（优先级最高，避免被误判）
        if 'times' in col_lower or 'count' in col_lower or 'quantity' in col_lower or 'age' in col_lower or 'num' in col_lower:
            columns.append(Column(col, Integer))
        elif 'amount' in col_lower or 'price' in col_lower or 'revenue' in col_lower or 'rate' in col_lower:
            columns.append(Column(col, Float))
        # 2. ID 字段
        elif 'id' in col_lower or col_lower in ['user_id', 'order_id', 'product_id', 'item_id']:
            columns.append(Column(col, BigInteger))
        # 3. 时间字段（严格匹配 + 数据验证）
        elif col_lower.endswith('_time') or col_lower.endswith('_date') or col_lower in ['timestamp', 'datetime', 'order_time', 'register_time', 'behavior_datetime']:
            # 验证数据是否真的是时间格式（包含 - 或 :）
            if sample_val and isinstance(sample_val, str) and ('-' in sample_val or ':' in sample_val):
                columns.append(Column(col, DateTime))
            else:
                # 数据是数字，按字符串处理
                max_len = df[col].astype(str).str.len().max() if len(df) > 0 else 100
                columns.append(Column(col, String(min(max_len * 2, 200))))
        # 4. 布尔字段
        elif 'is_' in col_lower or col_lower in ['is_hot']:
            columns.append(Column(col, Boolean))
        # 5. 默认字符串
        else:
            max_len = df[col].astype(str).str.len().max() if len(df) > 0 else 100
            if max_len > 500:
                columns.append(Column(col, Text))
            else:
                columns.append(Column(col, String(min(max_len * 2, 500))))
    
    # 创建表
    table = Table(table_name, metadata, *columns)
    metadata.create_all(db.engine)
    
    # 写入数据
    df.to_sql(table_name, db.engine, if_exists='append', index=False, method='multi', chunksize=1000)
    
    # 记录到 UploadHistory
    history = UploadHistory(
        filename=filename,
        file_size=file_size_str,
        record_count=len(df),
        status='success',
        operator=current_user.username if current_user.is_authenticated else 'system',
        table_name=table_name,
        data_type=data_type,
        min_time=min_time,
        max_time=max_time,
        available_fields=json.dumps(available_fields, ensure_ascii=False),
        is_active=True,  # 新上传的数据默认激活
    )
    
    # 将其他数据源设为非激活
    UploadHistory.query.filter(UploadHistory.is_active == True).update({'is_active': False})
    
    db.session.add(history)
    db.session.commit()
    
    return table_name, len(df)


def _import_order_csv(df, filename, file_size_str):
    """将 order.csv 数据写入 orders 表，按 order_id 去重（已存在则跳过）"""
    saved, skipped = 0, 0
    existing_ids = {r[0] for r in db.session.query(Order.order_id).all()}

    for _, row in df.iterrows():
        try:
            oid = int(row['order_id'])
            if oid in existing_ids:
                skipped += 1
                continue

            # 解析下单时间
            ot = pd.to_datetime(row['order_time'], errors='coerce')
            if pd.isna(ot):
                skipped += 1
                continue
            ot = ot.to_pydatetime()

            # 解析上架时间
            ld = pd.to_datetime(row.get('launch_date'), errors='coerce')
            ld = ld.to_pydatetime() if not pd.isna(ld) else None

            order = Order(
                order_id     = oid,
                user_id      = int(row['user_id']),
                product_id   = int(row['product_id']) if str(row.get('product_id','')) != 'nan' else None,
                order_time   = ot,
                order_date   = ot.date(),
                order_hour   = ot.hour,
                quantity     = int(row['quantity']) if str(row.get('quantity','')) != 'nan' else 1,
                amount       = float(row['amount']) if str(row.get('amount','')) != 'nan' else None,
                payment_method  = str(row.get('payment_method', '') or '').strip() or None,
                promotion_type  = str(row.get('promotion_type', '') or '').strip() or None,
                order_status    = str(row.get('order_status', '') or '').strip() or None,
                shipping_city   = str(row.get('shipping_city', '') or '').strip() or None,
                fulfillment_time= int(row['fulfillment_time']) if str(row.get('fulfillment_time','')) not in ('nan','') else None,
                gender       = str(row.get('gender', '') or '').strip() or None,
                age          = int(row['age']) if str(row.get('age','')) not in ('nan','') else None,
                user_province= str(row.get('user_province_name', '') or '').strip() or None,
                product_name = str(row.get('product_name', '') or '').strip() or None,
                brand        = str(row.get('brand', '') or '').strip() or None,
                category     = str(row.get('category', '') or '').strip() or None,
                price        = float(row['price']) if str(row.get('price','')) not in ('nan','') else None,
                is_hot       = bool(int(row['is_hot'])) if str(row.get('is_hot','')) not in ('nan','') else False,
                launch_date  = ld,
                product_province     = str(row.get('product_province_name', '') or '').strip() or None,
                product_region_level = str(row.get('product_region_level', '') or '').strip() or None,
            )
            db.session.add(order)
            existing_ids.add(oid)
            saved += 1
            if saved % 1000 == 0:
                db.session.flush()
        except Exception:
            skipped += 1
            continue

    db.session.commit()
    return saved, skipped


def _import_user_csv(df, filename, file_size_str):
    """将 user.csv 数据写入 user_accounts 表，按 user_id 去重（已存在则覆盖）"""
    saved, skipped = 0, 0

    for _, row in df.iterrows():
        try:
            uid = int(row['user_id'])
            rt  = pd.to_datetime(row.get('register_time'), errors='coerce')
            rt  = rt.to_pydatetime() if not pd.isna(rt) else None
            lpt = pd.to_datetime(row.get('last_purchase_time'), errors='coerce')
            lpt = lpt.to_pydatetime() if not pd.isna(lpt) else None

            prov_raw = str(row.get('user_province_name', '') or '').strip()
            # 过滤乱码（非 ASCII 但合理中文由 gbk 编码保证）
            prov = prov_raw if prov_raw and len(prov_raw) <= 50 else None

            ua = UserAccount.query.get(uid)
            if ua is None:
                ua = UserAccount(user_id=uid)
                db.session.add(ua)

            ua.user_name    = str(row.get('user_name', '') or '').strip() or None
            ua.gender       = str(row.get('gender', '') or '').strip() or None
            ua.age          = int(row['age']) if str(row.get('age','')) not in ('nan','') else None
            ua.register_time= rt
            ua.register_channel = str(row.get('register_channel', '') or '').strip() or None
            ua.user_region_id   = int(row['user_region_id']) if str(row.get('user_region_id','')) not in ('nan','') else None
            ua.user_province    = prov
            ua.user_region_level= str(row.get('user_region_level', '') or '').strip() or None
            ua.province_population = int(row['user_province_population']) if str(row.get('user_province_population','')) not in ('nan','') else None
            ua.province_gdp        = int(row['user_province_gdp'])        if str(row.get('user_province_gdp',''))        not in ('nan','') else None
            ua.total_purchase_times  = int(row['total_purchase_times'])   if str(row.get('total_purchase_times',''))   not in ('nan','') else 0
            ua.total_purchase_amount = float(row['total_purchase_amount']) if str(row.get('total_purchase_amount','')) not in ('nan','') else 0.0
            ua.last_purchase_time    = lpt
            ua.click_count = int(row['click_count']) if str(row.get('click_count','')) not in ('nan','') else 0
            ua.cart_count  = int(row['cart_count'])  if str(row.get('cart_count',''))  not in ('nan','') else 0
            saved += 1
            if saved % 1000 == 0:
                db.session.flush()
        except Exception:
            skipped += 1
            continue

    db.session.commit()
    return saved, skipped


def _load_and_validate_csv(file_obj):
    """读取并校验 CSV，返回 (df, None) 或 (None, error_str)"""
    for enc in ['utf-8', 'utf-8-sig', 'gbk', 'gb18030']:
        try:
            file_obj.seek(0)
            df = pd.read_csv(file_obj, encoding=enc)
            # 重命名中文列
            df.rename(columns=_CSV_COL_MAP, inplace=True)
            missing = [c for c in _REQUIRED_INTERNAL if c not in df.columns]
            if missing:
                continue  # 试下一个编码
            invalid = df[~df['behavior_type'].isin(_VALID_BEHAVIORS)]['behavior_type'].unique().tolist()
            if invalid:
                return None, f'无效行为类型: {", ".join(map(str, invalid[:5]))}，有效值: pv/cart/fav/buy'
            return df, None
        except Exception:
            continue
    return None, '无法解析CSV文件，请确认格式与 UserBehavior_2025.csv 一致（UTF-8 或 GBK 编码）'


def _fmt_size(b):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if b < 1024:
            return f'{b:.1f} {unit}'
        b /= 1024
    return f'{b:.1f} GB'


def _data_date_range(days: int):
    """返回 (start_datetime, end_datetime)，以数据库中最新 behavior_datetime 为基准往前推 days 天。
    若库中无数据则回退到当前时间。用于所有直接过滤 behavior_datetime 列的路由。
    """
    max_dt = db.session.query(func.max(UserBehavior.behavior_datetime)).scalar()
    end_dt = max_dt if max_dt else datetime.now()
    return end_dt - timedelta(days=days), end_dt


def _log_upload(filename, file_size, record_count, status, error_log):
    try:
        operator = current_user.username if current_user.is_authenticated else 'unknown'
        h = UploadHistory(
            filename=filename,
            file_size=file_size,
            record_count=record_count,
            status=status,
            error_log=error_log,
            operator=operator,
        )
        db.session.add(h)
        db.session.commit()
    except Exception:
        db.session.rollback()


@app.route('/api/upload/preview', methods=['POST'])
@login_required
def api_upload_preview():
    """校验并预览上传的CSV（不写库）"""
    try:
        if 'taobao_file' not in request.files:
            return jsonify({'success': False, 'error': '未收到文件'})
        f = request.files['taobao_file']
        if not f.filename.lower().endswith('.csv'):
            return jsonify({'success': False, 'error': '仅支持CSV格式'})

        raw = f.read()
        file_size = _fmt_size(len(raw))

        df, enc = _read_csv_auto(raw)
        if df is None:
            return jsonify({'success': False, 'error': '无法解析CSV，请确认为UTF-8或GBK编码'})

        csv_type = _detect_csv_type(set(df.columns))
        preview_rows = df.head(10).fillna('').astype(str).to_dict('records')

        # 格式相关摘要
        extra = {}
        if csv_type == 'behavior':
            df.rename(columns=_CSV_COL_MAP, inplace=True)
            if 'behavior_type' in df.columns:
                extra['behavior_counts'] = df['behavior_type'].value_counts().to_dict()
        elif csv_type == 'order':
            if 'order_status' in df.columns:
                extra['status_counts'] = df['order_status'].value_counts().to_dict()
            if 'category' in df.columns:
                extra['category_counts'] = df['category'].value_counts().head(8).to_dict()
        elif csv_type == 'user':
            if 'gender' in df.columns:
                extra['gender_counts'] = df['gender'].value_counts().to_dict()
            if 'register_channel' in df.columns:
                extra['channel_counts'] = df['register_channel'].value_counts().head(6).to_dict()

        return jsonify({
            'success': True,
            'csv_type': csv_type,
            'encoding': enc,
            'total_records': len(df),
            'file_size': file_size,
            'columns': list(df.columns),
            'preview': preview_rows,
            **extra,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


def _get_active_datasource():
    """获取当前激活的数据源（UploadHistory 记录）"""
    return UploadHistory.query.filter_by(is_active=True, status='success').first()


@app.route('/api/datasource/switch/<int:upload_id>', methods=['POST'])
@login_required
def api_switch_datasource(upload_id):
    """切换当前激活的数据源"""
    try:
        # 取消所有激活状态
        UploadHistory.query.update({'is_active': False})
        # 激活指定数据源
        target = UploadHistory.query.get(upload_id)
        if not target:
            return jsonify({'success': False, 'error': '数据源不存在'})
        target.is_active = True
        db.session.commit()
        return jsonify({'success': True, 'table_name': target.table_name, 'data_type': target.data_type})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/datasource/current')
@login_required
def api_current_datasource():
    """返回当前激活数据源的元信息"""
    try:
        # 调试：检查所有上传记录
        all_uploads = UploadHistory.query.filter_by(status='success').all()
        print(f"[DEBUG] 所有成功上传记录数: {len(all_uploads)}")
        for u in all_uploads:
            print(f"  - {u.filename}: is_active={getattr(u, 'is_active', 'NO_FIELD')}, table_name={getattr(u, 'table_name', 'NO_FIELD')}")
        
        ds = _get_active_datasource()
        
        # 如果没有激活数据源，尝试自动激活最新的有效记录
        if not ds:
            latest = UploadHistory.query.filter_by(status='success').filter(
                UploadHistory.table_name.isnot(None)
            ).order_by(UploadHistory.upload_time.desc()).first()
            
            if latest:
                print(f"[AUTO-ACTIVATE] 自动激活最新上传: {latest.filename}")
                # 先将所有记录设为非激活
                UploadHistory.query.filter_by(is_active=True).update({'is_active': False})
                # 激活最新记录
                latest.is_active = True
                db.session.commit()
                ds = latest
            else:
                return jsonify({'active': False, 'message': '暂无激活数据源，请先上传数据'})
        
        result = {'active': True, **ds.to_dict()}
        print(f"[API] Returning datasource: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] api_current_datasource: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'active': False, 'error': str(e)})


@app.route('/api/datasource/check_fields')
@login_required
def api_check_fields():
    """检查当前数据源的字段可用性，返回各分析模块的启用状态"""
    from core.data_engine import check_field_availability
    
    # 定义各分析模块的必需字段
    modules = {
        'dashboard': ['user_id', 'item_id'],  # 基础看板
        'sales': ['amount', 'order_time'],  # 销售分析
        'behavior': ['behavior_type', 'timestamp'],  # 行为分析
        'rfm': ['user_id', 'amount', 'order_time'],  # RFM分析
        'user_profile': ['user_id', 'age', 'gender'],  # 用户画像
        'item_analysis': ['item_id', 'category_name', 'price'],  # 商品分析
    }
    
    result = {}
    for module, required in modules.items():
        availability = check_field_availability(required)
        result[module] = {
            'enabled': all(availability.values()),
            'missing_fields': [f for f, avail in availability.items() if not avail],
            'required_fields': required,
        }
    
    return jsonify(result)


@app.route('/api/upload/db_stats')
@login_required
def api_upload_db_stats():
    """返回各数据表当前记录数，供上传页面状态面板使用"""
    try:
        orders_cnt   = Order.query.count()
        users_cnt    = UserAccount.query.count()
        behavior_cnt = UserBehavior.query.count()
        uploads_cnt  = UploadHistory.query.count()
        return jsonify({
            'orders':    orders_cnt,
            'users':     users_cnt,
            'behaviors': behavior_cnt,
            'uploads':   uploads_cnt,
        })
    except Exception as ex:
        return jsonify({'error': str(ex), 'orders': 0, 'users': 0, 'behaviors': 0, 'uploads': 0})


@app.route('/upload_history')
@login_required
def upload_history():
    """上传历史记录页面"""
    try:
        records = UploadHistory.query.order_by(UploadHistory.upload_time.desc()).limit(100).all()
        history = [r.to_dict() for r in records]
    except Exception:
        history = []
    return render_template('upload_history.html', history=history)


# ========== 数据分析视图函数（已废弃，功能已整合到行为分析中心） ==========
@app.route('/analysis', methods=['GET', 'POST'])
@login_required
def analysis():
    """电商消费者购物行为数据分析中心 - 已废弃，重定向到行为分析中心"""
    return redirect(url_for('behavior_analysis_center'))

    # analysis_results = {}
    # charts_data = {}
    # error_message = None

    # try:
    #     # 从数据库加载数据
    #     processor = DataPreprocessor()
    #     data = processor.load_from_database()
    #     analyzer = BehaviorAnalyzer(data)

    #     if request.method == 'POST':
    #         analysis_type = request.form.get('analysis_type', 'overview')
    #         start_date = request.form.get('start_date')
    #         end_date = request.form.get('end_date')
    #         user_id = request.form.get('user_id')

    #         # 根据分析类型执行不同的分析
    #         if analysis_type == 'overview':
    #             analysis_results = get_overview_analysis(data, analyzer)
    #             charts_data = generate_overview_charts(analysis_results)

    #         elif analysis_type == 'funnel':
    #             analysis_results = get_conversion_funnel(analyzer)
    #             charts_data = generate_funnel_charts(analysis_results)

    #         elif analysis_type == 'rfm':
    #             analysis_results = get_rfm_analysis(analyzer)
    #             charts_data = generate_rfm_charts(analysis_results)

    #         elif analysis_type == 'time_pattern':
    #             analysis_results = get_time_pattern_analysis(analyzer)
    #             charts_data = generate_time_pattern_charts(analysis_results)

    #         elif analysis_type == 'user_behavior':
    #             if user_id:
    #                 analysis_results = get_user_behavior_analysis(analyzer, int(user_id))
    #                 charts_data = generate_user_behavior_charts(analysis_results)

    #         elif analysis_type == 'category':
    #             analysis_results = get_category_analysis(analyzer)
    #             charts_data = generate_category_charts(analysis_results)

    #     else:
    #         # GET请求，显示默认概览
    #         analysis_results = get_overview_analysis(data, analyzer)
    #         charts_data = generate_overview_charts(analysis_results)

    # except Exception as e:
    #     error_message = f"数据分析错误: {str(e)}"
    #     flash(error_message, 'error')

    # return render_template('analysis.html',  #
    #                        analysis_results=analysis_results,
    #                        charts_data=charts_data,
    #                        error_message=error_message)


# ========== 分析辅助函数 ==========
def get_overview_analysis(data, analyzer):
    """获取概览分析数据"""
    return {
        'total_users': 77968,
        'total_items': 1388335,
        'total_categories': 7778,
        'total_records': 10126233,
        'analysis_period': '2017-11-25 至 2017-12-03',
        'behavior_counts': {
            'pv': 7133888,  # 浏览
            'cart': 565839,  # 加购
            'fav': 295610,  # 收藏
            'buy': 158926  # 购买
        },
        'conversion_rate': 2.23,
        'active_users': 15892
    }


def get_conversion_funnel(analyzer):
    """获取转化漏斗数据"""
    return {
        'funnel_stages': [
            {'stage': '浏览(PV)', 'count': 7133888, 'conversion_rate': 100.0},
            {'stage': '加购/收藏', 'count': 677445, 'conversion_rate': 9.5},
            {'stage': '购买', 'count': 158926, 'conversion_rate': 23.5}
        ],
        'overall_conversion': 2.23,
        'key_insights': [
            '从浏览到购买的总体转化率为2.23%',
            '加购到购买环节转化率最高达23.5%',
            '周末(12月2-3日)访问量和成交量大幅上升'
        ]
    }


def get_rfm_analysis(analyzer):
    """获取RFM分析数据"""
    return {
        'user_segments': {
            'value_customers': 52780,  # 价值客户 33.2%
            'development_customers': 39945,  # 发展客户 25.1%
            'keep_customers': 39363,  # 保持客户 24.8%
            'retention_customers': 26838  # 挽留客户 16.9%
        },
        'segment_percentages': {
            'value': 33.2,
            'development': 25.1,
            'keep': 24.8,
            'retention': 16.9
        }
    }


def get_time_pattern_analysis(analyzer):
    """获取时间模式分析"""
    return {
        'daily_patterns': {
            'morning_peak': {'time': '08:00-10:00', 'activity_increase': 35},
            'noon_peak': {'time': '12:00-14:00', 'activity_increase': 28},
            'evening_peak': {'time': '20:00-22:00', 'activity_increase': 62},
            'night_low': {'time': '02:00-04:00', 'activity_decrease': 85}
        }
    }


def get_user_behavior_analysis(analyzer, user_id):
    """获取特定用户行为分析"""
    return {
        'user_id': user_id,
        'behavior_summary': {
            'total_actions': 0,
            'pv_count': 0,
            'cart_count': 0,
            'fav_count': 0,
            'buy_count': 0
        },
        'conversion_rate': 0.0
    }


def get_category_analysis(analyzer):
    """获取品类分析"""
    return {
        'top_categories': [
            {'category_id': 4756105, 'view_count': 421360},
            {'category_id': 4145813, 'view_count': 286971},
            {'category_id': 2355072, 'view_count': 271379}
        ]
    }


def generate_overview_charts(analysis_results):
    """生成概览图表数据"""
    return {
        'behavior_distribution': {
            'type': 'pie',
            'title': '用户行为分布',
            'data': [
                {'name': '浏览(PV)', 'value': analysis_results['behavior_counts']['pv']},
                {'name': '加购', 'value': analysis_results['behavior_counts']['cart']},
                {'name': '收藏', 'value': analysis_results['behavior_counts']['fav']},
                {'name': '购买', 'value': analysis_results['behavior_counts']['buy']}
            ]
        }
    }


def generate_funnel_charts(analysis_results):
    """生成转化漏斗图表"""
    return {
        'conversion_funnel': {
            'type': 'funnel',
            'title': '用户转化漏斗',
            'data': analysis_results['funnel_stages']
        }
    }


def generate_rfm_charts(analysis_results):
    """生成RFM分析图表"""
    return {
        'rfm_distribution': {
            'type': 'pie',
            'title': 'RFM用户分群',
            'data': [
                {'name': '价值客户', 'value': analysis_results['user_segments']['value_customers']},
                {'name': '发展客户', 'value': analysis_results['user_segments']['development_customers']},
                {'name': '保持客户', 'value': analysis_results['user_segments']['keep_customers']},
                {'name': '挽留客户', 'value': analysis_results['user_segments']['retention_customers']}
            ]
        }
    }


def generate_time_pattern_charts(analysis_results):
    """生成时间模式图表"""
    return {
        'time_patterns': {
            'type': 'line',
            'title': '24小时用户活跃模式',
            'data': analysis_results['daily_patterns']
        }
    }


def generate_user_behavior_charts(analysis_results):
    """生成用户行为图表"""
    return {}


def generate_category_charts(analysis_results):
    """生成品类分析图表"""
    return {}


# ========== 智能推荐系统视图函数 ==========
@app.route('/intelligent_recommendation')
@login_required
def intelligent_recommendation():
    """智能推荐系统 - 基于真实数据的运营建议"""
    days = int(request.args.get('days', 30))
    try:
        rec_data = de.get_recommendation_insights(days)
    except Exception as e:
        print(f"推荐数据错误: {e}")
        rec_data = {'stats': {}, 'suggestions': [], 'top_items': [],
                    'top_brands': [], 'top_categories': [], 'synced_at': ''}
    return render_template('intelligent_recommendation.html', rec_data=rec_data, days=days)


# ========== 推荐系统视图函数（保留旧路由兼容）==========
@app.route('/recommendation', methods=['GET', 'POST'])
@login_required
def recommendation():
    """个性化推荐系统 - 重定向到智能推荐"""
    return redirect(url_for('intelligent_recommendation'))
    
    # """个性化推荐系统"""
    # recommendations = None
    # user_profile = None

    # if request.method == 'POST':
    #     user_id = request.form.get('user_id')
    #     algorithm_type = request.form.get('algorithm_type', 'hybrid')
    #     n_recommendations = int(request.form.get('n_recommendations', 10))

    #     if user_id:
    #         try:
    #             # 加载数据
    #             processor = DataPreprocessor()
    #             data = processor.load_from_database()

    #             # 初始化推荐系统
    #             recommender = RecommenderSystem(data)

    #             # 获取推荐
    #             if algorithm_type == 'collaborative':
    #                 recommendations = recommender.collaborative_filtering_recommend(int(user_id), n_recommendations)
    #             elif algorithm_type == 'content_based':
    #                 recommendations = recommender.content_based_recommend(int(user_id), n_recommendations)
    #             else:  # hybrid
    #                 recommendations = recommender.hybrid_recommend(int(user_id), n_recommendations)

    #             # 获取用户画像
    #             analyzer = BehaviorAnalyzer(data)
    #             user_profile = analyzer.analyze_user_behavior(int(user_id))

    #             # 保存推荐结果
    #             rec_entry = Recommendation(
    #                 user_id=int(user_id),
    #                 algorithm_type=algorithm_type,
    #                 score=0.8
    #             )
    #             rec_entry.set_items(recommendations)
    #             db.session.add(rec_entry)
    #             db.session.commit()

    #         except Exception as e:
    #             flash(f'推荐生成错误: {str(e)}', 'error')

    # return render_template('recommendation.html',
    #                        recommendations=recommendations,
    #                        user_profile=user_profile)


# ========== 数据查询视图函数 ==========
@app.route('/query', methods=['GET', 'POST'])
@login_required
def query():
    """数据查询页面"""
    if request.method == 'POST':
        upload_file = request.files.get('query-input-uploaded_file')
        action = request.form.get('action')

        if not upload_file or upload_file.filename == "":
            flash('请选择要上传的文件', 'error')
            return redirect(url_for('query'))

        if not action:
            flash('请选择操作类型', 'error')
            return redirect(url_for('query'))

        try:
            # 保存临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
                upload_file.save(tmp_file.name)
                tmp_file_path = tmp_file.name

            try:
                # 读取CSV文件
                data = pd.read_csv(tmp_file_path)

                # 基本验证
                if data.empty:
                    flash('文件内容为空', 'error')
                    return redirect(url_for('query'))

                if action == 'display':
                    # 显示预览
                    preview_data = data.head(100)
                    return render_template('query.html',
                                           preview_data=preview_data.to_html(classes='table'),
                                           data_size=len(data))

                elif action == 'save':
                    # 保存到数据库
                    records_saved = 0
                    for _, row in data.iterrows():
                        # 这里根据实际数据结构调整
                        record = UserBehavior(
                            user_id=row.get('user_id', 0),
                            item_id=row.get('item_id', 0),
                            category_id=row.get('category_id', 0),
                            behavior_type=row.get('behavior_type', 'pv'),
                            timestamp=row.get('timestamp', 0)
                        )
                        db.session.add(record)
                        records_saved += 1

                    db.session.commit()
                    flash(f'成功保存 {records_saved} 条记录', 'success')

            finally:
                # 清理临时文件
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)

        except Exception as e:
            flash(f'文件处理错误: {str(e)}', 'error')

    return render_template('query.html')


# ========== 数据可视化视图函数 ==========
@app.route('/visualization')
@login_required
def visualization():
    """数据可视化页面 - 专注于基础数据可视化，与前端JavaScript模块完整集成"""
    try:
        # 获取最近30天的数据（以数据库最新记录为基准）
        start_date, end_date = _data_date_range(30)

        # 获取基础数据
        behaviors = UserBehavior.query.filter(
            UserBehavior.behavior_datetime.between(start_date, end_date)
        ).all()

        user_profiles = UserProfile.query.all()
        item_profiles = ItemProfile.query.all()

        # 计算基础统计数据
        stats = {
            'active_users': len(set([b.user_id for b in behaviors])),
            'total_views': len([b for b in behaviors if b.behavior_type == 'pv']),
            'total_purchases': len([b for b in behaviors if b.behavior_type == 'buy']),
            'conversion_rate': calculate_conversion_rate(behaviors),
            'user_growth': calculate_user_growth(behaviors, start_date, end_date),
            'view_growth': calculate_view_growth(behaviors, start_date, end_date),
            'purchase_growth': calculate_purchase_growth(behaviors, start_date, end_date),
            'conversion_change': calculate_conversion_change(behaviors, start_date, end_date)
        }

        # 计算高级insights分析（删除RFM相关功能）
        insights = calculate_basic_insights(behaviors, user_profiles, item_profiles, start_date, end_date)

        # 准备API接口所需的数据结构
        api_data = {
            'metrics': get_available_metrics(),
            'dimensions': get_available_dimensions(),
            'filters': get_available_filters(),
            'chart_configs': get_chart_configurations(),
            'initial_data': get_initial_chart_data(behaviors, start_date, end_date)
        }

        return render_template('visualization.html',
                               stats=stats,
                               insights=insights,
                               api_data=api_data,
                               analysis_period=f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")

    except Exception as e:
        print(f"可视化页面错误: {str(e)}")
        # 返回默认数据避免页面崩溃
        return render_template('visualization.html',
                               stats=get_default_stats(),
                               insights=get_default_insights(),
                               api_data=get_default_api_data())


def calculate_basic_insights(behaviors, user_profiles, item_profiles, start_date, end_date):
    """计算基础数据洞察（不包含RFM分析）"""
    if not behaviors:
        return get_default_insights()

    # 用户行为分析
    user_analysis = analyze_user_behavior(behaviors, user_profiles)

    # 时间模式分析
    time_patterns = analyze_time_patterns(behaviors, start_date, end_date)

    # 品类分析
    category_analysis = analyze_category_performance(behaviors, item_profiles)

    # 转化漏斗分析
    funnel_analysis = analyze_conversion_funnel(behaviors)

    return {
        'growth_rate': calculate_overall_growth_rate(behaviors, start_date, end_date),
        'at_risk_users': identify_at_risk_users(behaviors, user_profiles, end_date),
        'cart_to_buy': funnel_analysis.get('cart_to_buy', 0),
        'peak_hours': time_patterns.get('peak_hours', '20:00-22:00'),
        'peak_percent': time_patterns.get('peak_percent', 35),
        'recommendations': generate_business_recommendations(
            user_analysis, time_patterns, category_analysis, funnel_analysis
        )
    }


def calculate_conversion_rate(behaviors):
    """计算转化率"""
    views = len([b for b in behaviors if b.behavior_type == 'pv'])
    purchases = len([b for b in behaviors if b.behavior_type == 'buy'])
    return round((purchases / views * 100), 2) if views > 0 else 0


def calculate_user_growth(behaviors, start_date, end_date):
    """计算用户增长率"""
    # 将时间分为前后两个阶段进行比较
    mid_date = start_date + (end_date - start_date) / 2

    first_half_users = len(set([
        b.user_id for b in behaviors
        if b.timestamp and b.timestamp <= mid_date
    ]))

    second_half_users = len(set([
        b.user_id for b in behaviors
        if b.timestamp and b.timestamp > mid_date
    ]))

    return calculate_growth_percentage(first_half_users, second_half_users)


def calculate_view_growth(behaviors, start_date, end_date):
    """计算浏览量增长率"""
    mid_date = start_date + (end_date - start_date) / 2

    first_half_views = len([
        b for b in behaviors
        if b.behavior_type == 'pv' and b.timestamp and b.timestamp <= mid_date
    ])

    second_half_views = len([
        b for b in behaviors
        if b.behavior_type == 'pv' and b.timestamp and b.timestamp > mid_date
    ])

    return calculate_growth_percentage(first_half_views, second_half_views)


def calculate_purchase_growth(behaviors, start_date, end_date):
    """计算购买量增长率"""
    mid_date = start_date + (end_date - start_date) / 2

    first_half_purchases = len([
        b for b in behaviors
        if b.behavior_type == 'buy' and b.timestamp and b.timestamp <= mid_date
    ])

    second_half_purchases = len([
        b for b in behaviors
        if b.behavior_type == 'buy' and b.timestamp and b.timestamp > mid_date
    ])

    return calculate_growth_percentage(first_half_purchases, second_half_purchases)


def calculate_conversion_change(behaviors, start_date, end_date):
    """计算转化率变化"""
    mid_date = start_date + (end_date - start_date) / 2

    # 前半段转化率
    first_views = len([b for b in behaviors if b.behavior_type == 'pv' and b.timestamp and b.timestamp <= mid_date])
    first_purchases = len(
        [b for b in behaviors if b.behavior_type == 'buy' and b.timestamp and b.timestamp <= mid_date])
    first_conversion = (first_purchases / first_views * 100) if first_views > 0 else 0

    # 后半段转化率
    second_views = len([b for b in behaviors if b.behavior_type == 'pv' and b.timestamp and b.timestamp > mid_date])
    second_purchases = len(
        [b for b in behaviors if b.behavior_type == 'buy' and b.timestamp and b.timestamp > mid_date])
    second_conversion = (second_purchases / second_views * 100) if second_views > 0 else 0

    return round(second_conversion - first_conversion, 2)


def calculate_growth_percentage(previous, current):
    """计算增长率百分比"""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous * 100), 1)


def calculate_overall_growth_rate(behaviors, start_date, end_date):
    """计算整体增长率"""
    if not behaviors:
        return 0

    # 将时间段分为两半
    mid_date = start_date + (end_date - start_date) / 2

    # 计算前半段和后半段的行为数
    first_half = len([b for b in behaviors if b.timestamp and b.timestamp <= mid_date])
    second_half = len([b for b in behaviors if b.timestamp and b.timestamp > mid_date])

    if first_half == 0:
        return 100.0 if second_half > 0 else 0.0

    growth_rate = (second_half - first_half) / first_half * 100
    return round(growth_rate, 1)


def identify_at_risk_users(behaviors, user_profiles, end_date):
    """识别有流失风险的用户"""
    if not behaviors:
        return 0

    # 记录每个用户的最后活动时间
    user_last_activity = {}
    for behavior in behaviors:
        if behavior.timestamp:
            user_id = behavior.user_id
            if user_id not in user_last_activity or behavior.timestamp > user_last_activity[user_id]:
                user_last_activity[user_id] = behavior.timestamp

    # 判断流失风险（超过7天无活动）
    at_risk_threshold = timedelta(days=7)
    at_risk_count = 0

    for user_id, last_activity in user_last_activity.items():
        if (end_date - last_activity) > at_risk_threshold:
            at_risk_count += 1

    return at_risk_count


def analyze_user_behavior(behaviors, user_profiles):
    """分析用户行为模式"""
    if not behaviors:
        return {}

    # 按用户ID分组行为
    user_behaviors = {}
    for behavior in behaviors:
        user_id = behavior.user_id
        if user_id not in user_behaviors:
            user_behaviors[user_id] = []
        user_behaviors[user_id].append(behavior)

    # 分析用户活跃度
    active_users = len(user_behaviors)
    total_sessions = len(behaviors)

    # 计算平均行为次数
    avg_behaviors = total_sessions / active_users if active_users > 0 else 0

    # 分析行为类型分布
    behavior_counts = {}
    for behavior in behaviors:
        btype = behavior.behavior_type
        behavior_counts[btype] = behavior_counts.get(btype, 0) + 1

    return {
        'active_users': active_users,
        'total_sessions': total_sessions,
        'avg_behaviors_per_user': round(avg_behaviors, 2),
        'behavior_distribution': behavior_counts,
        'user_segments': segment_users_by_behavior(user_behaviors)
    }


def analyze_time_patterns(behaviors, start_date, end_date):
    """分析时间模式"""
    if not behaviors:
        return {'peak_hours': '暂无数据', 'peak_percent': 0}

    # 按小时分析
    hourly_counts = {hour: 0 for hour in range(24)}
    for behavior in behaviors:
        if behavior.timestamp:
            hour = behavior.timestamp.hour
            hourly_counts[hour] += 1

    # 找到高峰时段
    peak_hour = max(hourly_counts, key=hourly_counts.get)
    total_behaviors = sum(hourly_counts.values())
    peak_percent = round((hourly_counts[peak_hour] / total_behaviors * 100), 1) if total_behaviors > 0 else 0

    # 按星期分析
    weekday_counts = {i: 0 for i in range(7)}
    for behavior in behaviors:
        if behavior.timestamp:
            weekday = behavior.timestamp.weekday()
            weekday_counts[weekday] += 1

    peak_weekday = max(weekday_counts, key=weekday_counts.get)
    weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

    return {
        'peak_hours': f"{peak_hour}:00-{(peak_hour + 1) % 24}:00",
        'peak_percent': peak_percent,
        'peak_weekday': weekdays[peak_weekday],
        'hourly_distribution': hourly_counts,
        'weekday_distribution': weekday_counts
    }


def analyze_category_performance(behaviors, item_profiles):
    """分析品类表现"""
    if not behaviors or not item_profiles:
        return {'hot_categories': [], 'performance': {}}

    # 创建商品ID到品类的映射
    category_map = {item.item_id: item.category_id for item in item_profiles}

    # 统计品类行为
    category_stats = {}
    for behavior in behaviors:
        category_id = category_map.get(behavior.item_id)
        if category_id:
            if category_id not in category_stats:
                category_stats[category_id] = {'views': 0, 'carts': 0, 'favs': 0, 'buys': 0}

            btype = behavior.behavior_type
            if btype == 'pv':
                category_stats[category_id]['views'] += 1
            elif btype == 'cart':
                category_stats[category_id]['carts'] += 1
            elif btype == 'fav':
                category_stats[category_id]['favs'] += 1
            elif btype == 'buy':
                category_stats[category_id]['buys'] += 1

    # 计算转化率
    for cat_id, stats in category_stats.items():
        total_views = stats['views']
        stats['conversion_rate'] = round((stats['buys'] / total_views * 100), 2) if total_views > 0 else 0

    # 按购买量排序
    sorted_categories = sorted(category_stats.items(),
                               key=lambda x: x[1]['buys'],
                               reverse=True)

    hot_categories = [cat_id for cat_id, _ in sorted_categories[:5]]

    return {
        'hot_categories': hot_categories,
        'performance': category_stats
    }


def analyze_conversion_funnel(behaviors):
    """分析转化漏斗"""
    if not behaviors:
        return {'view_to_cart': 0, 'cart_to_buy': 0, 'overall': 0}

    # 统计各阶段数量
    funnel_counts = {'pv': 0, 'cart': 0, 'fav': 0, 'buy': 0}
    for behavior in behaviors:
        btype = behavior.behavior_type
        if btype in funnel_counts:
            funnel_counts[btype] += 1

    # 计算转化率
    pv = funnel_counts['pv']
    cart = funnel_counts['cart']
    buy = funnel_counts['buy']

    view_to_cart = round((cart / pv * 100), 2) if pv > 0 else 0
    cart_to_buy = round((buy / cart * 100), 2) if cart > 0 else 0
    overall = round((buy / pv * 100), 2) if pv > 0 else 0

    return {
        'view_to_cart': view_to_cart,
        'cart_to_buy': cart_to_buy,
        'overall': overall,
        'counts': funnel_counts
    }


def generate_business_recommendations(user_analysis, time_patterns, category_analysis, funnel_analysis):
    """生成业务建议"""
    recommendations = []

    # 基于转化漏斗的建议
    cart_to_buy = funnel_analysis.get('cart_to_buy', 0)
    if cart_to_buy < 20:
        recommendations.append({
            'type': 'conversion_optimization',
            'priority': 'high',
            'title': '优化加购转化',
            'description': f'加购到购买转化率仅{cart_to_buy}%，建议优化购物车体验',
            'action': '实施购物车提醒、优惠券推送策略'
        })

    # 基于时间模式的建议
    peak_percent = time_patterns.get('peak_percent', 0)
    if peak_percent > 30:
        peak_hours = time_patterns.get('peak_hours', '')
        recommendations.append({
            'type': 'timing_optimization',
            'priority': 'medium',
            'title': '高峰时段优化',
            'description': f'用户活跃高峰集中在{peak_hours}，占全天{peak_percent}%',
            'action': '在高峰时段加大营销投入和客服支持'
        })

    # 基于品类表现的建议
    performance = category_analysis.get('performance', {})
    if performance:
        sorted_cats = sorted(performance.items(),
                             key=lambda x: x[1].get('conversion_rate', 0))
        low_conversion_cats = sorted_cats[:3]

        if low_conversion_cats:
            cat_ids = ', '.join([str(cat_id) for cat_id, _ in low_conversion_cats])
            recommendations.append({
                'type': 'category_optimization',
                'priority': 'medium',
                'title': '优化低转化品类',
                'description': f'品类 {cat_ids} 转化率较低，需重点优化',
                'action': '调整商品定价、优化商品详情页'
            })

    return recommendations


def segment_users_by_behavior(user_behaviors):
    """基于行为对用户进行分群"""
    segments = {'high_activity': 0, 'medium_activity': 0, 'low_activity': 0}

    for user_id, behaviors in user_behaviors.items():
        behavior_count = len(behaviors)
        if behavior_count > 50:
            segments['high_activity'] += 1
        elif behavior_count > 10:
            segments['medium_activity'] += 1
        else:
            segments['low_activity'] += 1

    return segments


def get_available_metrics():
    """获取可用的指标列表"""
    return [
        {'id': 'active_users', 'name': '活跃用户数', 'type': 'count'},
        {'id': 'total_views', 'name': '总浏览量', 'type': 'count'},
        {'id': 'total_purchases', 'name': '总购买量', 'type': 'count'},
        {'id': 'conversion_rate', 'name': '转化率', 'type': 'percentage'},
        {'id': 'avg_session_duration', 'name': '平均会话时长', 'type': 'duration'},
        {'id': 'bounce_rate', 'name': '跳出率', 'type': 'percentage'}
    ]


def get_available_dimensions():
    """获取可用的维度列表"""
    return [
        {'id': 'time', 'name': '时间', 'type': 'datetime'},
        {'id': 'user_segment', 'name': '用户分群', 'type': 'category'},
        {'id': 'product_category', 'name': '商品品类', 'type': 'category'},
        {'id': 'behavior_type', 'name': '行为类型', 'type': 'category'},
        {'id': 'device_type', 'name': '设备类型', 'type': 'category'}
    ]


def get_available_filters():
    """获取可用的筛选条件"""
    return [
        {'id': 'time_range', 'name': '时间范围', 'type': 'datetime_range'},
        {'id': 'user_segment', 'name': '用户分群', 'type': 'multi_select'},
        {'id': 'min_views', 'name': '最小浏览量', 'type': 'number'},
        {'id': 'has_purchase', 'name': '是否有购买', 'type': 'boolean'}
    ]


def get_chart_configurations():
    """获取图表配置"""
    return {
        'trend_chart': {
            'type': 'line',
            'endpoint': '/api/visualization/trend',
            'title': '用户行为趋势分析',
            'description': '展示用户行为随时间的变化趋势'
        },
        'distribution_chart': {
            'type': 'bar',
            'endpoint': '/api/visualization/distribution',
            'title': '用户行为分布',
            'description': '展示不同行为类型的分布情况'
        },
        'comparison_chart': {
            'type': 'pie',
            'endpoint': '/api/visualization/comparison',
            'title': '用户群体对比',
            'description': '对比不同用户群体的行为差异'
        },
        'correlation_chart': {
            'type': 'scatter',
            'endpoint': '/api/visualization/correlation',
            'title': '行为关联分析',
            'description': '分析不同行为之间的关联关系'
        }
    }


def get_initial_chart_data(behaviors, start_date, end_date):
    """获取初始图表数据"""
    return {
        'trend_data': prepare_trend_data(behaviors, start_date, end_date),
        'distribution_data': prepare_distribution_data(behaviors),
        'comparison_data': prepare_comparison_data(behaviors),
        'correlation_data': prepare_correlation_data(behaviors)
    }


def prepare_trend_data(behaviors, start_date, end_date):
    """准备趋势数据"""
    if not behaviors:
        return {'labels': [], 'datasets': []}

    # 按日期分组
    daily_counts = {}
    current_date = start_date.date()
    end_date_d = end_date.date()

    while current_date <= end_date_d:
        daily_counts[current_date.strftime('%m-%d')] = 0
        current_date += timedelta(days=1)

    # 统计每日行为
    for behavior in behaviors:
        if behavior.timestamp:
            date_key = behavior.timestamp.date().strftime('%m-%d')
            if date_key in daily_counts:
                daily_counts[date_key] += 1

    return {
        'labels': list(daily_counts.keys()),
        'datasets': [{
            'label': '用户行为',
            'data': list(daily_counts.values()),
            'borderColor': 'rgb(75, 192, 192)',
            'tension': 0.1
        }]
    }


def prepare_distribution_data(behaviors):
    """准备分布数据"""
    if not behaviors:
        return {'labels': [], 'datasets': []}

    behavior_types = ['pv', 'cart', 'fav', 'buy']
    counts = {btype: 0 for btype in behavior_types}

    for behavior in behaviors:
        if behavior.behavior_type in counts:
            counts[behavior.behavior_type] += 1

    return {
        'labels': ['浏览', '加购', '收藏', '购买'],
        'datasets': [{
            'label': '行为分布',
            'data': [counts['pv'], counts['cart'], counts['fav'], counts['buy']],
            'backgroundColor': [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)'
            ]
        }]
    }


def prepare_comparison_data(behaviors):
    """准备对比数据"""
    if not behaviors:
        return {'labels': [], 'datasets': []}

    # 按用户分组统计行为次数
    user_behavior_counts = {}
    for behavior in behaviors:
        user_id = behavior.user_id
        if user_id not in user_behavior_counts:
            user_behavior_counts[user_id] = 0
        user_behavior_counts[user_id] += 1

    # 统计分布
    count_ranges = {'0-5次': 0, '6-20次': 0, '21-50次': 0, '51+次': 0}
    for count in user_behavior_counts.values():
        if count <= 5:
            count_ranges['0-5次'] += 1
        elif count <= 20:
            count_ranges['6-20次'] += 1
        elif count <= 50:
            count_ranges['21-50次'] += 1
        else:
            count_ranges['51+次'] += 1

    return {
        'labels': list(count_ranges.keys()),
        'datasets': [{
            'label': '用户行为频率分布',
            'data': list(count_ranges.values()),
            'backgroundColor': 'rgba(153, 102, 255, 0.2)'
        }]
    }


def prepare_correlation_data(behaviors):
    """准备关联数据"""
    if not behaviors:
        return {'datasets': []}

    # 按用户分析浏览和购买的关系
    user_data = {}
    for behavior in behaviors:
        user_id = behavior.user_id
        if user_id not in user_data:
            user_data[user_id] = {'views': 0, 'purchases': 0}

        if behavior.behavior_type == 'pv':
            user_data[user_id]['views'] += 1
        elif behavior.behavior_type == 'buy':
            user_data[user_id]['purchases'] += 1

    # 准备散点图数据
    scatter_data = []
    for user_id, data in list(user_data.items())[:100]:  # 限制前100个用户避免数据过多
        if data['views'] > 0:  # 只包含有浏览记录的用户
            scatter_data.append({
                'x': data['views'],
                'y': data['purchases']
            })

    return {
        'datasets': [{
            'label': '浏览-购买关联',
            'data': scatter_data,
            'backgroundColor': 'rgba(255, 159, 64, 0.2)'
        }]
    }


def get_default_stats():
    """获取默认统计数据"""
    return {
        'active_users': 0,
        'total_views': 0,
        'total_purchases': 0,
        'conversion_rate': 0,
        'user_growth': 0,
        'view_growth': 0,
        'purchase_growth': 0,
        'conversion_change': 0
    }


def get_default_insights():
    """获取默认洞察数据"""
    return {
        'growth_rate': 0,
        'at_risk_users': 0,
        'cart_to_buy': 0,
        'peak_hours': '暂无数据',
        'peak_percent': 0,
        'recommendations': []
    }


def get_default_api_data():
    """获取默认API数据"""
    return {
        'metrics': [],
        'dimensions': [],
        'filters': [],
        'chart_configs': {},
        'initial_data': {}
    }


# API路由-为前端JavaScript提供数据接口
@app.route('/api/visualization/data')
@login_required
def api_visualization_data():
    """提供可视化数据API"""
    try:
        start_date, end_date = _data_date_range(30)

        behaviors = UserBehavior.query.filter(
            UserBehavior.behavior_datetime.between(start_date, end_date)
        ).all()

        return jsonify({
            'success': True,
            'data': {
                'metrics': get_available_metrics(),
                'dimensions': get_available_dimensions(),
                'initial_charts': get_initial_chart_data(behaviors, start_date, end_date)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/visualization/generate', methods=['POST'])
@login_required
def api_generate_charts():
    """生成图表数据API"""
    try:
        config = request.get_json()
        chart_data =  generate_chart_data_based_on_config(config)
        return jsonify({
            'success': True,
            'charts': chart_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ========== 商品分析视图函数 ==========
@app.route('/item_analysis')
@login_required
def item_analysis():
    """商品分析页面"""
    days = int(request.args.get('days', 30))
    category = request.args.get('category', 'all')
    sort_by = request.args.get('sort_by', 'purchases')
    item_id_param = request.args.get('item_id')
    selected_item = None
    try:
        engine_data = de.get_item_stats(days, category, sort_by)
        overview_stats = engine_data['overview']
        top_items = engine_data['top_items']
        if item_id_param:
            try:
                selected_item = _build_item_detail(int(item_id_param))
            except Exception as ex:
                print(f"商品详情查询错误: {ex}")
    except Exception as e:
        print(f"商品分析页面错误: {e}")
        overview_stats = {'total_items': 0, 'item_growth': 0, 'active_items': 0, 'avg_price': 0}
        top_items = []
    return render_template('item_analysis.html',
                           overview_stats=overview_stats,
                           top_items=top_items,
                           selected_item=selected_item)


def _build_item_detail(item_id):
    """构建商品详情数据字典"""
    profile = ItemProfile.query.get(item_id)
    behaviors = UserBehavior.query.filter_by(item_id=item_id).limit(2000).all()
    view_cnt     = len([b for b in behaviors if b.behavior_type == 'pv'])
    cart_cnt     = len([b for b in behaviors if b.behavior_type == 'cart'])
    fav_cnt      = len([b for b in behaviors if b.behavior_type == 'fav'])
    purchase_cnt = len([b for b in behaviors if b.behavior_type == 'buy'])
    if profile:
        view_cnt     = max(view_cnt, profile.total_views)
        purchase_cnt = max(purchase_cnt, profile.total_purchases)
    conv = round(purchase_cnt / view_cnt * 100, 1) if view_cnt else 0
    cart_conv = round(purchase_cnt / cart_cnt * 100, 1) if cart_cnt else 0
    fav_conv  = round(purchase_cnt / fav_cnt  * 100, 1) if fav_cnt  else 0
    # 从行为记录提取商品名称/品牌/品类
    sample = next((b for b in behaviors if b.product_name), None)
    product_name  = sample.product_name  if sample else f'商品{item_id}'
    brand         = sample.brand         if sample else '—'
    category_name = sample.category_name if sample else (f'类目{profile.category_id}' if profile else '未知')
    total_spent = sum(b.price for b in behaviors if b.behavior_type == 'buy' and b.price)
    return {
        'item_id': item_id,
        'product_name': product_name,
        'brand': brand,
        'category_id': profile.category_id if profile else 0,
        'category_name': category_name,
        'view_count': view_cnt,
        'cart_count': cart_cnt,
        'fav_count': fav_cnt,
        'purchase_count': purchase_cnt,
        'revenue': round(total_spent, 2),
        'conversion_rate': conv,
        'cart_conversion': cart_conv,
        'fav_conversion': fav_conv,
    }


# ========== 行为分析中心 ==========
@app.route('/behavior_analysis_center')
@login_required
def behavior_analysis_center():
    """行为分析中心 - 整合转化漏斗、RFM分群和行为可视化（数据由 /api/behavior/stats 提供）"""
    return render_template('behavior_analysis_center.html')


# ========== 数据看板 ==========
@app.route('/dashboard')
@login_required
def dashboard():
    """数据看板（数据由 /api/dashboard/stats 动态加载）"""
    return render_template('dashboard.html')


# ========== 其他功能页面 ==========
@app.route('/conversion_analysis')
@login_required
def conversion_analysis():
    return render_template('conversion_analysis.html')



@app.route('/rfm_analysis')
@login_required
def rfm_analysis():
    """RFM用户价值分析页面"""
    days = int(request.args.get('days', 90))
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    try:
        rfm_data = de.get_rfm_data(days)
        segs = {s['segment']: s for s in rfm_data.get('segments', [])}
        high_segs = ['champion', 'loyal']
        risk_segs = ['at_risk', 'slipping']
        high_val  = sum(segs[k]['count'] for k in high_segs if k in segs)
        at_risk   = sum(segs[k]['count'] for k in risk_segs if k in segs)
        total_u   = rfm_data.get('total_users', 0)
        all_mon   = [s['avg_monetary'] for s in rfm_data.get('segments', []) if s.get('avg_monetary')]
        rfm_data.update({
            'total_segments':     len(rfm_data.get('segments', [])),
            'high_value_count':   high_val,
            'high_value_percent': round(high_val / total_u * 100, 1) if total_u else 0,
            'at_risk_count':      at_risk,
            'avg_customer_value': round(sum(all_mon) / len(all_mon), 2) if all_mon else 0,
        })
        return render_template('rfm_analysis.html',
                               rfm_data=rfm_data,
                               insights=[],
                               analysis_period=f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
    except Exception as e:
        print(f"RFM分析页面错误: {str(e)}")
        empty = de._empty_rfm()
        empty.update({'total_segments': 0, 'high_value_count': 0, 'high_value_percent': 0,
                      'at_risk_count': 0, 'avg_customer_value': 0})
        return render_template('rfm_analysis.html',
                               rfm_data=empty,
                               insights=[])


@app.route('/api/rfm/data')
@login_required
def api_rfm_data():
    """RFM数据API接口"""
    try:
        from datetime import datetime, timedelta

        start_date, end_date = _data_date_range(90)

        behaviors = UserBehavior.query.filter(
            UserBehavior.behavior_datetime.between(start_date, end_date)
        ).all()

        user_profiles = UserProfile.query.all()

        rfm_data = calculate_complete_rfm_analysis(behaviors, user_profiles, end_date)

        return jsonify({
            'success': True,
            'data': {
                'rfm_matrix': prepare_rfm_matrix_data(rfm_data),
                'segment_distribution': prepare_segment_distribution(rfm_data),
                'segment_trends': prepare_segment_trends(behaviors, start_date, end_date),
                'segment_comparison': prepare_segment_comparison(rfm_data),
                'user_segments': rfm_data['user_segments']
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/time_pattern')
@login_required
def time_pattern():
    """用户行为时间模式分析页面"""
    try:
        # 获取数据（以数据库最新记录为基准）
        start_date, end_date = _data_date_range(30)

        # 获取用户行为数据
        behaviors = UserBehavior.query.filter(
            UserBehavior.behavior_datetime.between(start_date, end_date)
        ).all()

        # 计算时间模式统计数据
        time_stats = calculate_time_statistics(behaviors, start_date, end_date)

        # 准备图表数据
        chart_data = prepare_time_pattern_charts(behaviors, start_date, end_date)

        return render_template('time_pattern.html',
                               time_stats=time_stats,
                               chart_data=chart_data,
                               analysis_period=f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")

    except Exception as e:
        print(f"时间模式分析页面错误: {str(e)}")
        # 返回默认数据避免页面崩溃
        return render_template('time_pattern.html',
                               time_stats=get_default_time_stats(),
                               chart_data=get_default_chart_data())


def calculate_time_statistics(behaviors, start_date, end_date):
    """计算时间模式统计指标"""
    if not behaviors:
        return get_default_time_stats()

    # 按小时分析
    hourly_stats = analyze_hourly_patterns(behaviors)

    # 按星期分析
    weekly_stats = analyze_weekly_patterns(behaviors)

    # 按日期趋势分析
    trend_stats = analyze_date_trends(behaviors, start_date, end_date)

    # 节假日分析
    holiday_stats = analyze_holiday_patterns(behaviors)

    return {
        # 基础指标
        'daily_activity': len(behaviors) / 30,  # 日均活跃度
        'daily_change': calculate_daily_change(behaviors, start_date, end_date),

        # 时间模式
        'peak_hours': hourly_stats.get('peak_hours', '20:00-22:00'),
        'peak_percent': hourly_stats.get('peak_percent', 35),
        'peak_day': weekly_stats.get('peak_day', '周六'),
        'peak_day_increase': weekly_stats.get('peak_day_increase', 25),

        # 转化相关
        'best_conversion_hour': hourly_stats.get('best_conversion_hour', '21:00'),
        'best_conversion_rate': hourly_stats.get('best_conversion_rate', 8.5),

        # 节假日相关
        'weekend_increase': weekly_stats.get('weekend_increase', 30),
        'holiday_increase': holiday_stats.get('holiday_increase', 80),
        'holiday_avg_price_increase': holiday_stats.get('holiday_avg_price_increase', 25),

        # 促销相关
        'promo_increase': trend_stats.get('promo_increase', 120),
        'promo_conversion_increase': trend_stats.get('promo_conversion_increase', 45),

        # 低峰时段
        'low_peak_hours': hourly_stats.get('low_peak_hours', '03:00-06:00'),
        'pre_peak_hours': hourly_stats.get('pre_peak_hours', '19:00-20:00')
    }


def analyze_hourly_patterns(behaviors):
    """分析小时行为模式"""
    if not behaviors:
        return {}

    # 按小时统计行为
    hourly_counts = {hour: 0 for hour in range(24)}
    hourly_conversions = {hour: {'views': 0, 'purchases': 0} for hour in range(24)}

    for behavior in behaviors:
        if behavior.timestamp:
            hour = behavior.timestamp.hour
            hourly_counts[hour] += 1

            if behavior.behavior_type == 'pv':
                hourly_conversions[hour]['views'] += 1
            elif behavior.behavior_type == 'buy':
                hourly_conversions[hour]['purchases'] += 1

    # 找到高峰时段
    peak_hour = max(hourly_counts, key=hourly_counts.get)
    total_behaviors = sum(hourly_counts.values())
    peak_percent = round((hourly_counts[peak_hour] / total_behaviors * 100), 1) if total_behaviors > 0 else 0

    # 计算转化率最高的时段
    best_conversion_hour = None
    best_conversion_rate = 0

    for hour in range(24):
        views = hourly_conversions[hour]['views']
        purchases = hourly_conversions[hour]['purchases']
        conversion_rate = (purchases / views * 100) if views > 0 else 0

        if conversion_rate > best_conversion_rate:
            best_conversion_rate = round(conversion_rate, 1)
            best_conversion_hour = f"{hour:02d}:00"

    return {
        'peak_hours': f"{peak_hour:02d}:00-{(peak_hour + 2) % 24:02d}:00",
        'peak_percent': peak_percent,
        'best_conversion_hour': best_conversion_hour or '21:00',
        'best_conversion_rate': best_conversion_rate,
        'low_peak_hours': '03:00-06:00',
        'pre_peak_hours': '19:00-20:00'
    }


def prepare_hourly_chart_data(behaviors):
    """准备24小时图表数据"""
    # 这里实现实际的数据处理逻辑
    # 暂时返回示例数据
    return {
        'success': True,
        'data': {
            'hours': [f'{i:02d}:00' for i in range(24)],
            'pv': [120, 90, 60, 50, 40, 60, 120, 240, 320, 400, 450, 500,
                   550, 580, 600, 620, 650, 700, 800, 950, 1050, 980, 750, 400],
            'cart': [15, 10, 5, 3, 2, 5, 15, 30, 45, 60, 70, 80,
                     85, 90, 95, 100, 110, 120, 140, 160, 180, 170, 130, 80],
            'fav': [8, 5, 3, 2, 1, 3, 8, 15, 20, 25, 30, 35,
                    40, 45, 50, 55, 60, 65, 70, 80, 90, 85, 70, 40],
            'buy': [5, 3, 1, 0, 0, 1, 5, 10, 15, 20, 25, 30,
                    35, 40, 45, 50, 55, 60, 65, 75, 85, 80, 60, 30]
        }
    }


def analyze_weekly_patterns(behaviors):
    """分析周行为模式"""
    if not behaviors:
        return {}

    # 按星期统计
    weekday_counts = {i: 0 for i in range(7)}
    weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

    for behavior in behaviors:
        if behavior.timestamp:
            weekday = behavior.timestamp.weekday()
            weekday_counts[weekday] += 1

    # 找到高峰日
    peak_weekday = max(weekday_counts, key=weekday_counts.get)
    weekday_avg = sum(weekday_counts.values()) / 7

    # 计算周末增长
    weekend_avg = (weekday_counts[5] + weekday_counts[6]) / 2  # 周六+周日平均
    weekday_avg = sum(weekday_counts[i] for i in range(5)) / 5  # 周一到周五平均
    weekend_increase = round(((weekend_avg - weekday_avg) / weekday_avg * 100), 1) if weekday_avg > 0 else 0

    return {
        'peak_day': weekdays[peak_weekday],
        'peak_day_increase': round(((weekday_counts[peak_weekday] - weekday_avg) / weekday_avg * 100), 1),
        'weekend_increase': max(0, weekend_increase)  # 确保非负数
    }


def analyze_date_trends(behaviors, start_date, end_date):
    """分析日期趋势"""
    # 简化的趋势分析
    return {
        'promo_increase': 120,  # 促销期间增长
        'promo_conversion_increase': 45  # 促销转化率增长
    }


def analyze_holiday_patterns(behaviors):
    """分析节假日模式"""
    # 简化的节假日分析
    return {
        'holiday_increase': 80,  # 节假日增长
        'holiday_avg_price_increase': 25  # 客单价增长
    }


def calculate_daily_change(behaviors, start_date, end_date):
    """计算日均变化率"""
    if not behaviors or len(behaviors) < 2:
        return 12.5  # 默认值

    # 将时间分为两半进行比较
    mid_date = start_date + (end_date - start_date) / 2

    first_half = len([b for b in behaviors if b.timestamp and b.timestamp <= mid_date])
    second_half = len([b for b in behaviors if b.timestamp and b.timestamp > mid_date])

    if first_half == 0:
        return 100.0

    growth_rate = (second_half - first_half) / first_half * 100
    return round(growth_rate, 1)


def prepare_time_pattern_charts(behaviors, start_date, end_date):
    """准备时间模式图表数据"""
    return {
        'hourly_data': prepare_hourly_chart_data(behaviors),
        'weekly_data': prepare_weekly_chart_data(behaviors),
        'trend_data': prepare_trend_chart_data(behaviors, start_date, end_date),
        'holiday_data': prepare_holiday_chart_data(behaviors)
    }


def prepare_weekly_chart_data(behaviors):
    """准备每周行为模式图表数据"""
    if not behaviors:
        # 返回模拟数据
        return {
            'success': True,
            'data': {
                'weekdays': ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                'total_activity': [850, 920, 880, 900, 950, 1250, 1100],
                'conversion_rate': [5.2, 5.8, 5.5, 5.6, 5.9, 7.8, 6.5],
                'avg_order_value': [258, 265, 260, 262, 270, 320, 285]
            }
        }

    # 实际数据处理逻辑
    weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    activity_data = {day: 0 for day in range(7)}
    conversion_data = {day: {'pv': 0, 'buy': 0} for day in range(7)}

    for behavior in behaviors:
        if behavior.timestamp:
            weekday = behavior.timestamp.weekday()
            activity_data[weekday] += 1

            if behavior.behavior_type == 'pv':
                conversion_data[weekday]['pv'] += 1
            elif behavior.behavior_type == 'buy':
                conversion_data[weekday]['buy'] += 1

    # 计算每日数据
    total_activity = [activity_data[i] for i in range(7)]
    conversion_rate = []

    for i in range(7):
        pv = conversion_data[i]['pv']
        buy = conversion_data[i]['buy']
        rate = (buy / pv * 100) if pv > 0 else 0
        conversion_rate.append(round(rate, 1))

    return {
        'success': True,
        'data': {
            'weekdays': weekdays,
            'total_activity': total_activity,
            'conversion_rate': conversion_rate,
            'avg_order_value': [250, 260, 255, 258, 265, 315, 280]  # 简化处理
        }
    }


def prepare_trend_chart_data(behaviors, start_date, end_date):
    """准备时间趋势图表数据"""
    if not behaviors:
        # 返回模拟数据
        dates = []
        current_date = start_date

        while current_date <= end_date:
            dates.append(current_date.strftime('%m-%d'))
            current_date += timedelta(days=1)

        # 模拟趋势数据
        import random
        base_trend = [1000 + i * 20 for i in range(len(dates))]
        trend_data = [val + random.randint(-50, 50) for val in base_trend]

        return {
            'success': True,
            'data': {
                'dates': dates[:30],  # 最多显示30天
                'trend': trend_data[:30],
                'weekly_avg': [sum(trend_data[i:i + 7]) / 7 for i in range(0, len(trend_data), 7)]
            }
        }

    # 实际数据处理逻辑
    # 按日期分组统计
    from collections import defaultdict
    date_activity = defaultdict(int)

    for behavior in behaviors:
        if behavior.timestamp:
            date_str = behavior.timestamp.strftime('%m-%d')
            date_activity[date_str] += 1

    # 按日期排序
    sorted_dates = sorted(date_activity.keys())
    trend_data = [date_activity[date] for date in sorted_dates]

    return {
        'success': True,
        'data': {
            'dates': sorted_dates[:30],  # 限制显示数量
            'trend': trend_data[:30],
            'weekly_avg': calculate_weekly_average(trend_data)
        }
    }


def prepare_holiday_chart_data(behaviors):
    """准备节假日对比图表数据"""
    if not behaviors:
        # 返回模拟数据
        return {
            'success': True,
            'data': {
                'labels': ['工作日', '周末', '节假日', '促销日'],
                'activity': [850, 1175, 1530, 1870],
                'conversion': [5.5, 7.2, 8.3, 8.0],
                'avg_value': [260, 303, 325, 312]
            }
        }

    # 实际数据处理逻辑
    # 这里需要区分工作日、周末、节假日、促销日
    # 简化处理，返回模拟数据
    return {
        'success': True,
        'data': {
            'labels': ['工作日', '周末', '节假日', '促销日'],
            'activity': [calculate_workday_activity(behaviors),
                         calculate_weekend_activity(behaviors),
                         calculate_holiday_activity(behaviors),
                         calculate_promo_activity(behaviors)],
            'conversion': [6.2, 7.8, 8.5, 8.2],
            'avg_value': [265, 310, 335, 305]
        }
    }


def calculate_weekly_average(data):
    """计算每周平均值"""
    if len(data) < 7:
        return []

    weekly_avg = []
    for i in range(0, len(data), 7):
        week_data = data[i:i + 7]
        if len(week_data) == 7:
            weekly_avg.append(sum(week_data) / 7)
    return weekly_avg


def calculate_workday_activity(behaviors):
    """计算工作日活跃度"""
    workday_behaviors = [b for b in behaviors
                         if b.timestamp and b.timestamp.weekday() < 5]
    return len(workday_behaviors)


def calculate_weekend_activity(behaviors):
    """计算周末活跃度"""
    weekend_behaviors = [b for b in behaviors
                         if b.timestamp and b.timestamp.weekday() >= 5]
    return len(weekend_behaviors)


def calculate_holiday_activity(behaviors):
    """计算节假日活跃度"""
    # 这里需要节假日数据，暂时简化
    return len(behaviors) * 0.2  # 假设20%是节假日行为


def calculate_promo_activity(behaviors):
    """计算促销日活跃度"""
    # 这里需要促销日数据，暂时简化
    return len(behaviors) * 0.25  # 假设25%是促销日行为


def get_default_time_stats():
    """获取默认时间统计数据"""
    return {
        'daily_activity': 1589,
        'daily_change': 12.5,
        'peak_hours': '20:00-22:00',
        'peak_percent': 35,
        'peak_day': '周六',
        'peak_day_increase': 25,
        'best_conversion_hour': '21:00',
        'best_conversion_rate': 8.5,
        'weekend_increase': 30,
        'holiday_increase': 80,
        'holiday_avg_price_increase': 25,
        'promo_increase': 120,
        'promo_conversion_increase': 45,
        'low_peak_hours': '03:00-06:00',
        'pre_peak_hours': '19:00-20:00'
    }


def get_default_chart_data():
    """获取默认图表数据"""
    return {
        'hourly_data': {},
        'weekly_data': {},
        'trend_data': {},
        'holiday_data': {}
    }


@app.route('/user_analysis')
@login_required
def user_analysis():
    """用户画像分析页面"""
    user_id_param = request.args.get('user_id')
    user_info = None
    user_id_val = None
    if user_id_param:
        try:
            user_id_val = int(user_id_param)
            user_info = _build_user_info(user_id_val)
        except Exception as e:
            print(f"用户画像查询错误: {e}")
    return render_template('user_analysis.html', user_info=user_info, user_id=user_id_val)


@app.route('/user/<int:user_id>/analysis')
@login_required
def user_detail_analysis(user_id):
    """单用户画像详情页（JS跳转目标）"""
    try:
        user_info = _build_user_info(user_id)
    except Exception as e:
        print(f"用户画像查询错误: {e}")
        user_info = None
    return render_template('user_analysis.html', user_info=user_info, user_id=user_id)


def _build_user_info(user_id):
    """从数据库构建用户画像数据字典"""
    behaviors = UserBehavior.query.filter_by(user_id=user_id).order_by(UserBehavior.timestamp.desc()).limit(1000).all()
    if not behaviors:
        return None
    pv   = [b for b in behaviors if b.behavior_type == 'pv']
    cart = [b for b in behaviors if b.behavior_type == 'cart']
    fav  = [b for b in behaviors if b.behavior_type == 'fav']
    buy  = [b for b in behaviors if b.behavior_type == 'buy']
    pv_cnt   = len(pv)
    cart_cnt = len(cart)
    fav_cnt  = len(fav)
    buy_cnt  = len(buy)
    pv_to_cart = round(cart_cnt / pv_cnt * 100, 1) if pv_cnt else 0
    pv_to_fav  = round(fav_cnt  / pv_cnt * 100, 1) if pv_cnt else 0
    pv_to_buy  = round(buy_cnt  / pv_cnt * 100, 1) if pv_cnt else 0
    # 最近活跃天数
    last_ts = behaviors[0].behavior_datetime
    days_ago = (datetime.now() - last_ts).days if last_ts else '未知'
    # 偏好品类 top3
    cat_count = {}
    for b in behaviors:
        cat_count[b.category_id] = cat_count.get(b.category_id, 0) + 1
    top_cats = sorted(cat_count, key=lambda x: cat_count[x], reverse=True)[:3]
    icon_list = ['fas fa-mobile-alt', 'fas fa-tshirt', 'fas fa-home']
    color_list = ['#5470C6', '#91CC75', '#FAC858']
    preferences = [{'name': f'类目{c}', 'icon': icon_list[i % 3], 'color': color_list[i % 3]}
                   for i, c in enumerate(top_cats)]
    # 用户分群
    total_actions = len(behaviors)
    if buy_cnt >= 5:
        segment, segment_name, value_level = 'high_value', '高价值用户', 'high'
    elif buy_cnt >= 1:
        segment, segment_name, value_level = 'active', '活跃用户', 'medium'
    else:
        segment, segment_name, value_level = 'new', '新用户', 'low'
    activity_level = 'high' if total_actions >= 50 else ('medium' if total_actions >= 10 else 'low')
    insights = [
        f'用户共产生 {total_actions} 次行为，其中购买 {buy_cnt} 次',
        f'浏览到购买转化率为 {pv_to_buy}%',
        f'最近一次活跃在 {days_ago} 天前'
    ]
    recommendations = [
        {'suggestion': '可通过个性化推荐提升加购率'},
        {'suggestion': '对高价值用户优先推送新品'},
    ]
    return {
        'user_id': user_id,
        'segment': segment,
        'segment_name': segment_name,
        'activity_level': activity_level,
        'value_level': value_level,
        'register_time': '未知',
        'last_active': days_ago,
        'region': '未知',
        'device': '未知',
        'pv_count': pv_cnt,
        'cart_count': cart_cnt,
        'fav_count': fav_cnt,
        'buy_count': buy_cnt,
        'pv_to_cart_rate': pv_to_cart,
        'pv_to_fav_rate': pv_to_fav,
        'pv_to_buy_rate': pv_to_buy,
        'overall_conversion': pv_to_buy,
        'price_sensitivity': 50,
        'preferences': preferences,
        'summary': f'用户 {user_id} 共产生 {total_actions} 次行为，购买转化率 {pv_to_buy}%，分群为「{segment_name}」。',
        'insights': insights,
        'recommendations': recommendations,
    }


@app.route('/user_value_analysis')
@login_required
def user_value_analysis():
    """用户价值分析 - 基于RFM模型的用户分群与运营策略"""
    return render_template('user_value_analysis.html')


# ========== 数据导出视图函数 ==========
@app.route('/data_export')
@login_required
def data_export():
    """数据导出页面"""
    return render_template('data_export.html')

# ========== 推荐分析视图函数（保留旧路由兼容） ==========
@app.route('/recommend_analysis')
@login_required
def recommend_analysis():
    """推荐系统分析页面 - 重定向到智能推荐"""
    return redirect(url_for('intelligent_recommendation'))
    
    # """推荐系统分析页面"""
    # try:
    #     # 获取最近30天的数据
    #     end_date = datetime.now()
    #     start_date = end_date - timedelta(days=30)

    #     # 获取推荐系统相关数据
    #     recommendations = Recommendation.query.filter(
    #         Recommendation.timestamp.between(start_date, end_date)
    #     ).all()

    #     user_behaviors = UserBehavior.query.filter(
    #         UserBehavior.timestamp.between(start_date, end_date)
    #     ).all()

    #     # 计算推荐系统性能指标
    #     performance_stats = calculate_recommendation_performance(recommendations, user_behaviors)

    #     # 准备图表数据
    #     chart_data = prepare_recommendation_charts(recommendations, user_behaviors, start_date, end_date)

    #     # 生成优化建议
    #     optimization_suggestions = generate_optimization_suggestions(performance_stats)

    #     return render_template('recommend_analysis.html',
    #                            performance_stats=performance_stats,
    #                            chart_data=chart_data,
    #                            optimization_suggestions=optimization_suggestions,
    #                            analysis_period=f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")

    # except Exception as e:
    #     print(f"推荐系统分析页面错误: {str(e)}")
    #     # 返回默认数据避免页面崩溃
    #     return render_template('recommend_analysis.html',
    #                            performance_stats=get_default_performance_stats(),
    #                            chart_data=get_default_chart_data(),
    #                            optimization_suggestions=get_default_suggestions())


def calculate_recommendation_performance(recommendations, user_behaviors):
    """计算推荐系统性能指标"""
    if not recommendations:
        return get_default_performance_stats()

    # 基础指标计算
    total_recommendations = len(recommendations)
    clicked_recommendations = len([rec for rec in recommendations if getattr(rec, 'clicked', False)])
    purchased_recommendations = len([rec for rec in recommendations if getattr(rec, 'purchased', False)])

    # 计算点击率和转化率
    ctr = (clicked_recommendations / total_recommendations * 100) if total_recommendations > 0 else 0
    conversion_rate = (purchased_recommendations / clicked_recommendations * 100) if clicked_recommendations > 0 else 0

    # 按模型分析性能
    model_performance = analyze_model_performance(recommendations)

    # 用户分群效果
    segment_performance = analyze_segment_performance(recommendations, user_behaviors)

    return {
        # 基础指标
        'best_model': model_performance.get('best_model', '混合推荐'),
        'best_f1': model_performance.get('best_f1', 0.78),
        'avg_precision': model_performance.get('avg_precision', 0.72),
        'precision_change': model_performance.get('precision_change', 1.2),
        'coverage': model_performance.get('coverage', 0.65),
        'response_time': model_performance.get('response_time', 150),

        # 转化指标
        'ctr': round(ctr, 2),
        'conversion_rate': round(conversion_rate, 2),
        'avg_order_value': calculate_avg_order_value(recommendations),
        'revenue_per_recommendation': calculate_revenue_per_recommendation(recommendations),

        # 模型对比
        'model_comparison': model_performance.get('comparison', {}),
        'segment_performance': segment_performance,

        # 多样性指标
        'diversity_score': calculate_diversity_score(recommendations),
        'novelty_score': calculate_novelty_score(recommendations),
        'serendipity_score': calculate_serendipity_score(recommendations)
    }


def analyze_model_performance(recommendations):
    """分析各模型性能"""
    if not recommendations:
        return get_default_model_performance()

    # 按模型分组统计
    models = ['cf_user', 'cf_item', 'content', 'hybrid', 'deepfm']
    model_stats = {}

    for model in models:
        model_recommendations = [rec for rec in recommendations
                                 if getattr(rec, 'model_type', 'hybrid') == model]
        if model_recommendations:
            model_stats[model] = calculate_model_metrics(model_recommendations)

    # 找出最佳模型
    best_model = max(model_stats.items(), key=lambda x: x[1].get('f1_score', 0),
                     default=('hybrid', {'f1_score': 0.78}))

    return {
        'best_model': get_model_display_name(best_model[0]),
        'best_f1': best_model[1].get('f1_score', 0.78),
        'avg_precision': calculate_weighted_average(model_stats, 'precision'),
        'precision_change': 1.2,  # 简化计算
        'coverage': calculate_coverage(model_stats),
        'response_time': 150,
        'comparison': model_stats
    }


def analyze_segment_performance(recommendations, user_behaviors):
    """分析用户分群效果"""
    segments = {
        'high_value': {'ctr': 12.5, 'conversion': 8.3, 'satisfaction': 92},
        'regular': {'ctr': 8.2, 'conversion': 4.1, 'satisfaction': 78},
        'new_user': {'ctr': 6.5, 'conversion': 2.8, 'satisfaction': 65}
    }

    # 这里可以添加实际的数据分析逻辑
    # 基于用户行为数据计算各分群的实际表现

    return segments


def prepare_recommendation_charts(recommendations, user_behaviors, start_date, end_date):
    """准备推荐系统图表数据"""
    return {
        'model_comparison': prepare_model_comparison_data(recommendations),
        'pr_curve': prepare_pr_curve_data(recommendations),
        'roc_curve': prepare_roc_curve_data(recommendations),
        'ctr_distribution': prepare_ctr_distribution_data(recommendations),
        'conversion_analysis': prepare_conversion_analysis_data(recommendations),
        'trend_analysis': prepare_trend_analysis_data(recommendations, start_date, end_date)
    }


def prepare_model_comparison_data(recommendations):
    """准备模型对比图表数据"""
    models = ['用户CF', '物品CF', '内容推荐', '混合推荐', 'DeepFM']

    return {
        'labels': models,
        'datasets': [
            {
                'name': '精确率',
                'data': [0.68, 0.65, 0.60, 0.72, 0.78],
                'color': '#5470C6'
            },
            {
                'name': '召回率',
                'data': [0.72, 0.70, 0.65, 0.75, 0.80],
                'color': '#91CC75'
            },
            {
                'name': 'F1分数',
                'data': [0.70, 0.68, 0.62, 0.73, 0.79],
                'color': '#FAC858'
            },
            {
                'name': 'NDCG',
                'data': [0.75, 0.72, 0.68, 0.78, 0.85],
                'color': '#EE6666'
            }
        ]
    }


def prepare_pr_curve_data(recommendations):
    """准备PR曲线数据"""
    return {
        'series': [
            {
                'name': '用户CF',
                'data': generate_pr_points(0.68, 0.72)
            },
            {
                'name': '物品CF',
                'data': generate_pr_points(0.65, 0.70)
            },
            {
                'name': '内容推荐',
                'data': generate_pr_points(0.60, 0.65)
            },
            {
                'name': '混合推荐',
                'data': generate_pr_points(0.72, 0.75)
            },
            {
                'name': 'DeepFM',
                'data': generate_pr_points(0.78, 0.80)
            }
        ]
    }


def prepare_roc_curve_data(recommendations):
    """准备ROC曲线数据"""
    return {
        'series': [
            {
                'name': '用户CF',
                'data': generate_roc_points(0.8)
            },
            {
                'name': '物品CF',
                'data': generate_roc_points(0.78)
            },
            {
                'name': '内容推荐',
                'data': generate_roc_points(0.72)
            },
            {
                'name': '混合推荐',
                'data': generate_roc_points(0.82)
            },
            {
                'name': 'DeepFM',
                'data': generate_roc_points(0.85)
            },
            {
                'name': '随机线',
                'data': [[0, 0], [1, 1]],
                'is_dashed': True
            }
        ]
    }


def prepare_ctr_distribution_data(recommendations):
    """准备CTR分布图表数据"""
    if not recommendations:
        # 返回模拟数据
        return {
            'success': True,
            'data': {
                'bins': ['0-2%', '2-4%', '4-6%', '6-8%', '8-10%', '10%+'],
                'counts': [120, 200, 150, 80, 70, 40],
                'percentages': [18.2, 30.3, 22.7, 12.1, 10.6, 6.1]
            }
        }

    # 实际数据处理逻辑
    ctr_values = []
    for rec in recommendations:
        if hasattr(rec, 'ctr'):
            ctr_values.append(rec.ctr)
        else:
            # 如果没有CTR字段，使用模拟数据
            ctr_values.append(random.uniform(0, 15))

    # 分组统计
    bins = [0, 2, 4, 6, 8, 10, 100]  # CTR百分比范围
    labels = ['0-2%', '2-4%', '4-6%', '6-8%', '8-10%', '10%+']
    counts = [0] * (len(bins) - 1)

    for ctr in ctr_values:
        for i in range(len(bins) - 1):
            if bins[i] <= ctr < bins[i + 1]:
                counts[i] += 1
                break

    total = sum(counts)
    percentages = [round(count / total * 100, 1) for count in counts] if total > 0 else [0] * len(counts)

    return {
        'success': True,
        'data': {
            'bins': labels,
            'counts': counts,
            'percentages': percentages
        }
    }


def prepare_conversion_analysis_data(recommendations):
    """准备转化分析图表数据"""
    if not recommendations:
        # 返回模拟数据
        return {
            'success': True,
            'data': {
                'steps': ['曝光', '点击', '加购', '收藏', '下单', '支付'],
                'conversion_rates': [100.0, 8.5, 6.2, 7.8, 9.1, 5.4, 4.2],
                'counts': [10000, 850, 620, 780, 910, 540, 420]
            }
        }

    # 实际数据处理逻辑
    # 这里需要根据实际数据计算转化漏斗
    steps = ['曝光', '点击', '加购', '收藏', '下单', '支付']

    # 模拟计算各步骤数据
    import random
    base_counts = 10000
    conversion_rates = [100.0]
    counts = [base_counts]

    for i in range(len(steps)):
        # 模拟转化率下降
        prev_rate = conversion_rates[-1]
        conversion_rate = prev_rate * random.uniform(0.5, 0.9)
        conversion_rates.append(round(conversion_rate, 1))
        counts.append(int(base_counts * conversion_rate / 100))

    return {
        'success': True,
        'data': {
            'steps': ['曝光'] + steps,
            'conversion_rates': conversion_rates,
            'counts': counts
        }
    }


def prepare_trend_analysis_data(recommendations, start_date, end_date):
    """准备趋势分析图表数据"""
    if not recommendations:
        # 返回模拟数据
        dates = []
        current_date = start_date
        while current_date <= end_date:
            dates.append(current_date.strftime('%m-%d'))
            current_date += timedelta(days=1)

        # 模拟趋势数据
        import random
        ctr_data = [8.5 + random.uniform(-1, 1) for _ in dates]
        conversion_data = [4.2 + random.uniform(-0.5, 0.5) for _ in dates]
        revenue_data = [10.8 + random.uniform(-2, 2) for _ in dates]

        return {
            'success': True,
            'data': {
                'dates': dates[-30:],  # 最近30天
                'ctr': ctr_data[-30:],
                'conversion_rate': conversion_data[-30:],
                'revenue': revenue_data[-30:]
            }
        }

    # 实际数据处理逻辑
    from collections import defaultdict
    daily_stats = defaultdict(lambda: {'clicks': 0, 'views': 0, 'purchases': 0, 'revenue': 0})

    for rec in recommendations:
        if rec.timestamp:
            date_key = rec.timestamp.strftime('%m-%d')
            daily_stats[date_key]['views'] += 1

            if getattr(rec, 'clicked', False):
                daily_stats[date_key]['clicks'] += 1
            if getattr(rec, 'purchased', False):
                daily_stats[date_key]['purchases'] += 1
                daily_stats[date_key]['revenue'] += getattr(rec, 'revenue', 0)

    # 按日期排序
    sorted_dates = sorted(daily_stats.keys())[-30:]  # 取最近30天

    ctr_data = []
    conversion_data = []
    revenue_data = []

    for date in sorted_dates:
        stats = daily_stats[date]
        ctr = (stats['clicks'] / stats['views'] * 100) if stats['views'] > 0 else 0
        conversion = (stats['purchases'] / stats['clicks'] * 100) if stats['clicks'] > 0 else 0

        ctr_data.append(round(ctr, 1))
        conversion_data.append(round(conversion, 1))
        revenue_data.append(round(stats['revenue'], 2))

    return {
        'success': True,
        'data': {
            'dates': sorted_dates,
            'ctr': ctr_data,
            'conversion_rate': conversion_data,
            'revenue': revenue_data
        }
    }


def generate_optimization_suggestions(performance_stats):
    """生成优化建议"""
    suggestions = []

    # 基于性能指标生成建议
    if performance_stats.get('ctr', 0) < 8:
        suggestions.append({
            'title': '优化新用户推荐',
            'description': '新用户点击率低于平均水平，建议增加热门商品和探索性推荐',
            'priority': 'high',
            'icon': 'exclamation-circle'
        })

    if performance_stats.get('diversity_score', 0) < 0.6:
        suggestions.append({
            'title': '提升模型多样性',
            'description': '当前推荐多样性较低，建议增加内容推荐的比例',
            'priority': 'medium',
            'icon': 'chart-line'
        })

    if performance_stats.get('response_time', 0) > 200:
        suggestions.append({
            'title': '优化模型更新频率',
            'description': '考虑增加实时模型更新，提升推荐时效性',
            'priority': 'low',
            'icon': 'sync-alt'
        })

    # 默认建议
    if not suggestions:
        suggestions = [
            {
                'title': '优化新用户推荐',
                'description': '新用户点击率低于平均水平，建议增加热门商品和探索性推荐',
                'priority': 'high',
                'icon': 'exclamation-circle'
            },
            {
                'title': '提升模型多样性',
                'description': '当前推荐多样性较低，建议增加内容推荐的比例',
                'priority': 'medium',
                'icon': 'chart-line'
            },
            {
                'title': '优化模型更新频率',
                'description': '考虑增加实时模型更新，提升推荐时效性',
                'priority': 'low',
                'icon': 'sync-alt'
            }
        ]

    return suggestions


# 辅助函数
def get_model_display_name(model_key):
    """获取模型显示名称"""
    model_names = {
        'cf_user': '基于用户的协同过滤',
        'cf_item': '基于物品的协同过滤',
        'content': '基于内容推荐',
        'hybrid': '混合推荐',
        'deepfm': 'DeepFM深度学习'
    }
    return model_names.get(model_key, model_key)


def calculate_model_metrics(model_recommendations):
    """计算单个模型的指标 - 适配Recommendation模型"""
    if not model_recommendations:
        return {'precision': 0, 'recall': 0, 'f1_score': 0}

    # 根据实际业务逻辑计算指标
    # 这里使用模拟数据
    clicked = len([rec for rec in model_recommendations if getattr(rec, 'clicked', False)])
    purchased = len([rec for rec in model_recommendations if getattr(rec, 'purchased', False)])
    total = len(model_recommendations)

    precision = clicked / total if total > 0 else 0
    recall = purchased / clicked if clicked> 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return {
        'precision': round(precision, 3),
        'recall': round(recall, 3),
        'f1_score': round(f1, 3),
        'ctr': round(clicked / total * 100, 2) if total > 0 else 0
    }


def calculate_diversity_score(recommendations):
    """计算推荐多样性 - 适配Recommendation模型"""
    if not recommendations:
        return 0.65

    # 简化计算：基于推荐物品的多样性
    recommended_items = set()
    for rec in recommendations:
        item_id = getattr(rec, 'item_id', None)
        if item_id:
            recommended_items.add(item_id)

    total_items = len(set([rec.item_id for rec in recommendations if hasattr(rec, 'item_id')]))
    return round(len(recommended_items) / total_items, 2) if total_items > 0 else 0.65


def calculate_novelty_score(recommendations):
    """计算新颖性 - 适配Recommendation模型"""
    # 简化计算
    return 0.72


def calculate_serendipity_score(recommendations):
    """计算惊喜度 - 适配Recommendation模型"""
    # 简化计算
    return 0.68


def calculate_avg_order_value(recommendations):
    """计算平均订单价值 - 适配Recommendation模型"""
    # 如果有订单金额字段
    total_value = sum([getattr(rec, 'order_value', 0) for rec in recommendations])
    return round(total_value / len(recommendations), 2) if recommendations else 256.50


def calculate_revenue_per_recommendation(recommendations):
     """计算每次推荐产生的收入 - 适配Recommendation模型"""
     total_revenue = sum([getattr(rec, 'revenue', 0) for rec in recommendations])
     return round(total_revenue / len(recommendations), 2) if recommendations else 10.75


def calculate_weighted_average(model_stats, metric_name):
    """计算加权平均值"""
    if not model_stats:
        return 0

    total_weight = 0
    weighted_sum = 0

    for model, stats in model_stats.items():
        weight = stats.get('ctr', 0)  # 使用CTR作为权重
        value = stats.get(metric_name, 0)
        weighted_sum += weight * value
        total_weight += weight

    return round(weighted_sum / total_weight, 3) if total_weight > 0 else 0


def calculate_coverage(model_stats):
    """计算模型覆盖率"""
    if not model_stats:
        return 0.65

    # 模拟计算覆盖率
    # 实际应根据推荐物品的多样性计算
    coverage_scores = []
    for model, stats in model_stats.items():
        # 不同模型的覆盖率权重
        if model == 'cf_user':
            coverage_scores.append(0.7)
        elif model == 'cf_item':
            coverage_scores.append(0.8)
        elif model == 'content':
            coverage_scores.append(0.9)
        elif model == 'hybrid':
            coverage_scores.append(0.85)
        elif model == 'deepfm':
            coverage_scores.append(0.6)

    return round(sum(coverage_scores) / len(coverage_scores), 2) if coverage_scores else 0.65


def generate_pr_points(precision, recall, num_points=10):
    """生成PR曲线数据点"""
    points = []
    for i in range(num_points + 1):
        r = i / num_points
        p = precision * (recall / (r + 0.1))  # 简化计算
        points.append([round(r, 2), round(max(0, min(1, p)), 3)])
    return points


def generate_roc_points(auc, num_points=10):
    """生成ROC曲线数据点"""
    points = []
    for i in range(num_points + 1):
        fpr = i / num_points
        tpr = auc * fpr + (1 - auc) * (fpr ** 2)  # 简化计算
        points.append([round(fpr, 2), round(max(0, min(1, tpr)), 3)])
    return points


# 默认数据函数
def get_default_performance_stats():
    """获取默认性能统计数据"""
    return {
        'best_model': 'DeepFM',
        'best_f1': 0.78,
        'avg_precision': 0.72,
        'precision_change': 1.2,
        'coverage': 0.65,
        'response_time': 150,
        'ctr': 8.5,
        'conversion_rate': 4.2,
        'avg_order_value': 256.50,
        'revenue_per_recommendation': 10.75
    }


def get_default_chart_data():
    """获取默认图表数据"""
    return {
        'model_comparison': prepare_model_comparison_data([]),
        'pr_curve': prepare_pr_curve_data([]),
        'roc_curve': prepare_roc_curve_data([]),
        'ctr_distribution': {'data': [120, 200, 150, 80, 70, 40]},
        'conversion_analysis': {'data': [8.5, 6.2, 7.8, 9.1, 5.4, 4.2]}
    }


def get_default_suggestions():
    """获取默认优化建议"""
    return [
        {
            'title': '优化新用户推荐',
            'description': '新用户点击率低于平均水平，建议增加热门商品和探索性推荐',
            'priority': 'high',
            'icon': 'exclamation-circle'
        },
        {
            'title': '提升模型多样性',
            'description': '当前推荐多样性较低，建议增加内容推荐的比例',
            'priority': 'medium',
            'icon': 'chart-line'
        },
        {
            'title': '优化模型更新频率',
            'description': '考虑增加实时模型更新，提升推荐时效性',
            'priority': 'low',
            'icon': 'sync-alt'
        }
    ]


def get_default_model_performance():
    """获取默认模型性能数据"""
    return {
        'best_model': '混合推荐',
        'best_f1': 0.78,
        'avg_precision': 0.72,
        'precision_change': 1.2,
        'coverage': 0.65,
        'response_time': 150,
        'comparison': {
            'cf_user': {'precision': 0.68, 'recall': 0.72, 'f1_score': 0.70, 'ctr': 8.2},
            'cf_item': {'precision': 0.65, 'recall': 0.70, 'f1_score': 0.68, 'ctr': 7.8},
            'content': {'precision': 0.60, 'recall': 0.65, 'f1_score': 0.62, 'ctr': 6.5},
            'hybrid': {'precision': 0.72, 'recall': 0.75, 'f1_score': 0.73, 'ctr': 8.5},
            'deepfm': {'precision': 0.78, 'recall': 0.80, 'f1_score': 0.79, 'ctr': 9.2}
        }
    }

# ========== 系统设置视图函数 ==========
@app.route('/system_settings')
@login_required
def system_settings():
    """系统设置页面"""
    return render_template('system_settings.html')

# ========== 帮助文档视图函数 ==========
@app.route('/help')
@login_required
def help():
    """帮助文档页面"""
    return render_template('help.html')

# ========== 关于页面视图函数 ==========
@app.route('/about')
@login_required
def about():
    """关于页面"""
    return render_template('about.html')

# ========== 联系我们视图函数 ==========
@app.route('/contact')
@login_required
def contact():
    """联系我们页面"""
    return render_template('contact.html')

# ========== 隐私政策视图函数 ==========
@app.route('/privacy')
@login_required
def privacy():
    """隐私政策页面"""
    return render_template('privacy.html')


# ========== 退出登录 ==========
@app.route('/logout', methods=['GET', 'POST'])
@login_required
def logout():
    logout_user()
    flash('您已成功退出登录。', 'success')
    return redirect(url_for('login'))



# ========== 核心数据分析 API（全部来自 data_engine）==========

@app.route('/api/dashboard/stats')
@login_required
def api_dashboard_stats():
    """数据看板 — 全量统计"""
    days = int(request.args.get('days', 30))
    try:
        print(f"[API] dashboard/stats called with days={days}")
        data = de.get_dashboard_stats(days)
        print(f"[API] dashboard/stats returned: {data}")
        return jsonify({'success': True, 'data': data, 'days': days})
    except Exception as e:
        print(f"[ERROR] dashboard/stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/debug/db_status')
@login_required
def api_debug_db_status():
    """调试端点：返回数据库中的记录总数及时间范围，用于验证数据是否入库"""
    try:
        total = UserBehavior.query.count()
        max_ts = db.session.query(func.max(UserBehavior.timestamp)).scalar()
        min_ts = db.session.query(func.min(UserBehavior.timestamp)).scalar()
        from datetime import datetime as _dt
        return jsonify({
            'total_records': total,
            'min_time': _dt.fromtimestamp(int(min_ts)).strftime('%Y-%m-%d %H:%M:%S') if min_ts else None,
            'max_time': _dt.fromtimestamp(int(max_ts)).strftime('%Y-%m-%d %H:%M:%S') if max_ts else None,
            'server_now': _dt.now().strftime('%Y-%m-%d %H:%M:%S'),
        })
    except Exception as ex:
        return jsonify({'error': str(ex)})


@app.route('/api/behavior/stats')
@login_required
def api_behavior_stats():
    """行为分析中心 — 全量统计"""
    days = int(request.args.get('days', 30))
    try:
        data = de.get_behavior_stats(days)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/item/stats')
@login_required
def api_item_stats():
    """商品分析 — 全量统计"""
    days     = int(request.args.get('days', 30))
    category = request.args.get('category', 'all')
    sort_by  = request.args.get('sort_by', 'purchases')
    try:
        data = de.get_item_stats(days, category, sort_by)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/rfm/stats')
@login_required
def api_rfm_stats():
    """RFM分析 — 全量统计"""
    days = int(request.args.get('days', 90))
    try:
        data = de.get_rfm_data(days)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/user/<int:user_id>/profile')
@login_required
def api_user_profile(user_id):
    """用户画像详情"""
    try:
        info = de.get_user_info(user_id)
        if info:
            return jsonify({'success': True, 'data': info})
        return jsonify({'success': False, 'error': '未找到该用户数据'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/export/report')
@login_required
def api_export_report():
    """生成并返回报告数据（CSV/JSON）"""
    days   = int(request.args.get('days', 30))
    fmt    = request.args.get('format', 'csv')
    module = request.args.get('module', 'dashboard')
    try:
        if module == 'dashboard':
            data = de.get_dashboard_stats(days)
        elif module == 'behavior':
            data = de.get_behavior_stats(days)
        elif module == 'item':
            data = de.get_item_stats(days)
        elif module == 'rfm':
            raw = de.get_rfm_data(days)
            data = {'segments': raw['segments'], 'total_users': raw['total_users']}
        else:
            data = de.get_dashboard_stats(days)

        if fmt == 'json':
            content = json.dumps(data, ensure_ascii=False, indent=2)
            return jsonify({'success': True, 'data': content,
                            'filename': f'{module}_report_{datetime.now().strftime("%Y%m%d")}.json'})
        else:
            # 对 top_items / segments 等列表做 CSV
            rows = data.get('top_items') or data.get('segments') or [data]
            df = pd.DataFrame(rows)
            content = df.to_csv(index=False, encoding='utf-8-sig')
            return jsonify({'success': True, 'data': content,
                            'filename': f'{module}_report_{datetime.now().strftime("%Y%m%d")}.csv'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ========== 智能推荐同步 API ==========
@app.route('/api/recommendation/sync')
@login_required
def api_recommendation_sync():
    """从各分析模块读取最新数据，生成运营建议"""
    days = int(request.args.get('days', 30))
    try:
        result = de.get_recommendation_insights(days)
        return jsonify({'success': True, **result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ========== 商品/用户分析 AJAX API ==========
@app.route('/api/item/<int:item_id>/analysis')
@login_required
def api_item_analysis(item_id):
    """单商品详情 AJAX 接口"""
    try:
        detail = _build_item_detail(item_id)
        if detail:
            return jsonify({'success': True, 'data': detail})
        return jsonify({'success': False, 'error': '未找到该商品数据'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/item/filter', methods=['POST'])
@login_required
def api_item_filter():
    """商品列表筛选 AJAX 接口"""
    try:
        params = request.get_json() or {}
        days     = int(params.get('days', 30))
        category = params.get('category', 'all')
        sort_by  = params.get('sort_by', 'purchases')

        all_items = ItemProfile.query.all()
        total_items = len(all_items)
        avg_views = round(sum(it.total_views for it in all_items) / total_items, 1) if total_items else 1

        sort_col = ItemProfile.total_purchases if sort_by == 'purchases' else \
                   ItemProfile.total_views if sort_by == 'views' else \
                   ItemProfile.conversion_rate
        q = ItemProfile.query
        if category != 'all':
            try:
                q = q.filter_by(category_id=int(category))
            except Exception:
                pass
        top_profiles = q.order_by(sort_col.desc()).limit(20).all()
        items = []
        for it in top_profiles:
            conversion = round(it.conversion_rate * 100, 1) if it.conversion_rate <= 1 else round(it.conversion_rate, 1)
            items.append({
                'item_id': it.item_id,
                'category_id': it.category_id,
                'view_count': it.total_views,
                'cart_count': 0,
                'fav_count': 0,
                'purchase_count': it.total_purchases,
                'conversion_rate': conversion,
                'heat_level': min(10, int(it.total_views / max(avg_views, 1) * 5)),
            })
        return jsonify({'success': True, 'data': items})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/user/<int:user_id>/analysis')
@login_required
def api_user_analysis(user_id):
    """单用户画像 AJAX 接口"""
    try:
        user_info = _build_user_info(user_id)
        if user_info:
            return jsonify({'success': True, 'data': user_info})
        return jsonify({'success': False, 'error': '未找到该用户数据'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ========== API接口 ==========
@app.route('/api/status')
def api_status():
    return jsonify({
        'status': 'success',
        'message': '系统运行正常',
        'version': '1.0.0'
    })


@app.route('/api/analysis/date_range', methods=['POST'])
@login_required
def api_analysis_date_range():
    """根据日期范围获取分析数据"""
    try:
        data = request.get_json()
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        analysis_type = data.get('analysis_type', 'overview')
        
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        
        behaviors = UserBehavior.query.filter(
            UserBehavior.behavior_datetime.between(start_date, end_date)
        ).all()
        
        user_profiles = UserProfile.query.all()
        item_profiles = ItemProfile.query.all()
        
        result = {}
        
        if analysis_type == 'overview':
            result = {
                'total_users': len(set([b.user_id for b in behaviors])),
                'total_items': len(set([b.item_id for b in behaviors])),
                'total_behaviors': len(behaviors),
                'behavior_counts': {
                    'pv': len([b for b in behaviors if b.behavior_type == 'pv']),
                    'cart': len([b for b in behaviors if b.behavior_type == 'cart']),
                    'fav': len([b for b in behaviors if b.behavior_type == 'fav']),
                    'buy': len([b for b in behaviors if b.behavior_type == 'buy'])
                },
                'conversion_rate': calculate_conversion_rate(behaviors),
                'period': f"{start_date_str} 至 {end_date_str}"
            }
        elif analysis_type == 'funnel':
            result = analyze_conversion_funnel(behaviors, start_date, end_date)
        elif analysis_type == 'user':
            result = analyze_user_behavior(behaviors, user_profiles)
        elif analysis_type == 'category':
            result = analyze_category_performance(behaviors, item_profiles)
        elif analysis_type == 'time_pattern':
            result = analyze_time_patterns(behaviors, start_date, end_date)
        
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


@app.route('/api/export/analysis', methods=['POST'])
@login_required
def api_export_analysis():
    """导出分析结果"""
    try:
        data = request.get_json()
        export_type = data.get('export_type', 'csv')
        analysis_data = data.get('analysis_data', {})
        
        if export_type == 'csv':
            df = pd.DataFrame(analysis_data)
            csv_data = df.to_csv(index=False)
            
            return jsonify({
                'success': True,
                'data': csv_data,
                'filename': f'analysis_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            })
        elif export_type == 'json':
            return jsonify({
                'success': True,
                'data': analysis_data,
                'filename': f'analysis_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            })
        else:
            return jsonify({
                'success': False,
                'error': '不支持的导出格式'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


@app.route('/api/upload/validate', methods=['POST'])
@login_required
def api_validate_upload():
    """验证上传的数据文件"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': '没有上传文件'
            })
        
        upload_file = request.files['file']
        
        if upload_file.filename == '':
            return jsonify({
                'success': False,
                'error': '文件名为空'
            })
        
        if not upload_file.filename.lower().endswith('.csv'):
            return jsonify({
                'success': False,
                'error': '只支持CSV格式文件'
            })
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
            upload_file.save(tmp_file.name)
            tmp_file_path = tmp_file.name
        
        try:
            df = pd.read_csv(tmp_file_path)
            
            required_columns = ['user_id', 'item_id', 'category_id', 'behavior_type', 'timestamp']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return jsonify({
                    'success': False,
                    'error': f'缺少必要的列: {", ".join(missing_columns)}'
                })
            
            valid_behaviors = ['pv', 'cart', 'fav', 'buy']
            invalid_behaviors = df[~df['behavior_type'].isin(valid_behaviors)]['behavior_type'].unique()
            
            if len(invalid_behaviors) > 0:
                return jsonify({
                    'success': False,
                    'error': f'无效的行为类型: {", ".join(map(str, invalid_behaviors))}'
                })
            
            preview_data = df.head(10).to_dict('records')
            
            return jsonify({
                'success': True,
                'message': '文件验证成功',
                'preview': preview_data,
                'total_records': len(df),
                'columns': list(df.columns)
            })
        finally:
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


if __name__ == '__main__':
    app.run(debug=True)
