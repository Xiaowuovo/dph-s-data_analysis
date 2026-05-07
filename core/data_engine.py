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
from core.models import UserBehavior


# ──────────────────────────────────────────────
# 工具
# ──────────────────────────────────────────────
def _ts_range(days: int):
    """返回 (start_ts, end_ts) Unix 整数秒，以当前时间往前推 days 天"""
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=days)
    return int(start_dt.timestamp()), int(end_dt.timestamp())


def _q_base(days: int):
    """返回按时间过滤的基础查询对象"""
    s, e = _ts_range(days)
    return UserBehavior.query.filter(UserBehavior.timestamp.between(s, e))


# ──────────────────────────────────────────────
# 1. 数据看板 / 总览
# ──────────────────────────────────────────────
def get_dashboard_stats(days: int = 30) -> dict:
    s, e = _ts_range(days)
    q = UserBehavior.query.filter(UserBehavior.timestamp.between(s, e))

    # 行为总计
    total = q.count()
    if total == 0:
        return _empty_dashboard()

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
    s, e = _ts_range(days)

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


# ──────────────────────────────────────────────
# 3. 商品分析
# ──────────────────────────────────────────────
def get_item_stats(days: int = 30, category: str = 'all', sort_by: str = 'purchases') -> dict:
    s, e = _ts_range(days)
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
