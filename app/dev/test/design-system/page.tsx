"use client"

import React from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const COLOR_TOKENS = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "muted",
  "muted-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
]

function parseCssColorToRgb(css: string): { r: number; g: number; b: number } | null {
  const v = css.trim()
  // rgb(...)
  const rgb = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i)
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] }
  // rgba(...)
  const rgba = v.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i)
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3] }
  // hex #rrggbb
  const hex = v.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  // hex #rrggbbaa -> include alpha by compositing against white (will be replaced later if we do true composite)
  const hexa = v.match(/^#([0-9a-f]{8})$/i)
  if (hexa) {
    const n = parseInt(hexa[1].slice(0, 6), 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  return null
}

// 新增：解析 RGBA（包含 alpha）
function parseCssColorToRgba(css: string): { r: number; g: number; b: number; a: number } | null {
  const v = css?.trim()
  if (!v) return null
  const rgba = v.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i)
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: Math.max(0, Math.min(1, +rgba[4])) }
  const rgb = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i)
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: 1 }
  const hex = v.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const hexa = v.match(/^#([0-9a-f]{8})$/i)
  if (hexa) {
    const n = parseInt(hexa[1].slice(0, 6), 16)
    const a = parseInt(hexa[1].slice(6, 8), 16) / 255
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a }
  }
  return null
}

function compositeOver(fg: { r: number; g: number; b: number; a: number }, bg: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  const a = Math.max(0, Math.min(1, fg.a))
  const inv = 1 - a
  return {
    r: Math.round(fg.r * a + bg.r * inv),
    g: Math.round(fg.g * a + bg.g * inv),
    b: Math.round(fg.b * a + bg.b * inv),
  }
}

function compositeCssOverBackground(tileCss: string, pageBgCss: string): { r: number; g: number; b: number } | null {
  const tile = parseCssColorToRgba(tileCss)
  const bg = parseCssColorToRgba(pageBgCss)
  if (!tile || !bg) return null
  if (tile.a >= 1) return { r: tile.r, g: tile.g, b: tile.b }
  return compositeOver(tile, { r: bg.r, g: bg.g, b: bg.b })
}

function rgbToCss({ r, g, b }: { r: number; g: number; b: number }) {
  return `rgb(${r}, ${g}, ${b})`
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const srgb = [r, g, b].map((c) => c / 255)
  const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function contrastRatio(a: string, b: string): number | null {
  const ca = parseCssColorToRgb(a)
  const cb = parseCssColorToRgb(b)
  if (!ca || !cb) return null
  const La = relativeLuminance(ca)
  const Lb = relativeLuminance(cb)
  const lighter = Math.max(La, Lb)
  const darker = Math.min(La, Lb)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  return Math.round(ratio * 100) / 100
}

// 计算文本色与“合成后的瓷砖背景色（tile over pageBg）”的对比度
function contrastTextOnTile(textCss: string, tileCss: string, pageBgCss: string): number | null {
  const eff = compositeCssOverBackground(tileCss, pageBgCss)
  if (!eff) return null
  return contrastRatio(textCss, rgbToCss(eff))
}


// 计算 tile（可能为透明色）与页面背景的对比度（用于 muted/border 等展示）
function tileVsPageContrast(tileCss: string, pageBgCss: string): number | null {
  const eff = compositeCssOverBackground(tileCss, pageBgCss)
  const bg = parseCssColorToRgba(pageBgCss)
  if (!eff || !bg) return null
  return contrastRatio(rgbToCss(eff), rgbToCss({ r: bg.r, g: bg.g, b: bg.b }))
}

function useCssVarValues(tokens: string[]) {
  const [values, setValues] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    const root = document.documentElement

    const read = () => {
      const styles = getComputedStyle(root)
      const result: Record<string, string> = {}
      tokens.forEach((t) => {
        result[t] = styles.getPropertyValue(`--${t}`).trim()
      })
      setValues(result)
    }

    read()
    // 监听主题切换（next-themes 会切换 html 的 class）
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [tokens])
  return values
}

function Swatch({ name, value }: { name: string; value: string }) {
  // 使用真实计算：读取色块真实背景（可含透明度）+ 在页面背景上合成，再计算文本对比度
  const tileRef = React.useRef<HTMLDivElement>(null)
  const [preferText, setPreferText] = React.useState<string>("text-foreground")

  React.useEffect(() => {
    const compute = () => {
      const root = document.documentElement
      const pageBg = getComputedStyle(root).getPropertyValue("--background").trim()
      const tileEl = tileRef.current
      if (!tileEl) return
      const tileBgCss = getComputedStyle(tileEl).backgroundColor // e.g. rgba(0,0,0,0.05)
      const eff = compositeCssOverBackground(tileBgCss, pageBg)
      if (!eff) return setPreferText("text-foreground")
      const effCss = rgbToCss(eff)
      const rb = contrastRatio("#000000", effCss) ?? 0
      const rw = contrastRatio("#ffffff", effCss) ?? 0
      setPreferText(rb >= rw ? "text-black" : "text-white")
    }

    compute()
    // 监听主题切换与变量变化
    const mo = new MutationObserver(compute)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [name, value])

  return (
    <div className="border rounded-md overflow-hidden">
      <div ref={tileRef} className="p-3 flex items-center justify-between" style={{ background: `var(--${name})` }}>
        <span className={cn("text-sm font-medium", preferText)}>--{name}</span>
        <span className="text-xs opacity-80 bg-background/60 px-2 py-0.5 rounded">{value || "(computed)"}</span>
      </div>
      <div className="p-3 text-sm text-muted-foreground">bg: var(--{name})</div>
    </div>
  )
}

function SurfaceExamples() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md p-4 bg-black/5 dark:bg-white/5 border">Surface · bg-black/5 · dark:bg-white/5</div>
      <div className="rounded-md p-4 border">Hairline · 使用变量 --border（浅黑10%/深白10%）</div>
    </div>
  )
}

function ButtonsShowcase() {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline" className="border-0 dark:border-transparent ring-0 focus-visible:ring-0 shadow-none outline-none bg-transparent">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button disabled>Disabled</Button>
    </div>
  )
}

function InputsShowcase() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="in1">默认</Label>
        <Input id="in1" placeholder="输入内容" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="in2">禁用</Label>
        <Input id="in2" placeholder="已禁用" disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ta1">Textarea</Label>
        <Textarea id="ta1" placeholder="多行文本…" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="in3">错误状态</Label>
        <Input id="in3" className="border-destructive focus-visible:ring-destructive" placeholder="无效输入" />
        <p className="text-sm text-destructive">请输入有效内容</p>
      </div>
    </div>
  )
}

function DropdownShowcase() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-0 dark:border-transparent ring-0 focus-visible:ring-0 shadow-none outline-none bg-transparent">打开下拉菜单</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>选项一</DropdownMenuItem>
        <DropdownMenuItem>选项二</DropdownMenuItem>
        <DropdownMenuItem>选项三</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CardsShowcase() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Card · 基本</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">使用 bg-background + 发丝线边框</p>
        </CardContent>
      </Card>
      <div className="rounded-xl border bg-black/5 dark:bg-white/5 p-6">
        <div className="font-medium mb-1">Panel · 表面层</div>
        <div className="text-sm text-muted-foreground">Surface 与 Hairline 组合</div>
      </div>
    </div>
  )
}

function TableShowcase() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>状态</TableHead>
          <TableHead className="text-right">数值</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-black/5 dark:hover:bg-white/5">
          <TableCell>Alpha</TableCell>
          <TableCell>正常</TableCell>
          <TableCell className="text-right">12</TableCell>
        </TableRow>
        <TableRow className="bg-black/10 dark:bg-white/10">
          <TableCell>Beta</TableCell>
          <TableCell>选中</TableCell>
          <TableCell className="text-right">8</TableCell>
        </TableRow>
        <TableRow className="hover:bg-black/5 dark:hover:bg-white/5">
          <TableCell>Gamma</TableCell>
          <TableCell>正常</TableCell>
          <TableCell className="text-right">27</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function FocusRingShowcase() {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <Button className="focus-visible:ring-2 ring-primary ring-offset-2">按钮焦点</Button>
      <Input className="focus-visible:ring-2 ring-primary ring-offset-2 w-56" placeholder="输入框焦点" />
      <Textarea className="focus-visible:ring-2 ring-primary ring-offset-2 w-72" placeholder="文本域焦点" />
    </div>
  )
}

export default function DesignSystemTestPage() {
  const values = useCssVarValues(COLOR_TOKENS)

  const primary = values["primary"]
  const background = values["background"]
  const foreground = values["foreground"]
  const primaryVsBackground = React.useMemo(() => (primary && background ? contrastRatio(primary, background) : null), [primary, background])
  const foregroundVsBackground = React.useMemo(() => (foreground && background ? contrastRatio(foreground, background) : null), [foreground, background])
  // 额外显示示例：muted/border 等透明色在页面背景上的真实对比度（便于调试）
  const mutedVsPage = React.useMemo(() => (values["muted"] && background ? tileVsPageContrast(values["muted"], background) : null), [values, background])
  const borderVsPage = React.useMemo(() => (values["border"] && background ? tileVsPageContrast(values["border"], background) : null), [values, background])

  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">设计系统测试 · 三色极简</h1>
          <p className="text-sm text-muted-foreground">验证深蓝 / 纯黑 / 纯白在浅色与深色模式下的显示与对比度</p>
        </div>
        <ThemeToggle />
      </header>

      {/* 配色展示 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">配色展示</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {COLOR_TOKENS.map((t) => (
            <Swatch key={t} name={t} value={values[t]} />
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>主要颜色对比度（AA 参考）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ background: `var(--primary)` }} />
              <span>primary vs background：</span>
              <b>{primaryVsBackground ?? "—"}</b>
              <span className="text-muted-foreground">（≥ 4.5 建议）</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ background: `var(--foreground)` }} />
              <span>foreground vs background：</span>
              <b>{foregroundVsBackground ?? "—"}</b>
              <span className="text-muted-foreground">（正文文本 ≥ 4.5）</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ background: `var(--muted)` }} />
              <span>muted vs page bg：</span>
              <b>{mutedVsPage ?? "—"}</b>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ background: `var(--border)` }} />
              <span>border vs page bg：</span>
              <b>{borderVsPage ?? "—"}</b>
            </div>
          </CardContent>
        </Card>
        <SurfaceExamples />
      </section>

      {/* 组件展示 */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold">组件样式展示</h2>
        <div className="space-y-4">
          <div className="rounded-xl border p-4">
            <h3 className="font-medium mb-2">Buttons</h3>
            <ButtonsShowcase />
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-medium mb-2">Inputs & Textarea</h3>
            <InputsShowcase />
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-medium mb-2">Dropdown / Menu</h3>
            <DropdownShowcase />
          </div>
          <div>
            <h3 className="font-medium mb-2">Card / Panel</h3>
            <CardsShowcase />
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-medium mb-2">Table</h3>
            <TableShowcase />
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-medium mb-2">统一焦点环（Focus Ring）</h3>
            <FocusRingShowcase />
          </div>
        </div>
      </section>

      <footer className="text-xs text-muted-foreground">
        按照 docs/设计规范-UI系统.md 实现。建议在明/暗模式下审视对比度，并以此页面为基线进行校准。
      </footer>
    </div>
  )
}

