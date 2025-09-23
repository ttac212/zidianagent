"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, X } from "lucide-react"
import { Navigation, type NavigationProps } from "@/components/navigation"
import type { NavItem } from "@/config/navigation"

interface MobileDrawerProps {
  children?: React.ReactNode
  navItems?: NavItem[]
  secondaryNavItems?: NavItem[]
}

export function MobileDrawer({ children, navItems, secondaryNavItems }: MobileDrawerProps) {
  const [open, setOpen] = useState(false)

  const handleItemClick: NavigationProps["onItemClick"] = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold">导航菜单</h2>
            <Button aria-label="关闭菜单" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 p-4 space-y-6">
            <Navigation items={navItems} orientation="vertical" activeMatch="startsWith" onItemClick={handleItemClick} />
            {secondaryNavItems && secondaryNavItems.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">工具与实验</p>
                <Navigation
                  items={secondaryNavItems}
                  orientation="vertical"
                  activeMatch="startsWith"
                  onItemClick={handleItemClick}
                  className="space-y-1"
                />
              </div>
            )}
            {children}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
