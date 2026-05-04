"""
图表数据生成工具函数
"""
# 移除未使用的导入
# import pandas as pd
# from datetime import datetime, timedelta
# import json
import numpy as np


def generate_chart_data_based_on_config(config):
    """
    根据配置生成图表数据

    参数:
        config: 图表配置字典

    返回:
        图表数据字典
    """
    try:
        chart_type = config.get('chart_type', 'bar')
        data_type = config.get('data_type', 'rfm')

        if data_type == 'rfm':
            return generate_rfm_chart_data(chart_type, config)
        elif data_type == 'customer':
            return generate_customer_chart_data(chart_type, config)
        elif data_type == 'sales':
            return generate_sales_chart_data(chart_type, config)
        else:
            return generate_default_chart_data(chart_type, config)

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'data': []
        }


def generate_rfm_chart_data(chart_type, config):
    """生成RFM图表数据"""
    np.random.seed(42)

    if chart_type == 'bar':
        # 生成分群分布柱状图数据
        segments = ['Champion', 'Loyal', 'Potential', 'At Risk', 'Lost', 'New', 'Average']
        data = {
            'labels': segments,
            'datasets': [{
                'label': '客户数量',
                'data': np.random.randint(10, 100, len(segments)).tolist(),
                'backgroundColor': [
                    '#28a745', '#17a2b8', '#ffc107',
                    '#fd7e14', '#6c757d', '#6610f2', '#e83e8c'
                ]
            }]
        }

    elif chart_type == 'pie':
        # 生成饼图数据
        segments = ['Champion', 'Potential', 'At Risk', 'Lost']
        data = {
            'labels': segments,
            'datasets': [{
                'data': [30, 25, 20, 25],
                'backgroundColor': ['#28a745', '#ffc107', '#fd7e14', '#6c757d']
            }]
        }

    elif chart_type == 'line':
        # 生成趋势线图数据
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
        data = {
            'labels': months,
            'datasets': [
                {
                    'label': '高价值客户',
                    'data': [20, 25, 30, 35, 40, 45],
                    'borderColor': '#28a745',
                    'fill': False
                },
                {
                    'label': '潜在客户',
                    'data': [40, 35, 30, 28, 25, 22],
                    'borderColor': '#ffc107',
                    'fill': False
                }
            ]
        }

    elif chart_type == 'radar':
        # 生成雷达图数据
        dimensions = ['购买频率', '消费金额', '最近购买', '客单价', '品类宽度']
        data = {
            'labels': dimensions,
            'datasets': [
                {
                    'label': '高价值客户',
                    'data': [4.8, 4.5, 4.9, 4.2, 4.0],
                    'borderColor': '#28a745',
                    'backgroundColor': 'rgba(40, 167, 69, 0.2)'
                },
                {
                    'label': '普通客户',
                    'data': [2.5, 2.0, 3.0, 1.8, 1.5],
                    'borderColor': '#6c757d',
                    'backgroundColor': 'rgba(108, 117, 125, 0.2)'
                }
            ]
        }

    else:
        # 默认柱状图
        return generate_rfm_chart_data('bar', config)

    return {
        'success': True,
        'chart_type': chart_type,
        'data': data
    }


def generate_customer_chart_data(chart_type, config):
    """生成客户分析图表数据"""
    # 如果后续需要pandas，可以重新添加导入
    # 当前使用numpy生成示例数据
    np.random.seed(42)

    if chart_type == 'bar':
        segments = ['新用户', '活跃用户', '沉默用户', '流失用户']
        data = {
            'labels': segments,
            'datasets': [{
                'label': '用户数量',
                'data': np.random.randint(20, 200, len(segments)).tolist(),
                'backgroundColor': ['#007bff', '#28a745', '#6c757d', '#dc3545']
            }]
        }
    else:
        return generate_rfm_chart_data(chart_type, config)

    return {
        'success': True,
        'chart_type': chart_type,
        'data': data
    }


def generate_sales_chart_data(chart_type, config):
    """生成销售分析图表数据"""
    np.random.seed(42)

    if chart_type == 'line':
        months = ['1月', '2月', '3月', '4月', '5月', '6月']
        data = {
            'labels': months,
            'datasets': [
                {
                    'label': '销售额',
                    'data': [120, 135, 142, 156, 168, 185],
                    'borderColor': '#007bff',
                    'backgroundColor': 'rgba(0, 123, 255, 0.1)',
                    'fill': True
                },
                {
                    'label': '订单数',
                    'data': [45, 52, 48, 60, 65, 72],
                    'borderColor': '#28a745',
                    'backgroundColor': 'rgba(40, 167, 69, 0.1)',
                    'fill': True
                }
            ]
        }
    else:
        return generate_rfm_chart_data(chart_type, config)

    return {
        'success': True,
        'chart_type': chart_type,
        'data': data
    }


def generate_default_chart_data(chart_type, config):
    """生成默认图表数据"""
    np.random.seed(42)

    if chart_type in ['bar', 'horizontalBar']:
        labels = [f'类别 {i + 1}' for i in range(6)]
        data = {
            'labels': labels,
            'datasets': [{
                'label': '数据值',
                'data': np.random.randint(10, 100, len(labels)).tolist(),
                'backgroundColor': '#007bff'
            }]
        }

    elif chart_type == 'line':
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
        data = {
            'labels': months,
            'datasets': [{
                'label': '趋势线',
                'data': np.random.randint(20, 80, len(months)).tolist(),
                'borderColor': '#007bff',
                'fill': False
            }]
        }

    elif chart_type == 'pie' or chart_type == 'doughnut':
        labels = ['类别A', '类别B', '类别C', '类别D']
        data = {
            'labels': labels,
            'datasets': [{
                'data': [25, 35, 20, 20],
                'backgroundColor': ['#007bff', '#28a745', '#ffc107', '#dc3545']
            }]
        }

    else:
        # 默认柱状图
        return generate_default_chart_data('bar', config)

    return {
        'success': True,
        'chart_type': chart_type,
        'data': data
    }
