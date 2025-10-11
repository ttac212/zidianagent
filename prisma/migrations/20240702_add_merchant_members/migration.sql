-- 商家成员表：管理用户与商家的访问关系

CREATE TABLE "merchant_members" (
  "id" TEXT PRIMARY KEY,
  "merchantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'EDITOR',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_members_role_chk" CHECK ("role" IN ('OWNER','EDITOR','VIEWER')),
  CONSTRAINT "merchant_members_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE,
  CONSTRAINT "merchant_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "merchant_member_unique"
  ON "merchant_members"("merchantId", "userId");

CREATE INDEX "merchant_member_user_idx"
  ON "merchant_members"("userId");
