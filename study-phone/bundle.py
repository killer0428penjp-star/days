# 使い方: python3 bundle.py  → ../スマホ.html(アプリを全部中に入れた1ファイル)ができます
# サーバー無しで、ダブルクリックでも開けるのはこちらです。
import re,os
d=os.path.dirname(os.path.abspath(__file__))
s=open(d+'/index.html',encoding='utf-8').read()
def inline(m):
    body=open(d+'/'+m.group(1),encoding='utf-8').read()
    return '<template data-app="%s">\n%s\n</template>'%(m.group(2),body)
s,n=re.subn(r'<link rel="phone-app" href="(apps/([^"]+)\.html)">',inline,s)
open(d+'/../スマホ.html','w',encoding='utf-8').write(s)
print('OK',n,'apps ->',len(s),'bytes')