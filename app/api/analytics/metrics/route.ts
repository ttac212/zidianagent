import { type NextRequest, NextResponse } from "next/server"

// 重定向到统一的度量API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const enrichedBody = {
      ...body,
      type: 'metric'
    }
    
    // 转发到新的统一API
    const response = await fetch(new URL('/api/data/metrics', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(enrichedBody)
    })
    
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json({ success: false, error: "记录指标失败" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // 构建新的URL，添加type参数
  const url = new URL('/api/data/metrics', request.url)
  url.searchParams.set('type', 'metric')
  
  // 复制原有参数
  const { searchParams } = new URL(request.url)
  searchParams.forEach((value, key) => {
    if (key !== 'type') {
      url.searchParams.set(key, value)
    }
  })
  
  // 重定向到新API
  return NextResponse.redirect(url, 301)
}
