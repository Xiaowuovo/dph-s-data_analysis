# -*- coding: utf-8 -*-
"""
data_engine.py
全局数据分析引擎 —— 以 SQL 聚合为主，适配 UserBehavior_2025.csv 格式。
所有分析模块（数据看板、行为分析、商品分析、RFM、用户画像、智能推荐）
均从本模块取数据，保证一次查询、全局共享。
"""
from datetime import datetime, timedelta, date
from collections import defaultdict

from sqlalchemy import func, desc, case, distinct, text

from core import db
from core.models import UserBehavior, Order, UserAccount, UploadHistory
from sqlalchemy import Table, MetaData


# ══════════════════════════════════════════════════════════════════
#  动态数据源加载（支持独立表 + 相对时间基准）
# ══════════════════════════════════════════════════════════════════

def _get_active_table():
    """获取当前激活数据源的表对象 + 元信息"""
    ds = UploadHistory.query.filter_by(is_active=True, status='success').first()
    if not ds or not ds.table_name:
        return None, None
    
    metadata = MetaData()
    try:
        table = Table(ds.table_name, metadata, autoload_with=db.engine)
        return table, ds
    except Exception:
        return None, None


def _get_time_column(table, data_type: str):
    """根据数据类型返回时间列名"""
    cols = {c.name for c in table.columns}
    if data_type == 'order':
        for c in ('order_time', 'create_time', 'created_at'):
            if c in cols: return c
    elif data_type == 'behavior':
        # behavior_datetime 是 Unix 时间戳转换后的列，优先
        if 'behavior_datetime' in cols: return 'behavior_datetime'
        if 'timestamp' in cols: return 'timestamp'
    # user / 其他
    for c in ('register_time', 'created_at', 'behavior_datetime', 'order_time'):
        if c in cols: return c
    return None


def _relative_time_range(days: int, max_time: datetime):
    """基于数据最大时间计算相对时间范围（解决静态数据的"今日"问题）
    days=0  → 全量
    days>0  → [max_time - days, max_time]
    """
    if days == 0 or not max_time:
        return None, None  # 全量
    start_dt = max_time - timedelta(days=days)
    return start_dt, max_time


def check_field_availability(required_fields: list) -> dict:
    """检查当前数据源是否包含必需字段，返回 {field: available}"""
    table, ds = _get_active_table()
    if table is None or ds is None:
        return {f: False for f in required_fields}
    
    import json
    available = set(json.loads(ds.available_fields) if ds.available_fields else [])
    return {f: (f in available) for f in required_fields}


# ──────────────────────────────────────────────
# 工具（旧版，保留兼容）
# ──────────────────────────────────────────────
def _ts_range(days: int):
    """返回 (start_ts, end_ts) Unix 整数秒。
    days=0  → 全量（DB 实际 min~max）；
    days>0  → 以 DB 最新记录为基准往前推 days 天；
    若计算出的范围内无数据，自动回退到全量范围，确保历史 CSV 也能正确显示。
    """
    try:
        max_ts = db.session.query(func.max(UserBehavior.timestamp)).scalar()
        min_ts = db.session.query(func.min(UserBehavior.timestamp)).scalar()
    except Exception:
        max_ts = min_ts = None

    # 全量模式 或 库空
    if days == 0 or not max_ts or not min_ts:
        if max_ts and min_ts:
            return int(min_ts), int(max_ts)
        return 0, int(datetime.now().timestamp())

    end_dt   = datetime.fromtimestamp(int(max_ts))
    start_dt = end_dt - timedelta(days=days)
    s, e     = int(start_dt.timestamp()), int(end_dt.timestamp())

    # 校验：若范围内无数据则回退到全量（防止 days 设置过小遗漏数据）
    try:
        in_range = db.session.query(
            func.count(UserBehavior.id)
        ).filter(UserBehavior.timestamp.between(s, e)).scalar() or 0
    except Exception:
        in_range = 0

    if in_range == 0:
        return int(min_ts), int(max_ts)
    return s, e


def _q_base(days: int):
    """返回按时间过滤的基础查询对象"""
    s, e = _ts_range(days)
    return UserBehavior.query.filter(UserBehavior.timestamp.between(s, e))


# ──────────────────────────────────────────────
# 1. 数据看板 / 总览
# ──────────────────────────────────────────────
def get_dynamic_dashboard_stats(days: int = 0) -> dict:
    """新版看板统计：基于动态数据源 + 相对时间基准"""
    table, ds = _get_active_table()
    if table is None or ds is None:
        return {'error': '暂无激活数据源', 'empty': True, **_empty_dashboard()}
    
    # 获取时间列
    time_col_name = _get_time_column(table, ds.data_type)
    if not time_col_name:
        # 无时间列，返回全量统计
        total = db.session.query(func.count()).select_from(table).scalar() or 0
        return {
            'total_records': total,
            'data_type': ds.data_type,
            'time_range': '全量数据（无时间字段）',
            **_empty_dashboard()
        }
    
    # 计算相对时间范围
    start_dt, end_dt = _relative_time_range(days, ds.max_time)
    time_col = table.c[time_col_name]
    
    # 构建查询
    if start_dt and end_dt:
        base_filter = time_col.between(start_dt, end_dt)
        time_label = f"{start_dt.strftime('%Y-%m-%d')} ~ {end_dt.strftime('%Y-%m-%d')}"
    else:
        base_filter = text('1=1')  # 全量
        time_label = f"{ds.min_time.strftime('%Y-%m-%d') if ds.min_time else '?'} ~ {ds.max_time.strftime('%Y-%m-%d') if ds.max_time else '?'}"
    
    total = db.session.query(func.count()).select_from(table).filter(base_filter).scalar() or 0
    
    if total == 0:
        return {'total_records': 0, 'data_type': ds.data_type, 'time_range': time_label, **_empty_dashboard()}
    
    # 根据数据类型返回不同统计
    if ds.data_type == 'order':
        return _stats_for_order_table(table, base_filter, total, time_label, ds)
    elif ds.data_type == 'behavior':
        return _stats_for_behavior_table(table, base_filter, total, time_label, ds)
    elif ds.data_type == 'user':
        return _stats_for_user_table(table, base_filter, total, time_label, ds)
    else:
        return {'total_records': total, 'data_type': ds.data_type, 'time_range': time_label, **_empty_dashboard()}


def _stats_for_order_table(table, base_filter, total, time_label, ds):
    """订单表专属统计"""
    cols = {c.name for c in table.columns}
    stats = {'total_records': total, 'total_behaviors': total,
             'data_type': 'order', 'time_range': time_label}
    
    # 基础指标
    if 'user_id' in cols:
        stats['total_users'] = db.session.query(
            func.count(distinct(table.c.user_id))).filter(base_filter).scalar() or 0
    prod_col = 'product_id' if 'product_id' in cols else ('item_id' if 'item_id' in cols else None)
    if prod_col:
        stats['total_items'] = db.session.query(
            func.count(distinct(table.c[prod_col]))).filter(base_filter).scalar() or 0
    if 'amount' in cols:
        stats['total_revenue'] = round(
            db.session.query(func.sum(table.c.amount)).filter(base_filter).scalar() or 0, 2)
        stats['avg_order_value'] = round(stats['total_revenue'] / total, 2) if total else 0
    
    # 成交订单数 = 总订单数（订单表每行就是一笔订单）
    stats['buy'] = total
    # 订单表无 pv/cart/fav 概念，用订单数代替 pv 供转化率计算
    stats['pv'] = total
    stats['conversion_rate'] = 100.0  # 订单数据全部是购买行为
    
    # 订单状态分布
    if 'order_status' in cols:
        status_q = db.session.query(
            table.c.order_status, func.count().label('cnt')
        ).filter(base_filter).group_by(table.c.order_status).all()
        stats['status_dist'] = [{'name': r[0], 'value': r[1]} for r in status_q if r[0]]
    
    # 日趋势（按订单时间分组）
    time_col_name = 'order_time'
    if time_col_name in cols:
        try:
            day_q = db.session.query(
                func.date(table.c[time_col_name]).label('day'),
                func.count().label('cnt'),
                func.sum(table.c.amount).label('rev') if 'amount' in cols else func.count().label('rev')
            ).filter(base_filter).group_by(
                func.date(table.c[time_col_name])
            ).order_by(func.date(table.c[time_col_name])).all()
            
            dates = [str(r.day)[:10] for r in day_q if r.day][-60:]
            cnts  = [r.cnt for r in day_q if r.day][-60:]
            stats['daily_trend'] = {
                'dates': dates,
                'pv':   cnts,
                'cart': [0]*len(dates),
                'fav':  [0]*len(dates),
                'buy':  cnts,
            }
        except Exception as _e:
            print(f'[WARN] order daily_trend: {_e}')
    
    # Top10 商品（按订单数）
    if prod_col:
        name_col = 'product_name' if 'product_name' in cols else None
        try:
            top_q = db.session.query(
                table.c[prod_col].label('pid'),
                func.count().label('cnt')
            ).filter(base_filter).group_by(table.c[prod_col]
            ).order_by(func.count().desc()).limit(10).all()
            
            # 尝试获取商品名
            if name_col:
                top_q2 = db.session.query(
                    table.c[prod_col].label('pid'),
                    table.c[name_col].label('name'),
                    func.count().label('cnt')
                ).filter(base_filter).group_by(table.c[prod_col], table.c[name_col]
                ).order_by(func.count().desc()).limit(10).all()
                stats['top_items'] = [{'id': r.pid, 'name': r.name or str(r.pid), 'buy_cnt': r.cnt} for r in top_q2]
            else:
                stats['top_items'] = [{'id': r.pid, 'name': str(r.pid), 'buy_cnt': r.cnt} for r in top_q]
        except Exception as _e:
            print(f'[WARN] top_items: {_e}')
    
    # Top10 活跃用户
    if 'user_id' in cols:
        try:
            top_u = db.session.query(
                table.c.user_id.label('user_id'),
                func.count().label('action_cnt')
            ).filter(base_filter).group_by(table.c.user_id
            ).order_by(func.count().desc()).limit(10).all()
            stats['top_users'] = [{'user_id': r.user_id, 'action_cnt': r.action_cnt} for r in top_u]
        except Exception as _e:
            print(f'[WARN] top_users: {_e}')
    
    # 分类分布
    cat_col = 'category' if 'category' in cols else ('category_name' if 'category_name' in cols else None)
    if cat_col:
        try:
            cat_q = db.session.query(
                table.c[cat_col].label('cat'), func.count().label('cnt')
            ).filter(base_filter).group_by(table.c[cat_col]
            ).order_by(func.count().desc()).limit(10).all()
            stats['category_dist'] = [{'name': r.cat, 'value': r.cnt} for r in cat_q if r.cat]
        except Exception as _e:
            print(f'[WARN] category_dist: {_e}')
    
    return {**_empty_dashboard(), **stats}


def _stats_for_behavior_table(table, base_filter, total, time_label, ds):
    """行为表专属统计"""
    cols = {c.name for c in table.columns}
    
    stats = {'total_records': total, 'total_behaviors': total,
             'data_type': 'behavior', 'time_range': time_label}
    
    if 'user_id' in cols:
        stats['total_users'] = db.session.query(func.count(distinct(table.c.user_id))).filter(base_filter).scalar() or 0
    if 'item_id' in cols:
        stats['total_items'] = db.session.query(func.count(distinct(table.c.item_id))).filter(base_filter).scalar() or 0
    
    # 行为类型分布
    if 'behavior_type' in cols:
        beh_q = db.session.query(table.c.behavior_type, func.count().label('cnt')).filter(base_filter).group_by(table.c.behavior_type).all()
        beh_map = {r[0]: r[1] for r in beh_q if r[0]}
        stats['pv']   = beh_map.get('pv', 0)
        stats['cart'] = beh_map.get('cart', 0)
        stats['fav']  = beh_map.get('fav', 0)
        stats['buy']  = beh_map.get('buy', 0)
        stats['conversion_rate'] = round(stats['buy'] / stats['pv'] * 100, 2) if stats.get('pv') else 0
    
    # 收入（购买行为的售价求和）
    price_col = 'price' if 'price' in cols else None
    if price_col and 'behavior_type' in cols:
        revenue = db.session.query(func.sum(table.c[price_col])).filter(
            base_filter, table.c.behavior_type == 'buy').scalar() or 0
        stats['total_revenue'] = round(float(revenue), 2)
    
    # 日趋势（计算 behavior_datetime 列的每日各行为数）
    time_col_name = 'behavior_datetime' if 'behavior_datetime' in cols else None
    if time_col_name and 'behavior_type' in cols:
        try:
            day_q = db.session.query(
                func.date(table.c[time_col_name]).label('day'),
                table.c.behavior_type,
                func.count().label('cnt')
            ).filter(base_filter).group_by(
                func.date(table.c[time_col_name]), table.c.behavior_type
            ).order_by(func.date(table.c[time_col_name])).all()
            
            from collections import defaultdict
            day_map = defaultdict(lambda: {'pv':0,'cart':0,'fav':0,'buy':0})
            for row in day_q:
                d_str = str(row.day)[:10] if row.day else ''
                bt = row.behavior_type or ''
                if d_str and bt in ('pv','cart','fav','buy'):
                    day_map[d_str][bt] += row.cnt
            
            dates = sorted(day_map.keys())[-30:]  # 最近30天
            stats['daily_trend'] = {
                'dates': dates,
                'pv':   [day_map[d]['pv']   for d in dates],
                'cart': [day_map[d]['cart'] for d in dates],
                'fav':  [day_map[d]['fav']  for d in dates],
                'buy':  [day_map[d]['buy']  for d in dates],
            }
        except Exception as _e:
            print(f'[WARN] daily_trend error: {_e}')
    
    return {**_empty_dashboard(), **stats}


def _stats_for_user_table(table, base_filter, total, time_label, ds):
    """用户表专属统计"""
    cols = {c.name for c in table.columns}
    stats = {'total_records': total, 'total_users': total,
             'data_type': 'user', 'time_range': time_label}

    # 性别分布
    if 'gender' in cols:
        try:
            g_q = db.session.query(table.c.gender, func.count().label('cnt')).filter(
                base_filter).group_by(table.c.gender).all()
            stats['gender_dist'] = [{'name': r[0] or 'Unknown', 'value': r[1]} for r in g_q]
        except Exception as _e:
            print(f'[WARN] gender_dist: {_e}')

    # 总购买次数 / 总金额
    if 'total_purchase_times' in cols:
        try:
            stats['buy'] = int(db.session.query(
                func.sum(table.c.total_purchase_times)).filter(base_filter).scalar() or 0)
        except Exception as _e:
            print(f'[WARN] buy sum: {_e}')
    if 'total_purchase_amount' in cols:
        try:
            stats['total_revenue'] = round(float(db.session.query(
                func.sum(table.c.total_purchase_amount)).filter(base_filter).scalar() or 0), 2)
        except Exception as _e:
            print(f'[WARN] revenue sum: {_e}')

    # 注册时间趋势
    time_col_name = 'register_time'
    if time_col_name in cols:
        try:
            day_q = db.session.query(
                func.date(table.c[time_col_name]).label('day'),
                func.count().label('cnt')
            ).filter(base_filter).group_by(
                func.date(table.c[time_col_name])
            ).order_by(func.date(table.c[time_col_name])).all()
            dates = [str(r.day)[:10] for r in day_q if r.day][-60:]
            cnts  = [r.cnt for r in day_q if r.day][-60:]
            stats['daily_trend'] = {
                'dates': dates,
                'pv':   cnts,
                'cart': [0]*len(dates),
                'fav':  [0]*len(dates),
                'buy':  cnts,
            }
        except Exception as _e:
            print(f'[WARN] user daily_trend: {_e}')

    return {**_empty_dashboard(), **stats}


def get_dashboard_stats(days: int = 30) -> dict:
    # 优先使用动态数据源
    table, ds = _get_active_table()
    if table is not None and ds is not None:
        return get_dynamic_dashboard_stats(days)
    
    # 降级到旧逻辑
    if has_order_data():
        return get_order_dashboard_stats(days)
    s, e = _ts_range(days)
    q = UserBehavior.query.filter(UserBehavior.timestamp.between(s, e))

    # 行为总计
    total = q.count()
    if total == 0:
        # 时间窗口内无数据 → 自动扩展到全量
        all_count = UserBehavior.query.count()
        if all_count == 0:
            return _empty_dashboard()
        min_ts = db.session.query(func.min(UserBehavior.timestamp)).scalar()
        max_ts = db.session.query(func.max(UserBehavior.timestamp)).scalar()
        s, e = int(min_ts), int(max_ts)
        q = UserBehavior.query.filter(UserBehavior.timestamp.between(s, e))
        total = q.count()

    # 按行为类型聚合
    counts_q = db.session.query(
        UserBehavior.behavior_type,
        func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e)
    ).group_by(UserBehavior.behavior_type).all()
    counts = {r.behavior_type: r.cnt for r in counts_q}
    pv   = counts.get('pv',   0)
    cart = counts.get('cart', 0)
    fav  = counts.get('fav',  0)
    buy  = counts.get('buy',  0)

    # 用户/商品去重
    total_users = db.session.query(
        func.count(distinct(UserBehavior.user_id))
    ).filter(UserBehavior.timestamp.between(s, e)).scalar() or 0

    total_items = db.session.query(
        func.count(distinct(UserBehavior.item_id))
    ).filter(UserBehavior.timestamp.between(s, e)).scalar() or 0

    # 总销售额
    total_revenue = db.session.query(
        func.sum(UserBehavior.price)
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy').scalar() or 0.0

    # 转化率
    conv_rate = round(buy / pv * 100, 2) if pv else 0

    # 日趋势（按 date 字段聚合）
    daily_q = db.session.query(
        UserBehavior.date,
        UserBehavior.behavior_type,
        func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.date != None
    ).group_by(UserBehavior.date, UserBehavior.behavior_type
    ).order_by(UserBehavior.date).all()

    daily_map = defaultdict(lambda: defaultdict(int))
    for row in daily_q:
        if row.date:
            daily_map[row.date.strftime('%m-%d')][row.behavior_type] += row.cnt

    dates_sorted = sorted(daily_map.keys())
    daily_trend = {
        'dates': dates_sorted,
        'pv':    [daily_map[d]['pv']   for d in dates_sorted],
        'cart':  [daily_map[d]['cart'] for d in dates_sorted],
        'fav':   [daily_map[d]['fav']  for d in dates_sorted],
        'buy':   [daily_map[d]['buy']  for d in dates_sorted],
    }

    # Top10 商品（购买量）
    top_items_q = db.session.query(
        UserBehavior.item_id,
        UserBehavior.product_name,
        func.count().label('buy_cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy'
    ).group_by(UserBehavior.item_id, UserBehavior.product_name
    ).order_by(desc('buy_cnt')).limit(10).all()
    top_items = [
        {'item_id': r.item_id,
         'name': r.product_name or f'商品{r.item_id}',
         'buy_cnt': r.buy_cnt}
        for r in top_items_q
    ]

    # Top10 活跃用户
    top_users_q = db.session.query(
        UserBehavior.user_id,
        func.count().label('action_cnt')
    ).filter(UserBehavior.timestamp.between(s, e)
    ).group_by(UserBehavior.user_id
    ).order_by(desc('action_cnt')).limit(10).all()
    top_users = [{'user_id': r.user_id, 'action_cnt': r.action_cnt} for r in top_users_q]

    # 品类分布（购买）
    cat_q = db.session.query(
        UserBehavior.category_name,
        func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy',
             UserBehavior.category_name != None
    ).group_by(UserBehavior.category_name
    ).order_by(desc('cnt')).limit(8).all()
    category_dist = [{'name': r.category_name, 'value': r.cnt} for r in cat_q]

    return {
        'total_users': total_users,
        'total_items': total_items,
        'total_behaviors': total,
        'pv': pv, 'cart': cart, 'fav': fav, 'buy': buy,
        'conversion_rate': conv_rate,
        'total_revenue': round(total_revenue, 2),
        'daily_trend': daily_trend,
        'top_items': top_items,
        'top_users': top_users,
        'category_dist': category_dist,
    }


def _empty_dashboard():
    return {
        'total_users': 0, 'total_items': 0, 'total_behaviors': 0,
        'pv': 0, 'cart': 0, 'fav': 0, 'buy': 0,
        'conversion_rate': 0, 'total_revenue': 0,
        'daily_trend': {'dates': [], 'pv': [], 'cart': [], 'fav': [], 'buy': []},
        'top_items': [], 'top_users': [], 'category_dist': [],
    }


# ──────────────────────────────────────────────
# 2. 行为分析中心
# ──────────────────────────────────────────────
def get_behavior_stats(days: int = 30) -> dict:
    if has_order_data():
        return get_order_behavior_stats(days)
    s, e = _ts_range(days)  # 已内置全量回退

    # 小时分布
    hour_q = db.session.query(
        UserBehavior.hour,
        UserBehavior.behavior_type,
        func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.hour != None
    ).group_by(UserBehavior.hour, UserBehavior.behavior_type).all()

    hour_map = defaultdict(lambda: defaultdict(int))
    for row in hour_q:
        hour_map[row.hour][row.behavior_type] += row.cnt
    hours = list(range(24))
    hourly = {
        'hours': hours,
        'pv':    [hour_map[h]['pv']   for h in hours],
        'cart':  [hour_map[h]['cart'] for h in hours],
        'fav':   [hour_map[h]['fav']  for h in hours],
        'buy':   [hour_map[h]['buy']  for h in hours],
    }

    # 日趋势
    daily_q = db.session.query(
        UserBehavior.date,
        func.count().label('total'),
        func.sum(case((UserBehavior.behavior_type == 'buy', 1), else_=0)).label('buy_cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.date != None
    ).group_by(UserBehavior.date).order_by(UserBehavior.date).all()

    daily_trend = {
        'dates':  [r.date.strftime('%m-%d') if r.date else '' for r in daily_q],
        'total':  [r.total for r in daily_q],
        'buy':    [r.buy_cnt for r in daily_q],
    }

    # 行为分布
    counts_q = db.session.query(
        UserBehavior.behavior_type,
        func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e)
    ).group_by(UserBehavior.behavior_type).all()
    behavior_dist = {r.behavior_type: r.cnt for r in counts_q}
    total = sum(behavior_dist.values()) or 1

    # 用户行为频次分布（按用户聚合）
    user_freq_q = db.session.query(
        func.count().label('actions')
    ).filter(UserBehavior.timestamp.between(s, e)
    ).group_by(UserBehavior.user_id).all()
    actions_list = [r.actions for r in user_freq_q]
    high = sum(1 for x in actions_list if x >= 50)
    medium = sum(1 for x in actions_list if 10 <= x < 50)
    low = sum(1 for x in actions_list if x < 10)

    return {
        'hourly': hourly,
        'daily_trend': daily_trend,
        'behavior_dist': behavior_dist,
        'behavior_pct': {k: round(v / total * 100, 1) for k, v in behavior_dist.items()},
        'user_activity': {'high': high, 'medium': medium, 'low': low},
        'conversion_funnel': [
            {'name': '浏览(PV)', 'value': behavior_dist.get('pv', 0)},
            {'name': '加购',     'value': behavior_dist.get('cart', 0)},
            {'name': '收藏',     'value': behavior_dist.get('fav', 0)},
            {'name': '购买',     'value': behavior_dist.get('buy', 0)},
        ],
    }


def _get_item_stats_from_dynamic(table, ds, days, category, sort_by):
    """从动态数据源获取商品统计（简化版，避免卡顿）"""
    cols = {c.name for c in table.columns}
    
    # 检查必需字段
    if 'item_id' not in cols:
        return {'overview': {'total_items': 0, 'item_growth': 0, 'active_items': 0, 'avg_price': 0}, 'top_items': []}
    
    # 计算时间范围
    start_dt, end_dt = _relative_time_range(days, ds.max_time)
    time_col_name = _get_time_column(table, ds.data_type)
    
    if time_col_name and start_dt and end_dt:
        base_filter = table.c[time_col_name].between(start_dt, end_dt)
    else:
        base_filter = text('1=1')
    
    # 总商品数
    total_items = db.session.query(func.count(distinct(table.c.item_id))).filter(base_filter).scalar() or 0
    
    # 简化返回（避免复杂查询）
    return {
        'overview': {
            'total_items': total_items,
            'item_growth': 0,
            'active_items': total_items,
            'avg_price': 0
        },
        'top_items': []  # 暂时返回空，避免卡顿
    }


# ──────────────────────────────────────────────
# 3. 商品分析
# ──────────────────────────────────────────────
def get_item_stats(days: int = 30, category: str = 'all', sort_by: str = 'purchases') -> dict:
    # 优先使用动态数据源（避免查询旧的大表导致卡顿）
    table, ds = _get_active_table()
    if table is not None and ds is not None:
        return _get_item_stats_from_dynamic(table, ds, days, category, sort_by)
    
    # 降级到旧逻辑
    s, e = _ts_range(days)  # 已内置全量回退
    base = UserBehavior.timestamp.between(s, e)

    # 总商品数 / 活跃商品
    total_items = db.session.query(
        func.count(distinct(UserBehavior.item_id))
    ).filter(base).scalar() or 0

    active_items = db.session.query(
        func.count(distinct(UserBehavior.item_id))
    ).filter(base, UserBehavior.behavior_type == 'buy').scalar() or 0

    # 均价（购买记录）
    avg_price = db.session.query(
        func.avg(UserBehavior.price)
    ).filter(base, UserBehavior.behavior_type == 'buy').scalar() or 0

    # Top 20 商品
    pv_sub = db.session.query(
        UserBehavior.item_id.label('iid'),
        func.count().label('pv')
    ).filter(base, UserBehavior.behavior_type == 'pv').group_by(UserBehavior.item_id).subquery()

    buy_sub = db.session.query(
        UserBehavior.item_id.label('iid'),
        UserBehavior.product_name.label('pname'),
        UserBehavior.brand.label('brand'),
        UserBehavior.category_name.label('cat'),
        func.count().label('buy_cnt'),
        func.sum(UserBehavior.price).label('revenue'),
        func.avg(UserBehavior.price).label('avg_price')
    ).filter(base, UserBehavior.behavior_type == 'buy'
    ).group_by(
        UserBehavior.item_id, UserBehavior.product_name,
        UserBehavior.brand, UserBehavior.category_name
    ).subquery()

    q = db.session.query(
        buy_sub.c.iid,
        buy_sub.c.pname,
        buy_sub.c.brand,
        buy_sub.c.cat,
        buy_sub.c.buy_cnt,
        buy_sub.c.revenue,
        buy_sub.c.avg_price,
        pv_sub.c.pv,
    ).outerjoin(pv_sub, buy_sub.c.iid == pv_sub.c.iid)

    if category != 'all':
        q = q.filter(buy_sub.c.cat == category)

    if sort_by == 'purchases':
        q = q.order_by(desc(buy_sub.c.buy_cnt))
    elif sort_by == 'revenue':
        q = q.order_by(desc(buy_sub.c.revenue))
    elif sort_by == 'views':
        q = q.order_by(desc(pv_sub.c.pv))
    else:
        q = q.order_by(desc(buy_sub.c.buy_cnt))

    rows = q.limit(20).all()
    top_items = []
    for r in rows:
        pv_cnt = r.pv or 0
        buy_cnt = r.buy_cnt or 0
        conv = round(buy_cnt / pv_cnt * 100, 1) if pv_cnt else 0
        heat = min(10, max(1, buy_cnt // 10 + (1 if buy_cnt > 0 else 0)))
        top_items.append({
            'item_id':        r.iid,
            'product_name':   r.pname or f'商品{r.iid}',
            'brand':          r.brand or '—',
            'category_id':    0,
            'category_name':  r.cat or '—',
            'view_count':     pv_cnt,
            'view_change':    0,
            'cart_count':     0,
            'fav_count':      0,
            'purchase_count': buy_cnt,
            'purchase_change':0,
            'revenue':        round(r.revenue or 0, 2),
            'avg_price':      round(r.avg_price or 0, 2),
            'conversion_rate': conv,
            'heat_level':     heat,
        })

    # 品类销售分布
    cat_q = db.session.query(
        UserBehavior.category_name,
        func.count().label('buy_cnt'),
        func.sum(UserBehavior.price).label('revenue')
    ).filter(base, UserBehavior.behavior_type == 'buy',
             UserBehavior.category_name != None
    ).group_by(UserBehavior.category_name
    ).order_by(desc('buy_cnt')).limit(10).all()
    category_dist = [
        {'name': r.category_name, 'buy_cnt': r.buy_cnt, 'revenue': round(r.revenue or 0, 2)}
        for r in cat_q
    ]

    # 品牌分析
    brand_q = db.session.query(
        UserBehavior.brand,
        func.count().label('buy_cnt'),
        func.sum(UserBehavior.price).label('revenue')
    ).filter(base, UserBehavior.behavior_type == 'buy',
             UserBehavior.brand != None
    ).group_by(UserBehavior.brand
    ).order_by(desc('buy_cnt')).limit(10).all()
    brand_dist = [
        {'brand': r.brand, 'buy_cnt': r.buy_cnt, 'revenue': round(r.revenue or 0, 2)}
        for r in brand_q
    ]

    # 价格区间分布
    try:
        price_q = db.session.query(
            case(
                (UserBehavior.price < 50,   '0-50'),
                (UserBehavior.price < 200,  '50-200'),
                (UserBehavior.price < 500,  '200-500'),
                (UserBehavior.price < 1000, '500-1000'),
                else_='1000+'
            ).label('range'),
            func.count().label('cnt')
        ).filter(base, UserBehavior.behavior_type == 'buy',
                 UserBehavior.price != None
        ).group_by('range').all()
    except Exception:
        price_q = []
    price_dist = [{'range': r.range, 'cnt': r.cnt} for r in price_q]

    # avg_views and avg_conversion for template
    total_views_q = db.session.query(func.count()).filter(
        base, UserBehavior.behavior_type == 'pv').scalar() or 0
    avg_views_val = round(total_views_q / total_items, 1) if total_items else 0
    total_buys_q  = db.session.query(func.count()).filter(
        base, UserBehavior.behavior_type == 'buy').scalar() or 0
    avg_conv_val  = round(total_buys_q / max(total_views_q, 1) * 100, 2)

    return {
        'overview': {
            'total_items': total_items,
            'active_items': active_items,
            'avg_price': round(avg_price, 2),
            'item_growth': 0,
            'avg_views': avg_views_val,
            'avg_conversion': avg_conv_val,
        },
        'top_items': top_items,
        'category_dist': category_dist,
        'brand_dist': brand_dist,
        'price_dist': price_dist,
    }


# ──────────────────────────────────────────────
# 4. RFM 分析
# ──────────────────────────────────────────────
def get_rfm_data(days: int = 90) -> dict:
    if has_order_data():
        return get_order_rfm_data(days)
    s, e = _ts_range(days)
    end_ts = e

    # 每个用户：最近购买时间戳、购买次数、总消费
    rfm_q = db.session.query(
        UserBehavior.user_id,
        func.max(UserBehavior.timestamp).label('last_buy_ts'),
        func.count().label('freq'),
        func.sum(UserBehavior.price).label('monetary')
    ).filter(
        UserBehavior.timestamp.between(s, e),
        UserBehavior.behavior_type == 'buy'
    ).group_by(UserBehavior.user_id).all()

    if not rfm_q:
        return _empty_rfm()

    users = []
    segments_count = defaultdict(int)
    seg_freq = defaultdict(list)
    seg_monetary = defaultdict(list)
    seg_recency = defaultdict(list)

    for row in rfm_q:
        recency = (end_ts - row.last_buy_ts) // 86400   # days since last buy
        freq = row.freq
        monetary = float(row.monetary or 0)

        # RFM 打分 (1-5)
        r_score = 5 if recency <= 7 else (4 if recency <= 14 else (3 if recency <= 30 else (2 if recency <= 60 else 1)))
        # freq / monetary 的分位数需要所有数据，这里先存储原始值
        users.append({'user_id': row.user_id, 'recency': recency,
                      'freq': freq, 'monetary': monetary,
                      'r_score': r_score})

    # 计算分位数
    freqs = sorted(u['freq'] for u in users)
    mons  = sorted(u['monetary'] for u in users)
    n = len(freqs)

    def pct_score(val, arr):
        if not arr: return 3
        rank = sum(1 for v in arr if v <= val) / len(arr)
        return 5 if rank > 0.8 else (4 if rank > 0.6 else (3 if rank > 0.4 else (2 if rank > 0.2 else 1)))

    seg_map = {
        (True,  True,  True):  ('champion',  '冠军客户',    '#5470C6'),
        (True,  True,  False): ('loyal',     '忠诚客户',    '#91CC75'),
        (True,  False, True):  ('potential', '潜力客户',    '#FAC858'),
        (True,  False, False): ('new',       '新客户',      '#EE6666'),
        (False, True,  True):  ('at_risk',   '流失风险',    '#FC8452'),
        (False, True,  False): ('slipping',  '需关注',      '#9A60B4'),
        (False, False, True):  ('dormant',   '沉睡客户',    '#ea7ccc'),
        (False, False, False): ('lost',      '已流失客户',  '#73C0DE'),
    }

    result_users = []
    for u in users:
        f_score = pct_score(u['freq'], freqs)
        m_score = pct_score(u['monetary'], mons)
        r_high = u['r_score'] >= 3
        f_high = f_score >= 3
        m_high = m_score >= 3
        key = (r_high, f_high, m_high)
        seg_code, seg_name, seg_color = seg_map.get(key, ('average', '普通客户', '#aaa'))
        u['f_score'] = f_score
        u['m_score'] = m_score
        u['segment'] = seg_code
        u['segment_name'] = seg_name
        segments_count[seg_code] += 1
        seg_freq[seg_code].append(u['freq'])
        seg_monetary[seg_code].append(u['monetary'])
        seg_recency[seg_code].append(u['recency'])
        result_users.append(u)

    seg_summary = []
    for seg_code, cnt in segments_count.items():
        _, seg_name, color = next(
            (v for k, v in seg_map.items() if v[0] == seg_code),
            (seg_code, seg_code, '#aaa')
        )
        seg_summary.append({
            'segment': seg_code,
            'segment_name': seg_name,
            'color': color,
            'count': cnt,
            'avg_frequency': round(sum(seg_freq[seg_code]) / cnt, 1),
            'avg_monetary': round(sum(seg_monetary[seg_code]) / cnt, 2),
            'avg_recency': round(sum(seg_recency[seg_code]) / cnt, 1),
        })

    total_users = len(result_users)
    return {
        'total_users': total_users,
        'segments': seg_summary,
        'segment_dist': [{'name': s['segment_name'], 'value': s['count'], 'color': s['color']}
                         for s in seg_summary],
        'user_sample': result_users[:200],   # 前200条样本用于散点图
    }


def _empty_rfm():
    return {'total_users': 0, 'segments': [], 'segment_dist': [], 'user_sample': []}


# ──────────────────────────────────────────────
# 5. 用户画像
# ──────────────────────────────────────────────
def get_user_info(user_id: int):  # -> dict | None
    behaviors = UserBehavior.query.filter_by(user_id=user_id)\
        .order_by(UserBehavior.timestamp.desc()).limit(2000).all()
    if not behaviors:
        return None

    pv   = [b for b in behaviors if b.behavior_type == 'pv']
    cart = [b for b in behaviors if b.behavior_type == 'cart']
    fav  = [b for b in behaviors if b.behavior_type == 'fav']
    buy  = [b for b in behaviors if b.behavior_type == 'buy']
    pv_cnt, cart_cnt, fav_cnt, buy_cnt = len(pv), len(cart), len(fav), len(buy)

    total_spent = sum(b.price for b in buy if b.price)
    avg_order   = round(total_spent / buy_cnt, 2) if buy_cnt else 0

    pv_to_buy   = round(buy_cnt  / pv_cnt  * 100, 1) if pv_cnt  else 0
    pv_to_cart  = round(cart_cnt / pv_cnt  * 100, 1) if pv_cnt  else 0
    pv_to_fav   = round(fav_cnt  / pv_cnt  * 100, 1) if pv_cnt  else 0

    last_ts = behaviors[0].timestamp
    days_ago = (datetime.now().timestamp() - last_ts) // 86400

    # 品类偏好
    cat_cnt = defaultdict(int)
    for b in behaviors:
        if b.category_name:
            cat_cnt[b.category_name] += 1
    top_cats = sorted(cat_cnt, key=lambda x: cat_cnt[x], reverse=True)[:5]

    # 品牌偏好
    brand_cnt = defaultdict(int)
    for b in behaviors:
        if b.brand:
            brand_cnt[b.brand] += 1
    top_brands = sorted(brand_cnt, key=lambda x: brand_cnt[x], reverse=True)[:5]

    # 购买商品列表
    bought_items = [
        {'item_id': b.item_id, 'product_name': b.product_name,
         'brand': b.brand, 'category': b.category_name, 'price': b.price}
        for b in buy[:20]
    ]

    # 小时活跃分布
    hour_dist = defaultdict(int)
    for b in behaviors:
        if b.hour is not None:
            hour_dist[b.hour] += 1

    # 分群
    if buy_cnt >= 10:
        segment, segment_name, value_level = 'champion', '冠军客户', 'high'
    elif buy_cnt >= 5:
        segment, segment_name, value_level = 'loyal', '忠诚客户', 'high'
    elif buy_cnt >= 1:
        segment, segment_name, value_level = 'active', '活跃用户', 'medium'
    else:
        segment, segment_name, value_level = 'new', '新用户', 'low'

    total_actions = len(behaviors)
    activity_level = 'high' if total_actions >= 100 else ('medium' if total_actions >= 20 else 'low')

    return {
        'user_id': user_id,
        'segment': segment,
        'segment_name': segment_name,
        'activity_level': activity_level,
        'value_level': value_level,
        'register_time': '未知',
        'last_active': int(days_ago),
        'region': '未知', 'device': '未知',
        'pv_count': pv_cnt, 'cart_count': cart_cnt,
        'fav_count': fav_cnt, 'buy_count': buy_cnt,
        'total_spent': round(total_spent, 2),
        'avg_order_value': avg_order,
        'pv_to_cart_rate': pv_to_cart,
        'pv_to_fav_rate': pv_to_fav,
        'pv_to_buy_rate': pv_to_buy,
        'overall_conversion': pv_to_buy,
        'price_sensitivity': 50,
        'preferences': [{'name': c, 'icon': 'fas fa-tag', 'color': '#5470C6'} for c in top_cats],
        'top_brands': top_brands,
        'bought_items': bought_items,
        'hour_dist': [hour_dist.get(h, 0) for h in range(24)],
        'summary': f'用户 {user_id} 共 {total_actions} 次行为，购买 {buy_cnt} 次，累计消费 ¥{round(total_spent,2)}，转化率 {pv_to_buy}%。',
        'insights': [
            f'共产生 {total_actions} 次行为，其中购买 {buy_cnt} 次',
            f'累计消费 ¥{round(total_spent, 2)}，均单价 ¥{avg_order}',
            f'浏览→购买转化率 {pv_to_buy}%',
            f'最近活跃于 {int(days_ago)} 天前',
        ],
        'recommendations': [
            {'suggestion': '根据偏好品类推送个性化商品'},
            {'suggestion': '定期推送品牌新品提升复购'},
        ],
    }


# ──────────────────────────────────────────────
# 6. 智能推荐 / 实时建议
# ──────────────────────────────────────────────
def get_recommendation_insights(days: int = 30) -> dict:
    # 优先使用动态数据源（避免卡顿）
    table, ds = _get_active_table()
    if table is not None and ds is not None:
        # 简化返回，避免复杂推荐计算
        return {
            'hot_items': [],
            'trending_categories': [],
            'user_segments': [],
            'recommendation_rules': []
        }
    
    s, e = _ts_range(days)

    counts_q = db.session.query(
        UserBehavior.behavior_type,
        func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e)
    ).group_by(UserBehavior.behavior_type).all()
    counts = {r.behavior_type: r.cnt for r in counts_q}

    pv   = counts.get('pv',   0)
    cart = counts.get('cart', 0)
    buy  = counts.get('buy',  0)
    conv_rate = round(buy / pv * 100, 2) if pv else 0
    cart_rate = round(cart / pv * 100, 2) if pv else 0

    total_users = db.session.query(
        func.count(distinct(UserBehavior.user_id))
    ).filter(UserBehavior.timestamp.between(s, e)).scalar() or 0

    active_users = db.session.query(
        func.count(distinct(UserBehavior.user_id))
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy').scalar() or 0

    total_revenue = db.session.query(
        func.sum(UserBehavior.price)
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy').scalar() or 0

    # Top 3 品牌（购买）
    brand_q = db.session.query(
        UserBehavior.brand, func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy',
             UserBehavior.brand != None
    ).group_by(UserBehavior.brand).order_by(desc('cnt')).limit(3).all()
    top_brands = [{'brand': r.brand, 'cnt': r.cnt} for r in brand_q]

    # Top 3 品类
    cat_q = db.session.query(
        UserBehavior.category_name, func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy',
             UserBehavior.category_name != None
    ).group_by(UserBehavior.category_name).order_by(desc('cnt')).limit(3).all()
    top_cats = [{'name': r.category_name, 'cnt': r.cnt} for r in cat_q]

    # Top 5 热销商品
    top_items_q = db.session.query(
        UserBehavior.item_id,
        UserBehavior.product_name,
        func.count().label('cnt')
    ).filter(UserBehavior.timestamp.between(s, e),
             UserBehavior.behavior_type == 'buy'
    ).group_by(UserBehavior.item_id, UserBehavior.product_name
    ).order_by(desc('cnt')).limit(5).all()
    top_items = [{'item_id': r.item_id,
                  'name': r.product_name or f'商品{r.item_id}',
                  'buy_count': r.cnt} for r in top_items_q]

    suggestions = []
    if conv_rate < 3:
        suggestions.append({'type': 'warning', 'title': '转化率偏低',
                             'detail': f'浏览→购买转化率仅 {conv_rate}%，建议优化商品详情页、价格策略及促销引导。'})
    else:
        suggestions.append({'type': 'success', 'title': '转化率良好',
                             'detail': f'转化率 {conv_rate}%，可进一步通过个性化推荐提升。'})

    inactive_users = total_users - active_users
    if inactive_users > total_users * 0.5:
        suggestions.append({'type': 'warning', 'title': '大量用户未购买',
                             'detail': f'近{days}天内 {inactive_users}/{total_users} 名用户仅浏览未购买，建议发放专项优惠券召回。'})

    if cart_rate > conv_rate * 4:
        suggestions.append({'type': 'info', 'title': '加购流失明显',
                             'detail': f'加购率 {cart_rate}% 远高于转化率 {conv_rate}%，建议推送「加购未付款」提醒。'})

    if top_brands:
        brand_str = '、'.join(b['brand'] for b in top_brands)
        suggestions.append({'type': 'primary', 'title': '热门品牌推广',
                             'detail': f'{brand_str} 为近期热销品牌，建议加大其商品曝光量。'})

    if top_cats:
        cat_str = '、'.join(c['name'] for c in top_cats)
        suggestions.append({'type': 'info', 'title': '热门品类运营',
                             'detail': f'{cat_str} 近期购买量领先，建议重点运营相关商品。'})

    return {
        'stats': {
            'total_behaviors': sum(counts.values()),
            'total_users': total_users,
            'active_users': active_users,
            'pv': pv, 'cart': cart, 'buy': buy,
            'conversion_rate': conv_rate,
            'cart_rate': cart_rate,
            'total_revenue': round(total_revenue, 2),
        },
        'top_brands': top_brands,
        'top_categories': top_cats,
        'top_items': top_items,
        'suggestions': suggestions,
        'synced_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    }


# ══════════════════════════════════════════════════════════════════
#  Order 表专属分析引擎（适配 order.csv + user.csv 38万订单数据集）
# ══════════════════════════════════════════════════════════════════

def _order_date_range(days: int):
    """返回 (start_dt, end_dt) datetime，以 orders 表最新下单时间为基准。
    days=0 表示全量。若表为空返回 None, None。
    """
    try:
        max_dt = db.session.query(func.max(Order.order_time)).scalar()
        min_dt = db.session.query(func.min(Order.order_time)).scalar()
    except Exception:
        return None, None
    if not max_dt:
        return None, None
    if days == 0:
        return min_dt, max_dt
    start_dt = max_dt - timedelta(days=days)
    # 若范围内无数据则回退全量
    cnt = db.session.query(func.count(Order.id)).filter(
        Order.order_time.between(start_dt, max_dt)
    ).scalar() or 0
    if cnt == 0:
        return min_dt, max_dt
    return start_dt, max_dt


def has_order_data() -> bool:
    """检查 orders 表是否有数据"""
    try:
        return (db.session.query(func.count(Order.id)).scalar() or 0) > 0
    except Exception:
        return False


def get_order_dashboard_stats(days: int = 0) -> dict:
    """从 orders 表生成数据看板统计（适合 order.csv 数据集）"""
    s, e = _order_date_range(days)
    if s is None:
        return _empty_dashboard()

    base = Order.order_time.between(s, e)
    q    = Order.query.filter(base)
    total = q.count()
    if total == 0:
        return _empty_dashboard()

    # 核心指标
    total_users = db.session.query(func.count(distinct(Order.user_id))).filter(base).scalar() or 0
    total_items = db.session.query(func.count(distinct(Order.product_id))).filter(base).scalar() or 0
    total_revenue = db.session.query(func.sum(Order.amount)).filter(base).scalar() or 0.0
    avg_order_val = round(total_revenue / total, 2) if total else 0

    # 漏斗：用 user_accounts 补充 click/cart 数据
    try:
        total_clicks = db.session.query(func.sum(UserAccount.click_count)).scalar() or 0
        total_carts  = db.session.query(func.sum(UserAccount.cart_count)).scalar()  or 0
    except Exception:
        total_clicks = total_carts = 0

    conv_rate = round(total / total_clicks * 100, 2) if total_clicks else 0

    # 订单状态分布
    status_q = db.session.query(
        Order.order_status, func.count().label('cnt')
    ).filter(base).group_by(Order.order_status).all()
    status_dist = {r.order_status: r.cnt for r in status_q}

    # 日趋势（实付金额 + 订单量）
    daily_q = db.session.query(
        Order.order_date,
        func.count().label('orders'),
        func.sum(Order.amount).label('revenue')
    ).filter(base, Order.order_date != None
    ).group_by(Order.order_date).order_by(Order.order_date).all()

    dates_sorted = [r.order_date.strftime('%m-%d') for r in daily_q if r.order_date]
    daily_trend = {
        'dates':   dates_sorted,
        'buy':     [r.orders  for r in daily_q if r.order_date],
        'revenue': [round(r.revenue or 0, 2) for r in daily_q if r.order_date],
        'pv': [], 'cart': [], 'fav': [],
    }

    # Top10 商品（订单量 + 营收）
    top_items_q = db.session.query(
        Order.product_id, Order.product_name,
        func.count().label('buy_cnt'),
        func.sum(Order.amount).label('revenue')
    ).filter(base).group_by(Order.product_id, Order.product_name
    ).order_by(desc('buy_cnt')).limit(10).all()
    top_items = [
        {'item_id': r.product_id,
         'name': r.product_name or f'商品{r.product_id}',
         'buy_cnt': r.buy_cnt,
         'revenue': round(r.revenue or 0, 2)}
        for r in top_items_q
    ]

    # Top10 活跃用户（订单数）
    top_users_q = db.session.query(
        Order.user_id, func.count().label('action_cnt')
    ).filter(base).group_by(Order.user_id
    ).order_by(desc('action_cnt')).limit(10).all()
    top_users = [{'user_id': r.user_id, 'action_cnt': r.action_cnt} for r in top_users_q]

    # 品类分布（营收）
    cat_q = db.session.query(
        Order.category, func.count().label('cnt'), func.sum(Order.amount).label('rev')
    ).filter(base, Order.category != None
    ).group_by(Order.category).order_by(desc('rev')).limit(8).all()
    category_dist = [{'name': r.category, 'value': r.cnt, 'revenue': round(r.rev or 0, 2)}
                     for r in cat_q]

    return {
        'total_users':     total_users,
        'total_items':     total_items,
        'total_behaviors': total,
        'pv':   total_clicks,
        'cart': total_carts,
        'fav':  0,
        'buy':  total,
        'conversion_rate': conv_rate,
        'total_revenue':   round(total_revenue, 2),
        'avg_order_value': avg_order_val,
        'status_dist':     status_dist,
        'daily_trend':     daily_trend,
        'top_items':       top_items,
        'top_users':       top_users,
        'category_dist':   category_dist,
        '_source':         'order',
    }


def get_order_behavior_stats(days: int = 0) -> dict:
    """从 orders 表生成行为分析统计（支付方式、促销、订单状态、时段分布）"""
    s, e = _order_date_range(days)
    if s is None:
        return {}
    base = Order.order_time.between(s, e)

    # 支付方式分布
    pay_q = db.session.query(
        Order.payment_method, func.count().label('cnt')
    ).filter(base, Order.payment_method != None
    ).group_by(Order.payment_method).order_by(desc('cnt')).all()
    payment_dist = [{'name': r.payment_method, 'value': r.cnt} for r in pay_q]

    # 促销效果
    promo_q = db.session.query(
        Order.promotion_type, func.count().label('cnt'), func.sum(Order.amount).label('rev')
    ).filter(base).group_by(Order.promotion_type).all()
    promo_dist = [{'type': r.promotion_type or '无促销', 'count': r.cnt,
                   'revenue': round(r.rev or 0, 2)} for r in promo_q]

    # 订单状态漏斗
    status_q = db.session.query(
        Order.order_status, func.count().label('cnt')
    ).filter(base, Order.order_status != None
    ).group_by(Order.order_status).all()
    status_dist = [{'name': r.order_status, 'value': r.cnt} for r in status_q]

    # 小时分布
    hour_q = db.session.query(
        Order.order_hour, func.count().label('cnt')
    ).filter(base, Order.order_hour != None
    ).group_by(Order.order_hour).order_by(Order.order_hour).all()
    hour_map = {r.order_hour: r.cnt for r in hour_q}
    hourly = {
        'hours': list(range(24)),
        'buy':   [hour_map.get(h, 0) for h in range(24)],
        'pv': [], 'cart': [], 'fav': [],
    }

    # 性别分布
    gender_q = db.session.query(
        Order.gender, func.count().label('cnt')
    ).filter(base, Order.gender != None
    ).group_by(Order.gender).all()
    gender_dist = [{'name': r.gender, 'value': r.cnt} for r in gender_q]

    # 年龄段分布
    age_q = db.session.query(Order.age).filter(base, Order.age != None).all()
    age_buckets = defaultdict(int)
    for (a,) in age_q:
        bucket = f'{(a // 10) * 10}-{(a // 10) * 10 + 9}岁'
        age_buckets[bucket] += 1
    age_dist = [{'name': k, 'value': v} for k, v in sorted(age_buckets.items())]

    # 地域分布（下单省份 top10）
    prov_q = db.session.query(
        Order.user_province, func.count().label('cnt'), func.sum(Order.amount).label('rev')
    ).filter(base, Order.user_province != None
    ).group_by(Order.user_province).order_by(desc('rev')).limit(10).all()
    province_dist = [{'name': r.user_province, 'orders': r.cnt,
                      'revenue': round(r.rev or 0, 2)} for r in prov_q]

    # 品牌排行
    brand_q = db.session.query(
        Order.brand, func.count().label('cnt'), func.sum(Order.amount).label('rev')
    ).filter(base, Order.brand != None
    ).group_by(Order.brand).order_by(desc('rev')).limit(10).all()
    brand_dist = [{'name': r.brand, 'count': r.cnt, 'revenue': round(r.rev or 0, 2)}
                  for r in brand_q]

    return {
        'payment_dist':  payment_dist,
        'promo_dist':    promo_dist,
        'status_dist':   status_dist,
        'hourly':        hourly,
        'gender_dist':   gender_dist,
        'age_dist':      age_dist,
        'province_dist': province_dist,
        'brand_dist':    brand_dist,
        '_source':       'order',
    }


def get_order_rfm_data(days: int = 0) -> dict:
    """从 orders 表计算 RFM 分群（Recency/Frequency/Monetary 均来自真实订单）"""
    s, e = _order_date_range(days)
    if s is None:
        return {'segments': [], 'total_users': 0}
    base = Order.order_time.between(s, e)

    rfm_q = db.session.query(
        Order.user_id,
        func.max(Order.order_time).label('last_order'),
        func.count().label('freq'),
        func.sum(Order.amount).label('monetary')
    ).filter(base).group_by(Order.user_id).all()

    if not rfm_q:
        return {'segments': [], 'total_users': 0}

    ref_dt = e
    rows = []
    for r in rfm_q:
        days_ago = (ref_dt - r.last_order).days if r.last_order else 999
        rows.append({'user_id': r.user_id, 'R': days_ago, 'F': r.freq, 'M': float(r.monetary or 0)})

    # 简单四分位分层
    import statistics
    r_vals = [x['R'] for x in rows]
    f_vals = [x['F'] for x in rows]
    m_vals = [x['M'] for x in rows]
    r_med  = statistics.median(r_vals)
    f_med  = statistics.median(f_vals)
    m_med  = statistics.median(m_vals)

    seg_counts = defaultdict(int)
    for row in rows:
        r_high = row['R'] <= r_med   # 最近购买 → 高=小天数
        f_high = row['F'] >= f_med
        m_high = row['M'] >= m_med
        if r_high and f_high and m_high:
            seg = '高价值用户'
        elif r_high and f_high:
            seg = '潜力用户'
        elif r_high and m_high:
            seg = '高消费用户'
        elif r_high:
            seg = '新用户'
        elif f_high and m_high:
            seg = '忠诚用户'
        elif not r_high and not f_high and not m_high:
            seg = '流失用户'
        else:
            seg = '一般用户'
        row['segment'] = seg
        seg_counts[seg] += 1

    segments = [{'segment': k, 'count': v,
                 'pct': round(v / len(rows) * 100, 1)} for k, v in seg_counts.items()]
    segments.sort(key=lambda x: -x['count'])

    return {
        'segments':    segments,
        'total_users': len(rows),
        'rfm_rows':    rows[:200],  # 返回前200条供散点图
        '_source':     'order',
    }
