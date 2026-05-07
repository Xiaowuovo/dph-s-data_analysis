import pandas as pd, sys
for enc in ['gbk','gb18030','utf-8','utf-8-sig']:
    try:
        df = pd.read_csv(r'UserBehavior_2025.csv', encoding=enc, nrows=5)
        print('Encoding:', enc)
        print('Columns:', list(df.columns))
        print(df.to_string())
        print('\nTypes:', df.dtypes.to_dict())
        print('\nTotal rows:')
        df2 = pd.read_csv(r'UserBehavior_2025.csv', encoding=enc)
        print(len(df2))
        print('behavior_type values:', df2['行为类型'].value_counts().to_dict() if '行为类型' in df2.columns else df2.iloc[:,7].value_counts().to_dict())
        break
    except Exception as e:
        print(enc, 'err:', e)
