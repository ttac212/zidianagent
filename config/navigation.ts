export type NavItem = {
  name: string
  href: string
}

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { name: "首页", href: "/" },
  { name: "创作工作台", href: "/workspace" },
  { name: "商家中心", href: "/merchants" },
  { name: "文档", href: "/documents" },
  { name: "灵感库", href: "/inspiration" },
  { name: "反馈", href: "/feedback" },
  { name: "MCP测试", href: "/mcp-test" },
  { name: "设置", href: "/settings" },
]

