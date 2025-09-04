"use client"

import { SimpleChatTestComponent } from "@/components/chat/chat-test-simple"

export default function ChatTestPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4">
        <div className="h-[calc(100vh-2rem)]">
          <SimpleChatTestComponent />
        </div>
      </div>
    </div>
  )
}