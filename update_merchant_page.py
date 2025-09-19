from pathlib import Path
import re
path = Path('app/merchants/[id]/page.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace("import { useState, useEffect } from 'react'", "import { useState, useEffect, useCallback } from 'react'")
text = text.replace('Card, CardContent, CardDescription, CardHeader, CardTitle', 'Card, CardContent, CardHeader, CardTitle')
text = text.replace("import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'\n", '')
for icon in ['  MapPin,\n', '  Filter,\n', '  ArrowUpDown,\n']:
    text = text.replace(icon, '')
text = text.replace("  const [contentTotal, setContentTotal] = useState(0)\n", '')
text = text.replace("        setContentTotal(data.total)\n", '')
# replace fetchMerchant function
pattern_merchant = re.compile(r"  const fetchMerchant = async \(\) => {\n[\s\S]*?  }\n", re.MULTILINE)
new_fetch_merchant = (
"  const fetchMerchant = useCallback(async () => {\n    if (!params.id) return\n\n    try {\n      setLoading(true)\n      const response = await fetch(`/api/merchants/${params.id}`)\n      const data = await response.json()\n\n      if (response.ok) {\n        setMerchant(data.merchant)\n        setContents(data.merchant.contents || [])\n      }\n    } catch (_error) {\n      // TODO: replace为统一错误处理\n    } finally {\n      setLoading(false)\n    }\n  }, [params.id])\n"
)
text = pattern_merchant.sub(new_fetch_merchant, text, count=1)
# replace fetchContents
pattern_contents = re.compile(r"  const fetchContents = async \(\) => {\n[\s\S]*?  }\n", re.MULTILINE)
new_fetch_contents = (
"  const fetchContents = useCallback(async () => {\n    if (!merchant?.id) return\n\n    try {\n      setContentLoading(true)\n      const queryParams = new URLSearchParams()\n\n      let apiSortBy = contentFilters.sortBy\n      if (contentFilters.sortBy == 'engagement' or contentFilters.sortBy == 'shareCount'):\n        pass\n    }
"
)
