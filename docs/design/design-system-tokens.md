## 设计系统 · 样式 Token 基准（Design System Tokens)

> 目标：用一套轻量、可复用的样式 Token 与约定，确保明/暗主题下的视觉一致性、良好可读性与可维护性。本页作为 UI 开发与代码评审的长期参考标准。

---

## 1. Token 总览（可直接在 Tailwind 类中使用）

- Surface（玻璃态基础底色）
  - 浅色：bg-black/5
  - 深色：dark:bg-white/5
  - 可与 backdrop-blur 搭配提升“玻璃感”

- Hairline（发丝线边框，1px 轻描边）
  - 浅色：border-black/10
  - 深色：dark:border-white/10

- Radius（圆角）
  - rounded-xl = 0.75rem
  - rounded-2xl = 1rem

- Motion（动效）
  - 过渡时长：duration-150（≈150ms）
  - 位移标准（用于按钮文案/菜单切换）：y: ±5px
  - 建议 easing：标准（默认）

- Placeholder（占位提示文案）
  - 默认：placeholder:text-foreground/70
  - 浅色若不够清晰：可提升至 placeholder:text-foreground/80

- 菜单组件（Dropdown/Menu 基线）
  - 背景：bg-gradient-to-b from-white via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800
  - 边框：border border-white/10（浅色下可按需统一为 border-black/10）
  - 圆角：rounded-xl
  - 最小宽度：min-w-[10rem]

---

## 2. 使用示例（类名组合）

- 玻璃卡片（空态、信息卡等）
```tsx
<div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 backdrop-blur shadow-sm" />
```

- 顶部工具栏 / Header（带底部分隔线）
```tsx
<header className="bg-black/5 dark:bg-white/5 backdrop-blur border-b border-black/10 dark:border-white/10" />
```

- 文本输入（Textarea / Input 占位符）
```tsx
<textarea className="bg-black/5 dark:bg-white/5 border-none rounded-xl placeholder:text-foreground/70 focus-visible:ring-0" />
```

- 菜单内容容器（DropdownMenuContent / SubContent）
```tsx
<div className="text-popover-foreground min-w-[10rem] rounded-xl border border-white/10 p-1 shadow-md bg-gradient-to-b from-white via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800 data-[state=open]:animate-in data-[state=closed]:animate-out" />
```

- 动效（按钮文案切换 / 菜单项进出）
```tsx
<motion.div initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:5}} transition={{duration:0.15}} />
```

---

## 3. 适用场景与组件映射

- ChatHeader
  - 背景：Surface（bg-black/5 dark:bg-white/5）+ backdrop-blur
  - 分隔：border-b（border-black/10 dark:border-white/10）
  - 按钮：ghost + hover:bg-black/10 dark:hover:bg-white/10

- ChatInput
  - 文本域容器：Surface + rounded-xl（上圆角）、placeholder:text-foreground/70
  - 工具条：rounded-b-xl + border-t（border-black/10 dark:border-white/10）

- MessageItem
  - AI 气泡：Surface + Hairline + rounded-2xl
  - 用户气泡：rounded-2xl（纯色主色背景）

- SmartChatCenterV2（空态）
  - 卡片：Surface + Hairline + rounded-2xl + backdrop-blur + shadow-sm

- Dropdown / 菜单
  - Content/SubContent：渐变背景 + Hairline + rounded-xl + min-w-[10rem]
  - 交互：data-[state] 动画 + 统一 150ms 体验

---

## 4. 明/暗主题对比说明

- 背景透明层（Surface）在明暗主题中颜色互换，保持 5% 透明度的轻覆盖，避免“脏灰”或强对比。
- Hairline 采取“浅色用黑、深色用白”的 10% 强度，既保证可见，又不过度抢眼。
- 占位符在两种主题下默认 /70 即可；在浅色极端场景可临时上调 /80，避免过淡。
- 阴影（shadow-sm）仅用于强调层次（如空态卡片），避免在大面积滚动区域叠加过多阴影。

---

## 5. 不要做什么（Anti‑patterns）

- 不要在浅色主题使用 border-white/10 作为主要 hairline（可见性不足）。
- 不要把阴影用作主要分隔手段；优先使用 Hairline（border-*-10）再轻量加 shadow-sm。
- 不要在同一组件内混用过多圆角半径（rounded-lg、rounded-xl、rounded-3xl 交替）。
- 不要把动画时长拉长到 >200ms 或叠加过多动画曲线；遵循 150ms 基线与 ±5px 位移。
- 不要在占位符上使用过低对比（如 /40 以下）导致可读性差。

---

## 6. 实施清单（给开发与评审）

- 明暗主题：是否正确使用了 Surface 与 Hairline 的主题化类？
- 圆角：是否遵循 rounded-xl / rounded-2xl？
- 菜单：是否满足“渐变 + hairline + rounded-xl + min-w-[10rem]”？
- 动效：是否在按钮文案/菜单切换采用 150ms、±5px？
- 占位符：是否统一为 placeholder:text-foreground/70（浅色不足时 /80）？
- 性能：blur 与阴影是否克制使用、长列表下无卡顿？

---

## 7. 代码片段速查（可粘贴）

- Surface + Hairline（卡片）
```html
<div class="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 backdrop-blur"></div>
```

- Header（底部分隔）
```html
<div class="bg-black/5 dark:bg-white/5 backdrop-blur border-b border-black/10 dark:border-white/10"></div>
```

- Textarea（占位符与无边框）
```html
<textarea class="bg-black/5 dark:bg-white/5 border-none rounded-xl placeholder:text-foreground/70 focus-visible:ring-0"></textarea>
```

- Dropdown（渐变 + hairline + rounded-xl + min-w）
```html
<div class="min-w-[10rem] rounded-xl border border-white/10 p-1 shadow-md bg-gradient-to-b from-white via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800"></div>
```

---

## 8. 扩展建议（可选）

- 抽象 CSS 变量（按需）：
```css
:root {
  --surface-light: rgba(0,0,0,0.05);
  --surface-dark: rgba(255,255,255,0.05);
  --hairline-light: rgba(0,0,0,0.10);
  --hairline-dark: rgba(255,255,255,0.10);
}
```

- Tailwind 组合工具类（@apply 示例）
```css
.card-glass { @apply bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl backdrop-blur; }
.menu-surface { @apply rounded-xl border border-white/10 min-w-[10rem] p-1 bg-gradient-to-b from-white via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800; }
.placeholder-default { @apply placeholder:text-foreground/70; }
```

---

## 9. 版本与来源
- 版本：v1.0（与“对话模块优化”阶段E对齐）
- 来源：从“对话模块优化进度跟踪.md”抽取并固化；后续如需扩展，将在本页增量维护。

