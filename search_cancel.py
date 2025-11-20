import pathlib
pattern = "取消"
root = pathlib.Path('.')
for path in root.rglob('*'):
    if not path.is_file():
        continue
    if path.suffix.lower() not in {'.ts', '.tsx', '.js', '.jsx', '.tsv', '.mjs', '.cjs'}:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        continue
    if pattern in text:
        print(path)
