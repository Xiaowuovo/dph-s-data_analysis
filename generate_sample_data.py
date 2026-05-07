"""
生成满足所有分析模块要求的综合示例数据集
运行: python generate_sample_data.py
输出: full_sample_data.csv
"""
import csv
import random
from datetime import datetime, timedelta

random.seed(42)

N = 1000  # 行数

# 基础配置
USER_IDS    = list(range(10001, 10201))   # 200 个用户
ITEM_IDS    = list(range(200001, 200051)) # 50 个商品
CATEGORY_IDS= [101, 102, 103, 104, 105, 106, 107, 108]
CATEGORY_NAMES = {
    101: '3C电子', 102: '美妆护肤', 103: '服装', 104: '食品饮料',
    105: '家居', 106: '运动户外', 107: '图书', 108: '母婴'
}
BRANDS      = ['华为','小米','苹果','完美日记','欧莱雅','耐克','阿迪达斯','海尔','格力','联想']
GENDERS     = ['M', 'F', 'Unknown']
BEHAVIORS   = ['pv', 'pv', 'pv', 'fav', 'cart', 'buy']  # pv 概率最高
CITIES      = ['北京市','上海市','广州市','深圳市','成都市','杭州市','武汉市','南京市','西安市','重庆市']
PROVINCES   = ['北京','上海','广东','浙江','四川','湖北','江苏','陕西','重庆','天津']
CHANNELS    = ['App Store', 'Android Market', 'Web', 'WeChat']
STATUSES    = ['Delivered', 'Delivered', 'Delivered', 'Processing', 'Cancelled', 'Refunded']
PAYMENTS    = ['WeChatPay', 'Alipay', 'DebitCard', 'CreditCard']

# 时间范围：2024-01-01 ~ 2024-12-31
START = datetime(2024, 1, 1)
END   = datetime(2024, 12, 31, 23, 59, 59)

def rand_dt():
    delta = END - START
    return START + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

def rand_ts(dt):
    return int(dt.timestamp())

rows = []
for i in range(N):
    uid  = random.choice(USER_IDS)
    iid  = random.choice(ITEM_IDS)
    cid  = random.choice(CATEGORY_IDS)
    brand= random.choice(BRANDS)
    btype= random.choice(BEHAVIORS)
    dt   = rand_dt()
    price= round(random.uniform(9.9, 9999.0), 2)
    qty  = random.randint(1, 5)
    amt  = round(price * qty, 2)
    gender = random.choice(GENDERS)
    age    = random.randint(18, 65)
    city   = random.choice(CITIES)
    prov   = random.choice(PROVINCES)

    rows.append({
        # ── 行为字段（behavior 模块）──
        'user_id':       uid,
        'item_id':       iid,
        'category_id':   cid,
        'category_name': CATEGORY_NAMES[cid],
        'brand':         brand,
        'product_name':  f'{brand} 商品{iid}',
        'behavior_type': btype,
        'timestamp':     rand_ts(dt),          # Unix 整数，behavior_datetime 由后端生成
        'price':         price,
        # ── 订单字段（sales / rfm 模块）──
        'order_id':      3000000 + i + 1,
        'order_time':    dt.strftime('%Y-%m-%d %H:%M:%S'),
        'quantity':      qty,
        'amount':        amt,
        'payment_method': random.choice(PAYMENTS),
        'order_status':  random.choice(STATUSES),
        'shipping_city': city,
        # ── 用户画像字段（user_profile 模块）──
        'gender':        gender,
        'age':           age,
        'user_province_name': prov,
        'register_channel': random.choice(CHANNELS),
        # ── 商品分析字段（item_analysis 模块）──
        'is_hot':        random.randint(0, 1),
        'product_region_id': random.randint(1, 34),
    })

FIELDNAMES = [
    'user_id','item_id','category_id','category_name','brand','product_name',
    'behavior_type','timestamp','price',
    'order_id','order_time','quantity','amount','payment_method','order_status','shipping_city',
    'gender','age','user_province_name','register_channel',
    'is_hot','product_region_id',
]

out_path = 'full_sample_data.csv'
with open(out_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
    writer.writeheader()
    writer.writerows(rows)

print(f'✅ 已生成 {out_path}，共 {N} 行')
print(f'包含字段: {", ".join(FIELDNAMES)}')
print()
print('各模块字段覆盖检查:')
checks = {
    'dashboard':     ['user_id','item_id'],
    'sales':         ['amount','order_time'],
    'behavior':      ['behavior_type','timestamp'],
    'rfm':           ['user_id','amount','order_time'],
    'user_profile':  ['user_id','age','gender'],
    'item_analysis': ['item_id','category_id'],
}
for mod, fields in checks.items():
    ok = all(f in FIELDNAMES for f in fields)
    print(f'  {"✅" if ok else "❌"} {mod}: {fields}')
