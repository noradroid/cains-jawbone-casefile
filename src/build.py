"""Rebuild index.html: split the book text into 100 pages and inline them into the template.
Usage: python3 src/build.py "path/to/Cain's Jawbone Unformatted.txt"
"""
import json, re, sys, pathlib
here = pathlib.Path(__file__).parent
text = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig').replace('\r\n', '\n')
pages = [re.sub(r'\n{2,}', '\n', p.strip()) for p in re.split(r'\n*_{5,}\n*', text) if p.strip()]
assert len(pages) == 100, f'expected 100 pages, got {len(pages)}'
js = json.dumps(pages, ensure_ascii=False).replace('</', '<\\/')
(here.parent / 'index.html').write_text((here / 'template.html').read_text().replace('__PAGES__', js), encoding='utf-8')
print('wrote index.html')
