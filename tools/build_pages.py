"""Split the book text into 100 pages and write pages.json (an array of 100 strings, page 1 first).
Usage: python3 tools/build_pages.py "Cain's Jawbone Unformatted.txt"
Pages in the source are separated by a line of underscores (_____).
"""
import json, re, sys, pathlib
text = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig').replace('\r\n', '\n')
pages = [re.sub(r'\n{2,}', '\n', p.strip()) for p in re.split(r'\n*_{5,}\n*', text) if p.strip()]
assert len(pages) == 100, f'expected 100 pages, got {len(pages)}'
out = pathlib.Path(__file__).resolve().parent.parent / 'pages.json'
out.write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'wrote {out}')
