import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
from core.models import TaobaoUserBehavior, UserProfile, ItemProfile, Recommendation
import json
from datetime import datetime, timedelta


class RecommenderSystem:
    '''推荐系统核心类'''

    def __init__(self, data=None):
        self.data = data
        self.user_item_matrix = None
        self.user_similarity = None
        self.item_similarity = None

    def build_user_item_matrix(self):
        '''构建用户-物品矩阵'''
        if self.data is None or self.data.empty:
            return None

        # 创建评分矩阵（浏览=1，加入购物车=2，收藏=3，购买=4）
        def get_behavior_weight(behavior_type):
            weights = {'pv': 1, 'cart': 2, 'fav': 3, 'buy': 4}
            return weights.get(behavior_type, 1)

        self.data['weight'] = self.data['behavior_type'].apply(get_behavior_weight)

        # 构建矩阵
        self.user_item_matrix = pd.pivot_table(
            self.data,
            values='weight',
            index='user_id',
            columns='item_id',
            aggfunc='max',
            fill_value=0
        )

        return self.user_item_matrix

    def calculate_user_similarity(self):
        '''计算用户相似度'''
        if self.user_item_matrix is None:
            self.build_user_item_matrix()

        if self.user_item_matrix is not None:
            self.user_similarity = pd.DataFrame(
                cosine_similarity(self.user_item_matrix),
                index=self.user_item_matrix.index,
                columns=self.user_item_matrix.index
            )

        return self.user_similarity

    def collaborative_filtering_recommend(self, user_id, n_recommendations=10):
        '''协同过滤推荐'''
        if self.user_similarity is None:
            self.calculate_user_similarity()

        if self.user_similarity is None or user_id not in self.user_similarity.index:
            return []

        # 获取相似用户
        similar_users = self.user_similarity[user_id].sort_values(ascending=False)[1:11]

        # 获取相似用户喜欢的物品
        recommendations = []
        for sim_user, similarity_score in similar_users.items():
            if similarity_score > 0.1:  # 相似度阈值
                # 获取该用户有正向行为的物品
                user_items = self.user_item_matrix.loc[sim_user]
                positive_items = user_items[user_items > 0].index.tolist()

                # 排除目标用户已看过的物品
                target_user_items = set(
                    self.user_item_matrix.loc[user_id][self.user_item_matrix.loc[user_id] > 0].index)
                new_items = [item for item in positive_items if item not in target_user_items]

                recommendations.extend(new_items)

        # 去重并排序
        recommendations = list(set(recommendations))

        # 根据流行度排序
        if recommendations:
            item_popularity = self.data.groupby('item_id').size()
            recommendations.sort(
                key=lambda x: item_popularity.get(x, 0),
                reverse=True
            )

        return recommendations[:n_recommendations]

    def content_based_recommend(self, user_id, n_recommendations=10):
        '''基于内容的推荐'''
        # 获取用户历史行为
        user_history = self.data[self.data['user_id'] == user_id]

        if user_history.empty:
            return []

        # 获取用户偏好的品类
        preferred_categories = user_history['category_id'].value_counts().head(3).index.tolist()

        # 获取同品类热门商品
        recommendations = []
        for category in preferred_categories:
            category_items = self.data[
                (self.data['category_id'] == category) &
                (self.data['behavior_type'] == 'buy')
                ]

            if not category_items.empty:
                # 按购买量排序
                popular_items = category_items['item_id'].value_counts().head(5).index.tolist()
                recommendations.extend(popular_items)

        # 去重并排除用户已购买过的
        user_purchased = set(user_history[user_history['behavior_type'] == 'buy']['item_id'])
        recommendations = [item for item in set(recommendations) if item not in user_purchased]

        return recommendations[:n_recommendations]

    def hybrid_recommend(self, user_id, n_recommendations=10, cf_weight=0.6, cb_weight=0.4):
        '''混合推荐'''
        cf_items = self.collaborative_filtering_recommend(user_id, n_recommendations)
        cb_items = self.content_based_recommend(user_id, n_recommendations)

        # 合并推荐结果
        all_items = set(cf_items + cb_items)

        if not all_items:
            return []

        # 计算混合得分
        scores = {}
        for item in all_items:
            cf_score = 1.0 if item in cf_items else 0.0
            cb_score = 1.0 if item in cb_items else 0.0
            scores[item] = cf_score * cf_weight + cb_score * cb_weight

        # 按得分排序
        sorted_items = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        return [item for item, score in sorted_items[:n_recommendations]]
