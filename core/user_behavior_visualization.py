# -*- coding: utf-8 -*-
"""淘宝用户行为数据可视化模块 - 完整实现版"""
from pyecharts.charts import Bar, Pie, Line, Radar, Funnel, Scatter, HeatMap, Gauge, Sunburst
from pyecharts import options as opts
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# ========== 用户画像相关图表 ==========
def create_user_profile_chart(user_stats):
    """创建用户画像图表"""
    if not user_stats:
        return None

    charts = {}
    try:
        # 1. 用户行为分布饼图
        if 'behavior_counts' in user_stats:
            behavior_data = [
                ("浏览(pv)", user_stats['behavior_counts'].get('pv', 0)),
                ("加购(cart)", user_stats['behavior_counts'].get('cart', 0)),
                ("收藏(fav)", user_stats['behavior_counts'].get('fav', 0)),
                ("购买(buy)", user_stats['behavior_counts'].get('buy', 0))
            ]
            behavior_pie = (
                Pie()
                .add("", behavior_data)
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="用户行为类型分布"),
                    legend_opts=opts.LegendOpts(orient="vertical", pos_left="left")
                )
                .set_series_opts(label_opts=opts.LabelOpts(formatter="{b}: {c} ({d}%)"))
            )
            charts['behavior_pie'] = behavior_pie.dump_options()

        # 2. 用户活跃度指标仪表盘
        if all(key in user_stats for key in ['total_actions', 'total_purchases', 'active_days', 'purchase_rate']):
            gauge_data = [
                ("总行为数", user_stats['total_actions']),
                ("总购买数", user_stats['total_purchases']),
                ("活跃天数", user_stats['active_days']),
                ("购买转化率(%)", round(user_stats['purchase_rate'], 2))
            ]

            # 创建多个仪表盘
            for i, (name, value) in enumerate(gauge_data[:3]):
                gauge = (
                    Gauge()
                    .add(name, [(name, value)])
                    .set_global_opts(title_opts=opts.TitleOpts(title=name))
                )
                charts[f'gauge_{i}'] = gauge.dump_options()

    except Exception as e:
        print(f"创建用户画像图表时出错: {e}")

    return charts

def create_gender_distribution_chart(gender_data):
    """创建性别分布图表"""
    if not gender_data or gender_data.empty:
        return None

    try:
        pie = (
            Pie()
            .add("性别分布",
                 [list(z) for z in zip(gender_data.index, gender_data.values)])
            .set_global_opts(
                title_opts=opts.TitleOpts(title="用户性别分布"),
                legend_opts=opts.LegendOpts(pos_left="left")
            )
            .set_series_opts(label_opts=opts.LabelOpts(formatter="{b}: {c} ({d}%)"))
        )
        return pie.dump_options()
    except Exception as e:
        print(f"创建性别分布图表时出错: {e}")
        return None

def create_age_distribution_chart(age_data):
    """创建年龄分布图表"""
    if not age_data or age_data.empty:
        return None

    try:
        bar = (
            Bar()
            .add_xaxis(age_data.index.tolist())
            .add_yaxis("用户数", age_data.values.tolist(),
                      itemstyle_opts=opts.ItemStyleOpts(color="#5470c6"))
            .set_global_opts(
                title_opts=opts.TitleOpts(title="用户年龄分布"),
                xaxis_opts=opts.AxisOpts(name="年龄段"),
                yaxis_opts=opts.AxisOpts(name="用户数量")
            )
        )
        return bar.dump_options()
    except Exception as e:
        print(f"创建年龄分布图表时出错: {e}")
        return None

# ========== 购买行为相关图表 ==========
def create_purchase_behavior_chart(behavior_stats):
    """创建购买行为图表"""
    if not behavior_stats:
        return {}

    charts = {}
    try:
        # 1. 转化漏斗图
        if all(key in behavior_stats for key in ['pv_count', 'cart_count', 'fav_count', 'buy_count']):
            funnel_data = [
                ("浏览", behavior_stats['pv_count']),
                ("加购", behavior_stats['cart_count']),
                ("收藏", behavior_stats['fav_count']),
                ("购买", behavior_stats['buy_count'])
            ]
            funnel = (
                Funnel()
                .add("转化漏斗", funnel_data)
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="用户行为转化漏斗"),
                    legend_opts=opts.LegendOpts(is_show=False)
                )
                .set_series_opts(label_opts=opts.LabelOpts(formatter="{b}: {c}"))
            )
            charts['conversion_funnel'] = funnel.dump_options()

        # 2. 购买行为时间分布
        if 'hourly_distribution' in behavior_stats:
            hours = list(range(24))
            hour_values = [behavior_stats['hourly_distribution'].get(hour, 0) for hour in hours]
            time_bar = (
                Bar()
                .add_xaxis([f"{h}:00" for h in hours])
                .add_yaxis("行为数量", hour_values)
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="用户行为时间分布"),
                    xaxis_opts=opts.AxisOpts(
                        name="时间",
                        axislabel_opts=opts.LabelOpts(rotate=45)
                    ),
                    yaxis_opts=opts.AxisOpts(name="行为数量")
                )
            )
            charts['time_distribution'] = time_bar.dump_options()

    except Exception as e:
        print(f"创建购买行为图表时出错: {e}")

    return charts

def create_purchase_pattern_chart(pattern_data):
    """创建购买模式图表"""
    if not pattern_data or pattern_data.empty:
        return None

    try:
        # 分析购买模式（如工作日/周末、时间段等）
        if 'hour_pattern' in pattern_data.columns:
            line = (
                Line()
                .add_xaxis(list(range(24)))
                .add_yaxis("购买量", pattern_data['hour_pattern'].tolist(),
                          is_smooth=True, symbol="circle", symbol_size=8)
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="24小时购买模式"),
                    xaxis_opts=opts.AxisOpts(name="小时", type_="category"),
                    yaxis_opts=opts.AxisOpts(name="购买量"),
                    tooltip_opts=opts.TooltipOpts(trigger="axis")
                )
            )
            return line.dump_options()
    except Exception as e:
        print(f"创建购买模式图表时出错: {e}")

    return None

def create_time_pattern_chart(time_data):
    """创建时间模式图表"""
    if not time_data or time_data.empty:
        return None

    try:
        # 周内购买模式
        if 'weekday_pattern' in time_data.columns:
            weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
            bar = (
                Bar()
                .add_xaxis(weekdays)
                .add_yaxis("购买量", time_data['weekday_pattern'].tolist(),
                          itemstyle_opts=opts.ItemStyleOpts(color="#91cc75"))
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="周内购买模式"),
                    xaxis_opts=opts.AxisOpts(name="星期"),
                    yaxis_opts=opts.AxisOpts(name="购买量")
                )
            )
            return bar.dump_options()
    except Exception as e:
        print(f"创建时间模式图表时出错: {e}")

    return None

# ========== 用户分群相关图表 ==========
def create_user_segment_chart(segment_data):
    """创建用户分群图表"""
    if not segment_data or segment_data.empty:
        return None

    try:
        # RFM分群饼图
        if 'segment' in segment_data.columns and 'count' in segment_data.columns:
            pie = (
                Pie()
                .add("用户分群",
                     [list(z) for z in zip(segment_data['segment'], segment_data['count'])])
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="用户价值分群"),
                    legend_opts=opts.LegendOpts(orient="vertical", pos_left="left")
                )
                .set_series_opts(label_opts=opts.LabelOpts(formatter="{b}: {c} ({d}%)"))
            )
            return pie.dump_options()
    except Exception as e:
        print(f"创建用户分群图表时出错: {e}")

    return None

def create_behavior_trend_chart(trend_data):
    """创建行为趋势图表"""
    if trend_data.empty or 'date' not in trend_data.columns:
        return {}

    charts = {}
    try:
        # 1. 行为趋势折线图
        dates = trend_data['date'].tolist()
        trend_line = Line().add_xaxis(dates)

        # 添加各行为类型的趋势线
        if 'pv_count' in trend_data.columns:
            trend_line.add_yaxis("浏览量", trend_data['pv_count'].tolist(),
                                is_smooth=True, linestyle_opts=opts.LineStyleOpts(width=3))
        if 'cart_count' in trend_data.columns:
            trend_line.add_yaxis("加购量", trend_data['cart_count'].tolist(),
                                is_smooth=True, linestyle_opts=opts.LineStyleOpts(width=3))
        if 'fav_count' in trend_data.columns:
            trend_line.add_yaxis("收藏量", trend_data['fav_count'].tolist(),
                                is_smooth=True, linestyle_opts=opts.LineStyleOpts(width=3))
        if 'buy_count' in trend_data.columns:
            trend_line.add_yaxis("购买量", trend_data['buy_count'].tolist(),
                                is_smooth=True, linestyle_opts=opts.LineStyleOpts(width=3))

        trend_line.set_global_opts(
            title_opts=opts.TitleOpts(title="用户行为趋势分析"),
            xaxis_opts=opts.AxisOpts(
                name="日期",
                axislabel_opts=opts.LabelOpts(rotate=45)
            ),
            yaxis_opts=opts.AxisOpts(name="行为数量"),
            tooltip_opts=opts.TooltipOpts(trigger="axis"),
            datazoom_opts=[opts.DataZoomOpts()]
        )
        charts['trend_line'] = trend_line.dump_options()

        # 2. 转化率趋势图
        if all(col in trend_data.columns for col in ['buy_count', 'pv_count']):
            trend_data['conversion_rate'] = (trend_data['buy_count'] / trend_data['pv_count'] * 100).round(2)
            conversion_line = (
                Line()
                .add_xaxis(dates)
                .add_yaxis("转化率(%)", trend_data['conversion_rate'].tolist(),
                          is_smooth=True, linestyle_opts=opts.LineStyleOpts(width=3, type_="dashed"))
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="转化率趋势分析"),
                    xaxis_opts=opts.AxisOpts(
                        name="日期",
                        axislabel_opts=opts.LabelOpts(rotate=45)
                    ),
                    yaxis_opts=opts.AxisOpts(name="转化率(%)")
                )
            )
            charts['conversion_trend'] = conversion_line.dump_options()

    except Exception as e:
        print(f"创建趋势图表时出错: {e}")

    return charts

# ========== 品类分析相关图表 ==========
def create_category_preference_chart(category_data):
    """创建品类偏好图表"""
    if not category_data or 'category_id' not in category_data.columns:
        return {}

    charts = {}
    try:
        # 1. 热门品类排行
        if 'total_views' in category_data.columns:
            top_categories = category_data.sort_values('total_views', ascending=False).head(10)
            category_bar = (
                Bar()
                .add_xaxis(top_categories['category_id'].astype(str).tolist())
                .add_yaxis("浏览量", top_categories['total_views'].tolist(),
                          itemstyle_opts=opts.ItemStyleOpts(color="#fac858"))
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="热门品类浏览量TOP10"),
                    xaxis_opts=opts.AxisOpts(axislabel_opts=opts.LabelOpts(rotate=45)),
                    yaxis_opts=opts.AxisOpts(name="浏览量")
                )
            )
            charts['category_views'] = category_bar.dump_options()

        # 2. 品类转化率
        if all(col in category_data.columns for col in ['total_views', 'total_purchases']):
            category_data['conversion_rate'] = (
                category_data['total_purchases'] / category_data['total_views'] * 100
            ).round(2)
            top_conversion = category_data.nlargest(10, 'conversion_rate')

            conversion_bar = (
                Bar()
                .add_xaxis(top_conversion['category_id'].astype(str).tolist())
                .add_yaxis("转化率(%)", top_conversion['conversion_rate'].tolist(),
                          itemstyle_opts=opts.ItemStyleOpts(color="#ee6666"))
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="品类转化率TOP10"),
                    xaxis_opts=opts.AxisOpts(axislabel_opts=opts.LabelOpts(rotate=45)),
                    yaxis_opts=opts.AxisOpts(name="转化率(%)")
                )
            )
            charts['category_conversion'] = conversion_bar.dump_options()

    except Exception as e:
        print(f"创建品类分析图表时出错: {e}")

    return charts

# ========== 转化分析相关图表 ==========
def create_conversion_funnel_chart(funnel_data):
    """创建转化漏斗图表"""
    if not funnel_data or funnel_data.empty:
        return None

    try:
        funnel = (
            Funnel()
            .add("转化漏斗",
                 [list(z) for z in zip(funnel_data.index, funnel_data.values)])
            .set_global_opts(
                title_opts=opts.TitleOpts(title="用户转化漏斗分析"),
                legend_opts=opts.LegendOpts(is_show=False)
            )
            .set_series_opts(
                label_opts=opts.LabelOpts(formatter="{b}: {c}"),
                tooltip_opts=opts.TooltipOpts(formatter="{b}: {c} ({d}%)")
            )
        )
        return funnel.dump_options()
    except Exception as e:
        print(f"创建转化漏斗图表时出错: {e}")
        return None

# ========== RFM分析相关图表 ==========
def create_rfm_analysis_chart(rfm_data):
    """创建RFM分析图表"""
    if not rfm_data or 'segment' not in rfm_data.columns:
        return None

    try:
        # RFM分群饼图
        pie = (
            Pie()
            .add("RFM分群",
                 [list(z) for z in zip(rfm_data['segment'], rfm_data['count'])])
            .set_global_opts(
                title_opts=opts.TitleOpts(title="用户价值分群(RFM分析)"),
                legend_opts=opts.LegendOpts(orient="vertical", pos_left="left")
            )
            .set_series_opts(label_opts=opts.LabelOpts(formatter="{b}: {c} ({d}%)"))
        )
        return pie.dump_options()
    except Exception as e:
        print(f"创建RFM分析图时出错: {e}")
        return None

# ========== 热门商品分析 ==========
def create_hot_items_chart(hot_items):
    """创建热门商品图表"""
    if not hot_items or hot_items.empty:
        return None

    try:
        # 热门商品TOP20
        top_items = hot_items.head(20)
        bar = (
            Bar()
            .add_xaxis(top_items.index.tolist())
            .add_yaxis("热度", top_items.values.tolist(),
                      itemstyle_opts=opts.ItemStyleOpts(color="#73c0de"))
            .reversal_axis()
            .set_global_opts(
                title_opts=opts.TitleOpts(title="热门商品TOP20"),
                xaxis_opts=opts.AxisOpts(name="热度指数"),
                yaxis_opts=opts.AxisOpts(
                    name="商品ID",
                    axislabel_opts=opts.LabelOpts(font_size=10)
                )
            )
        )
        return bar.dump_options()
    except Exception as e:
        print(f"创建热门商品图表时出错: {e}")
        return None

# ========== 关键指标图表 ==========
def create_key_metrics_chart(key_metrics):
    """创建关键指标图表"""
    if not key_metrics:
        return None

    try:
        # 使用仪表盘展示关键指标
        metrics = [
            ("总用户数", key_metrics.get('total_users', 0), 10000),
            ("总商品数", key_metrics.get('total_items', 0), 50000),
            ("总行为数", key_metrics.get('total_actions', 0), 100000),
            ("转化率(%)", key_metrics.get('conversion_rate', 0), 100)
        ]

        charts = {}
        for i, (name, value, max_val) in enumerate(metrics):
            gauge = (
                Gauge()
                .add(
                    series_name=name,
                    data_pair=[(name, value)],
                    min_=0,
                    max_=max_val,
                    axisline_opts=opts.AxisLineOpts(
                        linestyle_opts=opts.LineStyleOpts(
                            color=[(0.3, "#67e0e3"), (0.7, "#37a2da"), (1, "#fd666d")],
                            width=30
                        )
                    )
                )
                .set_global_opts(
                    title_opts=opts.TitleOpts(title=name, pos_left="center"),
                    legend_opts=opts.LegendOpts(is_show=False)
                )
            )
            charts[f'metric_{i}'] = gauge.dump_options()

        return charts
    except Exception as e:
        print(f"创建关键指标图表时出错: {e}")
        return None

# ========== 看板相关图表 ==========
def create_dashboard_trend_chart(trend_data):
    """创建看板趋势图表"""
    if trend_data.empty or 'date' not in trend_data.columns:
        return None

    try:
        # 综合趋势图
        dates = trend_data['date'].tolist()
        line = (
            Line()
            .add_xaxis(dates)
        )

        # 添加关键指标趋势线
        if 'daily_active_users' in trend_data.columns:
            line.add_yaxis("日活用户", trend_data['daily_active_users'].tolist(),
                          is_smooth=True, symbol="circle", symbol_size=4)
        if 'daily_orders' in trend_data.columns:
            line.add_yaxis("日订单数", trend_data['daily_orders'].tolist(),
                          is_smooth=True, symbol="circle", symbol_size=4)
        if 'daily_revenue' in trend_data.columns:
            line.add_yaxis("日收入", trend_data['daily_revenue'].tolist(),
                          is_smooth=True, symbol="circle", symbol_size=4)

        line.set_global_opts(
            title_opts=opts.TitleOpts(title="关键指标趋势"),
            xaxis_opts=opts.AxisOpts(
                name="日期",
                axislabel_opts=opts.LabelOpts(rotate=45)
            ),
            yaxis_opts=opts.AxisOpts(name="数值"),
            tooltip_opts=opts.TooltipOpts(trigger="axis"),
            datazoom_opts=[opts.DataZoomOpts()],
            legend_opts=opts.LegendOpts(pos_top="5%")
        )
        return line.dump_options()
    except Exception as e:
        print(f"创建看板趋势图表时出错: {e}")
        return None

def create_dashboard_segment_chart(segment_data):
    """创建看板分群图表"""
    if not segment_data or segment_data.empty:
        return None

    try:
        # 用户分群旭日图
        if 'segment' in segment_data.columns and 'value' in segment_data.columns:
            sunburst_data = []
            for _, row in segment_data.iterrows():
                sunburst_data.append({
                    "name": row['segment'],
                    "value": row['value']
                })

            sunburst = (
                Sunburst()
                .add(
                    series_name="用户分群",
                    data_pair=sunburst_data,
                    radius=["0%", "90%"],
                    highlight_policy="ancestor",
                    levels=[
                        opts.SunburstLevelsOpts(
                            r0="0%",
                            r="25%",
                            itemstyle_opts=opts.ItemStyleOpts(border_width=2)
                        ),
                        opts.SunburstLevelsOpts(
                            r0="25%",
                            r="60%"
                        ),
                        opts.SunburstLevelsOpts(
                            r0="60%",
                            r="80%"
                        )
                    ]
                )
                .set_global_opts(
                    title_opts=opts.TitleOpts(title="用户价值分群"),
                    tooltip_opts=opts.TooltipOpts(formatter="{b}: {c}")
                )
                .set_series_opts(
                    label_opts=opts.LabelOpts(formatter="{b}")
                )
            )
            return sunburst.dump_options()
    except Exception as e:
        print(f"创建看板分群图表时出错: {e}")

    return None

# ========== 用户留存分析 ==========
def create_user_retention_chart(retention_data):
    """创建用户留存率图表"""
    if not retention_data or 'day' not in retention_data.columns:
        return None

    try:
        # 创建留存率热力图
        days = retention_data['day'].tolist()
        retention_matrix = []
        for i, day in enumerate(days):
            row = []
            for j, day2 in enumerate(days):
                if j >= i:
                    retention_rate = retention_data.iloc[i, j+1] if j+1 < len(retention_data.columns) else 0
                    row.append(retention_rate)
                else:
                    row.append(None)
            retention_matrix.append(row)

        heatmap = (
            HeatMap()
            .add_xaxis([f"第{d}天" for d in range(len(days))])
            .add_yaxis("留存率", [f"第{d}天" for d in range(len(days))], retention_matrix)
            .set_global_opts(
                title_opts=opts.TitleOpts(title="用户留存率热力图"),
                visualmap_opts=opts.VisualMapOpts(
                    min_=0, max_=100, is_calculable=True,
                    orient="horizontal", pos_left="center", pos_top="top"
                ),
                xaxis_opts=opts.AxisOpts(
                    axislabel_opts=opts.LabelOpts(rotate=45)
                )
            )
        )
        return heatmap.dump_options()
    except Exception as e:
        print(f"创建用户留存率图表时出错: {e}")
        return None

# ========== 推荐质量评估 ==========
def create_recommendation_quality_chart(recommendation_results):
    """创建推荐质量评估图表"""
    if not recommendation_results:
        return {}

    charts = {}
    try:
        # 推荐质量雷达图
        if all(key in recommendation_results for key in ['precision', 'recall', 'f1_score', 'coverage', 'diversity']):
            radar_data = [
                ("准确率", recommendation_results['precision'] * 100),
                ("召回率", recommendation_results['recall'] * 100),
                ("F1分数", recommendation_results['f1_score'] * 100),
                ("覆盖率", recommendation_results['coverage'] * 100),
                ("多样性", recommendation_results['diversity'] * 100)
            ]

            radar = (
                Radar()
                .add_schema(
                    schema=[
                        opts.RadarIndicatorItem(name="准确率", max_=100),
                        opts.RadarIndicatorItem(name="召回率", max_=100),
                        opts.RadarIndicatorItem(name="F1分数", max_=100),
                        opts.RadarIndicatorItem(name="覆盖率", max_=100),
                        opts.RadarIndicatorItem(name="多样性", max_=100)
                    ]
                )
                .add("推荐质量", [radar_data])
                .set_series_opts(label_opts=opts.LabelOpts(is_show=False))
                .set_global_opts(title_opts=opts.TitleOpts(title="推荐质量评估"))
            )
            charts['recommendation_quality'] = radar.dump_options()

    except Exception as e:
        print(f"创建推荐质量图表时出错: {e}")

    return charts
