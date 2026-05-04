import pandas as pd
import numpy as np
from datetime import datetime
from sqlalchemy import func, and_
from core.models import TaobaoUserBehavior, UserProfile, ItemProfile
import json

class DataPreprocessor:
    '''淘宝数据预处理器'''

    def __init__(self, file_path=None):
        self.file_path = file_path
        self.data = None

    def load_from_csv(self, file_path):
        '''从CSV加载数据'''
        try:
            # 读取无表头CSV
            self.data = pd.read_csv(file_path, header=None)
            self.data.columns = ['user_id', 'item_id', 'category_id',
                                'behavior_type', 'timestamp']

            # 转换时间戳
            self.data['datetime'] = pd.to_datetime(self.data['timestamp'], unit='s')
            self.data['date'] = self.data['datetime'].dt.date
            self.data['hour'] = self.data['datetime'].dt.hour

            return self.data

        except Exception as e:
            raise Exception(f"CSV文件读取失败: {str(e)}")

    def load_from_database(self, start_date=None, end_date=None):
        '''从数据库加载数据'''
        query = TaobaoUserBehavior.query

        if start_date and end_date:
            query = query.filter(
                TaobaoUserBehavior.date >= start_date,
                TaobaoUserBehavior.date <= end_date
            )

        # 转换为DataFrame
        data = pd.read_sql(query.statement, query.session.bind)
        self.data = data

        return data

class BehaviorAnalyzer:
    '''用户行为分析器'''

    def __init__(self, data):
        self.data = data

    def analyze_user_behavior(self, user_id):
        '''分析单个用户行为'''
        user_data = self.data[self.data['user_id'] == user_id]

        if user_data.empty:
            return None

        # 基本统计
        stats = {
            'user_id': user_id,
            'total_actions': len(user_data),
            'total_purchases': len(user_data[user_data['behavior_type'] == 'buy']),
            'pv_count': len(user_data[user_data['behavior_type'] == 'pv']),
            'cart_count': len(user_data[user_data['behavior_type'] == 'cart']),
            'fav_count': len(user_data[user_data['behavior_type'] == 'fav']),
            'purchase_rate': len(user_data[user_data['behavior_type'] == 'buy']) / len(user_data) * 100,
            'first_action': user_data['datetime'].min(),
            'last_action': user_data['datetime'].max(),
            'active_days': user_data['date'].nunique()
        }

        # 时间模式分析
        hourly_dist = user_data.groupby('hour').size().to_dict()
        stats['hourly_distribution'] = hourly_dist

        # 品类偏好
        category_pref = user_data['category_id'].value_counts().head(5).to_dict()
        stats['preferred_categories'] = category_pref

        return stats

    def analyze_item_behavior(self, item_id):
        '''分析商品行为'''
        item_data = self.data[self.data['item_id'] == item_id]

        if item_data.empty:
            return None

        stats = {
            'item_id': item_id,
            'total_views': len(item_data[item_data['behavior_type'] == 'pv']),
            'total_carts': len(item_data[item_data['behavior_type'] == 'cart']),
            'total_favs': len(item_data[item_data['behavior_type'] == 'fav']),
            'total_purchases': len(item_data[item_data['behavior_type'] == 'buy']),
            'conversion_rate': len(item_data[item_data['behavior_type'] == 'buy']) / len(item_data) * 100 if len(item_data) > 0 else 0,
            'category_id': item_data['category_id'].iloc[0] if not item_data.empty else None
        }

        return stats

    def get_trend_analysis(self, start_date, end_date):
        '''趋势分析'''
        date_range = pd.date_range(start=start_date, end=end_date)
        daily_stats = []

        for date in date_range:
            date_str = date.strftime('%Y-%m-%d')
            daily_data = self.data[self.data['date'] == date]

            if not daily_data.empty:
                stats = {
                    'date': date_str,
                    'total_users': daily_data['user_id'].nunique(),
                    'total_items': daily_data['item_id'].nunique(),
                    'total_actions': len(daily_data),
                    'pv_count': len(daily_data[daily_data['behavior_type'] == 'pv']),
                    'cart_count': len(daily_data[daily_data['behavior_type'] == 'cart']),
                    'fav_count': len(daily_data[daily_data['behavior_type'] == 'fav']),
                    'buy_count': len(daily_data[daily_data['behavior_type'] == 'buy']),
                    'purchase_rate': len(daily_data[daily_data['behavior_type'] == 'buy']) / len(daily_data) * 100 if len(daily_data) > 0 else 0
                }
                daily_stats.append(stats)

        return pd.DataFrame(daily_stats)
