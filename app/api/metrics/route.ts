import { NextRequest, NextResponse } from 'next/server'

// 重定向到统一的度量API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    
    // 转发到新的统一API
    const response = await fetch(new URL('/api/data/metrics', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  // 重定向到新API
  const url = new URL('/api/data/metrics', request.url)
  return NextResponse.redirect(url, 301)
}

