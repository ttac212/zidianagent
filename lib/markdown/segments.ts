/**
 * Markdown 段落结构
 */
export interface MarkdownSegment {
  id: string
  level: number
  title: string
  content: string
  rawHeading: string
}

/**
 * 将 Markdown 字符串解析为段落数组
 */
export function parseMarkdownSegments(markdown: string): MarkdownSegment[] {
  if (!markdown || markdown.trim().length === 0) {
    return []
  }

  const lines = markdown.split("\n")
  const segments: MarkdownSegment[] = []
  let currentSegment: MarkdownSegment | null = null
  let segmentIdCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      if (currentSegment) {
        segments.push(currentSegment)
      }

      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      currentSegment = {
        id: `segment-${segmentIdCounter++}`,
        level,
        title,
        content: "",
        rawHeading: line
      }
    } else {
      if (currentSegment) {
        currentSegment.content += (currentSegment.content ? "\n" : "") + line
      } else if (line.trim()) {
        currentSegment = {
          id: `segment-${segmentIdCounter++}`,
          level: 0,
          title: "文档开头段落",
          content: line,
          rawHeading: ""
        }
      }
    }
  }

  if (currentSegment) {
    segments.push(currentSegment)
  }

  return segments
}

/**
 * 将段落数组合并回 Markdown 字符串
 */
export function mergeMarkdownSegments(segments: MarkdownSegment[]): string {
  return segments
    .map((segment) => {
      if (segment.level === 0) {
        return segment.content
      }
      const heading = segment.rawHeading
      const content = segment.content.trim()
      return content ? `${heading}\n${content}` : heading
    })
    .join("\n\n")
}
