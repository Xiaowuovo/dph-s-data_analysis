# -*- coding: utf-8 -*-
"""电商消费者购物行为可视化系统 - 主启动文件"""
import os
import sys

# 解决Windows编码问题
if sys.platform == 'win32':
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 导入Flask应用
from core import app

if __name__ == '__main__':
    print("=" * 60)
    print("电商消费者购物行为可视化系统")
    print("=" * 60)
    print("项目根目录:", os.path.dirname(os.path.abspath(__file__)))
    print("模板目录:", os.path.abspath(app.template_folder))
    print("静态目录:", os.path.abspath(app.static_folder))
    print("=" * 60)
    print("访问地址: http://127.0.0.1:5001")
    print("API状态: http://127.0.0.1:5001/api/status")
    print("=" * 60)
    print("主要路由:")

    # 打印所有路由
    for rule in app.url_map.iter_rules():
        if rule.endpoint != 'static':
            print(f"  {rule.rule} -> {rule.endpoint}")

    print("=" * 60)

    app.run(host='127.0.0.1', port=5001, debug=True)
