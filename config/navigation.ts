export type NavItem = {
  name: string
  href: string
}

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { name: "首页", href: "/" },
  { name: "创作工作台", href: "/workspace" },
  { name: "商家中心", href: "/merchants" },
  { name: "设置", href: "/settings" },
  { name: "ZenMux测试", href: "/zenmux-test" },
]

