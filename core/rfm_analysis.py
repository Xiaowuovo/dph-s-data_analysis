"""
RFM分析工具函数
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import json


def calculate_rfm_analysis(df, recency_col='last_purchase_date',
                           frequency_col='purchase_count',
                           monetary_col='total_spent',
                           recency_days=30, frequency_interval=7, monetary_interval=14):
    """
    计算RFM分析

    参数:
        df: 包含客户数据的DataFrame
        recency_col: 最近一次购买日期列名
        frequency_col: 购买频率列名
        monetary_col: 消费金额列名
        recency_days: 近度天数阈值
        frequency_interval: 频率间隔天数
        monetary_interval: 金额间隔

    返回:
        包含RFM分析结果的字典
    """
    try:
        # 数据预处理
        df = df.copy()

        # 计算RFM分数
        df['Recency_Score'] = calculate_recency_score(df[recency_col], recency_days)
        df['Frequency_Score'] = calculate_frequency_score(df[frequency_col], frequency_interval)
        df['Monetary_Score'] = calculate_monetary_score(df[monetary_col], monetary_interval)

        # 计算RFM总分
        df['RFM_Score'] = df['Recency_Score'] + df['Frequency_Score'] + df['Monetary_Score']

        # 客户分群
        df['Segment'] = segment_customers(df)

        # 计算统计指标
        stats = calculate_rfm_statistics(df)

        return {
            'success': True,
            'rfm_data': df.to_dict('records'),
            'statistics': stats,
            'segment_distribution': df['Segment'].value_counts().to_dict(),
            'total_customers': len(df)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def calculate_recency_score(recency_series, recency_days=30):
    """计算近度得分"""
    if isinstance(recency_series.iloc[0], str):
        recency_series = pd.to_datetime(recency_series)

    current_date = pd.Timestamp.now()
    days_since = (current_date - recency_series).dt.days

    # 5分制：天数越少分数越高
    scores = pd.cut(days_since,
                    bins=[-1, 7, 14, 30, 60, float('inf')],
                    labels=[5, 4, 3, 2, 1])
    return scores.astype(int)


def calculate_frequency_score(frequency_series, interval=7):
    """计算频率得分"""
    # 5分制：频率越高分数越高
    quantiles = frequency_series.quantile([0.2, 0.4, 0.6, 0.8, 1.0])
    scores = pd.cut(frequency_series,
                    bins=[-1] + quantiles.tolist(),
                    labels=[1, 2, 3, 4, 5])
    return scores.astype(int)


def calculate_monetary_score(monetary_series, interval=14):
    """计算金额得分"""
    # 5分制：金额越高分数越高
    quantiles = monetary_series.quantile([0.2, 0.4, 0.6, 0.8, 1.0])
    scores = pd.cut(monetary_series,
                    bins=[-1] + quantiles.tolist(),
                    labels=[1, 2, 3, 4, 5])
    return scores.astype(int)


def segment_customers(df):
    """客户分群"""
    segments = []

    for idx, row in df.iterrows():
        r = row['Recency_Score']
        f = row['Frequency_Score']
        m = row['Monetary_Score']

        if r >= 4 and f >= 4 and m >= 4:
            segments.append('Champion')
        elif r >= 3 and f >= 3 and m >= 3:
            segments.append('Loyal')
        elif r >= 4 and f <= 2 and m <= 2:
            segments.append('New')
        elif r <= 2 and f >= 3 and m >= 3:
            segments.append('At Risk')
        elif r <= 2 and f <= 2 and m <= 2:
            segments.append('Lost')
        elif r >= 3 and f <= 2 and m >= 3:
            segments.append('Potential')
        elif r <= 2 and f >= 3 and m <= 2:
            segments.append('Slipping Away')
        else:
            segments.append('Average')

    return segments


def calculate_rfm_statistics(df):
    """计算RFM统计指标"""
    return {
        'recency_mean': df['Recency_Score'].mean(),
        'frequency_mean': df['Frequency_Score'].mean(),
        'monetary_mean': df['Monetary_Score'].mean(),
        'rfm_mean': df['RFM_Score'].mean(),
        'total_customers': len(df),
        'segment_counts': df['Segment'].value_counts().to_dict()
    }


def generate_segment_insights(rfm_df, segment_name):
    """生成分群洞察"""
    segment_data = rfm_df[rfm_df['Segment'] == segment_name]

    if len(segment_data) == 0:
        return {
            'segment': segment_name,
            'customers': 0,
            'insights': [],
            'recommendations': []
        }

    insights = []
    recommendations = []

    # 分析洞察
    if segment_name == 'Champion':
        insights.append("高价值客户，复购率和消费金额都很高")
        insights.append("最近活跃，是公司最重要的客户群体")
        recommendations.append("提供VIP专属优惠")
        recommendations.append("邀请参与新品内测")
        recommendations.append("建立长期合作关系")

    elif segment_name == 'At Risk':
        insights.append("有流失风险的客户")
        insights.append("近期活跃度下降")
        recommendations.append("发送挽回优惠券")
        recommendations.append("进行客户满意度调查")
        recommendations.append("提供个性化复购激励")

    elif segment_name == 'Potential':
        insights.append("具有高潜力的客户")
        insights.append("消费能力强但频率不高")
        recommendations.append("推送关联产品推荐")
        recommendations.append("设计提升购买频率的活动")

    elif segment_name == 'Lost':
        insights.append("已流失的客户")
        insights.append("长时间未购买")
        recommendations.append("发送重新激活邮件")
        recommendations.append("提供回归专属优惠")

    return {
        'segment': segment_name,
        'customers': len(segment_data),
        'recency_avg': segment_data['Recency_Score'].mean(),
        'frequency_avg': segment_data['Frequency_Score'].mean(),
        'monetary_avg': segment_data['Monetary_Score'].mean(),
        'total_spent': segment_data['total_spent'].sum(),
        'avg_order_value': segment_data['total_spent'].mean() if len(segment_data) > 0 else 0,
        'insights': insights,
        'recommendations': recommendations
    }


def get_default_rfm_data():
    """获取默认RFM数据"""
    # 生成示例数据
    np.random.seed(42)
    n_customers = 100

    data = {
        'customer_id': [f'CUST{str(i).zfill(4)}' for i in range(1, n_customers + 1)],
        'last_purchase_date': [
            (datetime.now() - timedelta(days=np.random.randint(1, 90))).strftime('%Y-%m-%d')
            for _ in range(n_customers)
        ],
        'purchase_count': np.random.randint(1, 20, n_customers),
        'total_spent': np.random.uniform(100, 10000, n_customers).round(2)
    }

    df = pd.DataFrame(data)
    return calculate_rfm_analysis(df)


def calculate_complete_rfm_analysis(df):
    """计算完整的RFM分析"""
    # 计算基础RFM
    rfm_result = calculate_rfm_analysis(df)

    if not rfm_result['success']:
        return rfm_result

    rfm_df = pd.DataFrame(rfm_result['rfm_data'])

    # 计算矩阵数据
    matrix_data = prepare_rfm_matrix_data(rfm_df)

    # 计算分群分布
    segment_dist = prepare_segment_distribution(rfm_df)

    # 计算趋势数据
    trends = prepare_segment_trends(df, rfm_df)

    # 计算对比数据
    comparison = prepare_segment_comparison(rfm_df)

    return {
        'success': True,
        'rfm_data': rfm_result['rfm_data'],
        'statistics': rfm_result['statistics'],
        'matrix_data': matrix_data,
        'segment_distribution': segment_dist,
        'trends': trends,
        'segment_comparison': comparison,
        'segment_insights': {}
    }


def prepare_rfm_matrix_data(df):
    """准备RFM矩阵数据"""
    matrix = []
    scores = [1, 2, 3, 4, 5]

    for r in scores:
        for f in scores:
            for m in scores:
                segment_df = df[
                    (df['Recency_Score'] == r) &
                    (df['Frequency_Score'] == f) &
                    (df['Monetary_Score'] == m)
                    ]

                matrix.append({
                    'r_score': r,
                    'f_score': f,
                    'm_score': m,
                    'customers': len(segment_df),
                    'percentage': round(len(segment_df) / len(df) * 100, 2) if len(df) > 0 else 0,
                    'segment': segment_df['Segment'].iloc[0] if len(segment_df) > 0 else 'Unknown'
                })

    return matrix


def prepare_segment_distribution(df):
    """准备分群分布数据"""
    segment_counts = df['Segment'].value_counts()
    total_customers = len(df)

    distribution = []
    for segment, count in segment_counts.items():
        percentage = round(count / total_customers * 100, 2)

        # 获取分群特征
        segment_df = df[df['Segment'] == segment]
        avg_r = segment_df['Recency_Score'].mean()
        avg_f = segment_df['Frequency_Score'].mean()
        avg_m = segment_df['Monetary_Score'].mean()
        total_value = segment_df['total_spent'].sum()

        distribution.append({
            'segment': segment,
            'count': int(count),
            'percentage': percentage,
            'avg_recency': round(avg_r, 2) if not pd.isna(avg_r) else 0,
            'avg_frequency': round(avg_f, 2) if not pd.isna(avg_f) else 0,
            'avg_monetary': round(avg_m, 2) if not pd.isna(avg_m) else 0,
            'total_value': round(total_value, 2),
            'avg_value': round(total_value / count, 2) if count > 0 else 0
        })

    return sorted(distribution, key=lambda x: x['percentage'], reverse=True)


def prepare_segment_trends(df, rfm_df):
    """准备分群趋势数据"""
    # 这里可以根据时间序列数据生成趋势
    # 简化为返回静态数据
    return {
        'time_points': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        'champion_trend': [25, 28, 30, 32],
        'potential_trend': [30, 28, 25, 23],
        'at_risk_trend': [20, 22, 25, 28],
        'lost_trend': [25, 22, 20, 17]
    }


def prepare_segment_comparison(df):
    """准备分群对比数据"""
    segments = ['Champion', 'Potential', 'At Risk', 'Lost', 'Loyal', 'New', 'Slipping Away', 'Average']
    comparison = []

    for segment in segments:
        segment_df = df[df['Segment'] == segment]
        if len(segment_df) > 0:
            comparison.append({
                'segment': segment,
                'customer_count': len(segment_df),
                'avg_recency': round(segment_df['Recency_Score'].mean(), 2),
                'avg_frequency': round(segment_df['Frequency_Score'].mean(), 2),
                'avg_monetary': round(segment_df['Monetary_Score'].mean(), 2),
                'avg_rfm': round(segment_df['RFM_Score'].mean(), 2),
                'total_revenue': round(segment_df['total_spent'].sum(), 2),
                'avg_revenue': round(segment_df['total_spent'].mean(), 2)
            })

    return sorted(comparison, key=lambda x: x.get('customer_count', 0), reverse=True)[:8]
