#!/usr/bin/env python3
import json
import re
import sys
from urllib.request import Request, urlopen

try:
    from lzstring import LZString
except ImportError:
    print('lzstring module required. Install with `python -m pip install --user lzstring`.', file=sys.stderr)
    sys.exit(1)

if len(sys.argv) != 2:
    print('Usage: zenmux_doc_fetch.py <lean.js url>', file=sys.stderr)
    sys.exit(1)

url = sys.argv[1]
req = Request(url, headers={"User-Agent": "Mozilla/5.0 CodexAgent"})
with urlopen(req) as resp:
    data = resp.read().decode('utf-8')

match = re.search(r"JSON.parse\('(.*)'\)", data, re.S)
if not match:
    print('Failed to locate JSON payload in lean file', file=sys.stderr)
    sys.exit(1)

payload = json.loads(match.group(1))
content = payload.get('content')
if not content:
    print('No content field found', file=sys.stderr)
    sys.exit(1)

text = LZString().decompressFromBase64(content)
sys.stdout.buffer.write(text.encode("utf-8", "surrogatepass"))
if not text.endswith("\n"):
    sys.stdout.buffer.write(b"\n")
