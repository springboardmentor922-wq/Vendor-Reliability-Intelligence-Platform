import re

emoji_pattern = re.compile('[\U00010000-\U0010ffff\U00002600-\U000027BF\U0001F300-\U0001F9FF]', flags=re.UNICODE)

files_to_clean = [
    'views/dashboard.py',
    'auth/session.py',
    'views/vendor_categories.py',
    'views/performance.py',
    'views/analytics.py',
    'views/notifications.py',
    'views/profile.py',
    'views/register.py',
    'views/reports.py',
    'views/risk_analysis.py',
    'views/settings.py',
    'views/login.py',
    'components/tables.py',
]

for fpath in files_to_clean:
    try:
        content = open(fpath, 'r', encoding='utf-8').read()
        cleaned = emoji_pattern.sub('', content)
        open(fpath, 'w', encoding='utf-8').write(cleaned)
        remaining = sum(1 for line in cleaned.splitlines() if emoji_pattern.search(line))
        if remaining:
            print(f'  STILL HAS {remaining}: {fpath}')
        else:
            print(f'  CLEANED: {fpath}')
    except Exception as e:
        print(f'  ERR {fpath}: {e}')
print('Done.')
