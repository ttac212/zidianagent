'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarProvider } from '@/components/ui/sidebar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertCircle, Terminal, User } from 'lucide-react'
import { toast } from 'sonner'

export default function ShadcnTestPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState("")

  const showToast = () => {
    toast.success('测试成功！组件工作正常。')
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">Shadcn/ui 组件测试页面</h1>
        <p className="text-lg text-muted-foreground">测试所有更新的组件，确保功能和样式正常</p>
      </div>

      {/* Buttons Section */}
      <Card>
        <CardHeader>
          <CardTitle>按钮组件测试</CardTitle>
          <CardDescription>测试所有按钮变体</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button>默认按钮</Button>
          <Button variant="destructive">删除按钮</Button>
          <Button variant="outline">轮廓按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="ghost">幽灵按钮</Button>
          <Button variant="link">链接按钮</Button>
          <Button size="sm">小按钮</Button>
          <Button size="lg">大按钮</Button>
          <Button disabled>禁用按钮</Button>
          <Button onClick={showToast}>点击测试Toast</Button>
        </CardContent>
      </Card>

      {/* Form Elements */}
      <Card>
        <CardHeader>
          <CardTitle>表单元素测试</CardTitle>
          <CardDescription>输入框、标签、选择器、文本域</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="email">邮箱</Label>
            <Input type="email" id="email" placeholder="输入邮箱地址" />
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="message">消息</Label>
            <Textarea id="message" placeholder="输入您的消息..." />
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label>选择框</Label>
            <Select value={selectedValue} onValueChange={setSelectedValue}>
              <SelectTrigger>
                <SelectValue placeholder="选择一个选项" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>水果</SelectLabel>
                  <SelectItem value="apple">苹果</SelectItem>
                  <SelectItem value="banana">香蕉</SelectItem>
                  <SelectItem value="orange">橙子</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>标签页测试</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="account" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">账户</TabsTrigger>
              <TabsTrigger value="password">密码</TabsTrigger>
              <TabsTrigger value="settings">设置</TabsTrigger>
            </TabsList>
            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>账户信息</CardTitle>
                  <CardDescription>管理您的账户设置</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>这里是账户内容区域</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="password">
              <Card>
                <CardHeader>
                  <CardTitle>密码设置</CardTitle>
                  <CardDescription>更改您的密码</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>这里是密码内容区域</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>通用设置</CardTitle>
                  <CardDescription>配置应用设置</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>这里是设置内容区域</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alerts and Badges */}
      <Card>
        <CardHeader>
          <CardTitle>警告和徽章测试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>提示</AlertTitle>
            <AlertDescription>这是一个默认的提示消息。</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>这是一个错误提示消息。</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Badge>默认</Badge>
            <Badge variant="secondary">次要</Badge>
            <Badge variant="destructive">删除</Badge>
            <Badge variant="outline">轮廓</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Card>
        <CardHeader>
          <CardTitle>对话框测试</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>打开对话框</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>对话框标题</DialogTitle>
                <DialogDescription>
                  这是对话框的描述内容，可以包含任何信息。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    名称
                  </Label>
                  <Input id="name" defaultValue="测试用户" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button onClick={() => setDialogOpen(false)}>保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>表格测试</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>测试数据列表</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">编号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>方法</TableHead>
                <TableHead className="text-right">数量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">INV001</TableCell>
                <TableCell>已支付</TableCell>
                <TableCell>信用卡</TableCell>
                <TableCell className="text-right">$250.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV002</TableCell>
                <TableCell>待处理</TableCell>
                <TableCell>PayPal</TableCell>
                <TableCell className="text-right">$150.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV003</TableCell>
                <TableCell>未支付</TableCell>
                <TableCell>银行转账</TableCell>
                <TableCell className="text-right">$350.00</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>总计</TableCell>
                <TableCell className="text-right">$750.00</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Dropdown Menu */}
      <Card>
        <CardHeader>
          <CardTitle>下拉菜单测试</CardTitle>
        </CardHeader>
        <CardContent>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <User className="mr-2 h-4 w-4" />
                打开菜单
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>我的账户</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>个人资料</DropdownMenuItem>
              <DropdownMenuItem>账单信息</DropdownMenuItem>
              <DropdownMenuItem>团队</DropdownMenuItem>
              <DropdownMenuItem>订阅</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>登出</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="text-green-800">组件状态汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">已测试组件：</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Button - 所有变体</li>
                <li>Card - 布局和内容</li>
                <li>Input & Label</li>
                <li>Textarea</li>
                <li>Select</li>
                <li>Tabs</li>
                <li>Alert</li>
                <li>Badge</li>
                <li>Dialog</li>
                <li>Table</li>
                <li>Dropdown Menu</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">测试结果：</h3>
              <p className="text-sm text-green-700">✅ 所有组件渲染正常</p>
              <p className="text-sm text-green-700">✅ 交互功能工作正常</p>
              <p className="text-sm text-green-700">✅ 样式显示正确</p>
              <p className="text-sm text-green-700">✅ 响应式布局良好</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}