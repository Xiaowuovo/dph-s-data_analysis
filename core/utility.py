import time
from datetime import datetime
import pandas as pd
import os


class Utility:
    @classmethod
    def get_cur_time(cls):
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())


'''字符串转日期格式'''


def parse_date_string(date_str, format='%Y-%m-%d'):
    date_obj = datetime.strptime(date_str, format)
    return date_obj


'''时间处理'''


def timestamp_to_datetime(timestamp):
    """将淘宝时间戳转换为datetime对象"""
    from datetime import datetime
    return datetime.fromtimestamp(timestamp)

def extract_time_features(datetime_obj):
    """提取时间特征：年、月、日、星期、小时等"""
    return {
        'year': datetime_obj.year,
        'month': datetime_obj.month,
        'day': datetime_obj.day,
        'weekday': datetime_obj.weekday(),  # 0=周一, 6=周日
        'hour': datetime_obj.hour,
        'is_weekend': datetime_obj.weekday() >= 5
    }


'''数据验证'''


def validate_taobao_data(df):
    """验证淘宝数据格式"""
    required_columns = ['user_id', 'item_id', 'category_id', 'behavior_type', 'timestamp']

    # 检查必需列
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"缺少必需列: {missing_cols}")

    # 验证行为类型
    valid_behaviors = ['pv', 'cart', 'fav', 'buy']
    invalid_behaviors = df[~df['behavior_type'].isin(valid_behaviors)]['behavior_type'].unique()
    if len(invalid_behaviors) > 0:
        raise ValueError(f"无效的行为类型: {invalid_behaviors}")

    return True


'''文件处理'''


def read_taobao_csv(file_path, sample_size=None):
    """读取淘宝CSV文件"""
    try:
        # 读取无表头的CSV
        df = pd.read_csv(file_path, header=None)
        df.columns = ['user_id', 'item_id', 'category_id', 'behavior_type', 'timestamp']

        # 可选：采样
        if sample_size and sample_size < len(df):
            df = df.sample(sample_size, random_state=42)

        return df
    except Exception as e:
        raise Exception(f"读取CSV文件失败: {str(e)}")


def save_analysis_result(result_data, filename, output_dir='results'):
    """保存分析结果"""
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, filename)

    if isinstance(result_data, pd.DataFrame):
        result_data.to_csv(filepath, index=False)
    else:
        import json
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)

    return filepath
