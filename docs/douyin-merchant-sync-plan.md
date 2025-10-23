## 抖音商家数据同步方案

### 1. 背景目标
- 将 TikHub API 返回的抖音主页/作品数据写入现有商家数据中心，保持数据库字段与前端展示逻辑对齐。
- 支持后续通过内部 API 自动化更新商家资料与作品列表，避免手工导入。
- 兼顾可维护性：优先复用现有映射与校验模块，减少重复劳动。

### 2. 现有数据流概览
- **映射层**：`lib/tikhub/mapper.ts:23` 将 `DouyinUserProfile` 转为 `Merchant`；`lib/tikhub/mapper.ts:64` 将单条 `DouyinVideo` 转成 `MerchantContent`，负责处理标签、时间戳、互动指标等字段。
- **同步服务**：`lib/tikhub/sync-service.ts:48` 的 `syncMerchantData` 完成 “拉取资料→Upsert 商家→分页同步视频→更新聚合统计” 的主流程。
- **数据库结构**：`prisma/schema.prisma:200` 定义商家表（以 `uid` 唯一标识，`contactInfo` JSON 存放 `sec_uid` 等信息）；`prisma/schema.prisma:234` 定义内容表（`externalId` 存 aweme_id，并记录点赞/评论/收藏/分享等指标）。
- **对外 API**：`app/api/tikhub/sync/route.ts:15` 暴露 POST 接口供管理员触发同步；`app/api/merchants` 系列接口用于查询结果数据。

### 3. 数据映射字段对齐
| 数据来源 | 目标字段 | 说明 |
| --- | --- | --- |
| `profile.uid` | `Merchant.uid` | 唯一键，用于 upsert |
| `profile.nickname` | `Merchant.name` | 商家名称 |
| `profile.signature` | `Merchant.description` | 简介 |
| `profile.ip_location / city / province` | `Merchant.location` | 位置信息，优先 IP |
| `profile.sec_uid` | `Merchant.contactInfo.sec_uid` | JSON 字段，后续同步视频需要 |
| `profile.total_favorited` / `profile.forward_count` | `Merchant.totalDiggCount` / `totalShareCount` | 初始聚合，后续由 `aggregateMerchantStats` 校正 |
| `video.aweme_id` | `MerchantContent.externalId` | 视频唯一标识 |
| `video.desc` | `MerchantContent.title` / `content` | 视频文案 |
| `video.statistics` 四指标 | `diggCount` / `commentCount` / `collectCount` / `shareCount` | 保留整数 |
| `video.create_time` | `publishedAt` / `externalCreatedAt` | 秒时间戳→Date |
| `video.text_extra` / `video.video_tag` | `tags` / `textExtra` | JSON 字符串存话题与标签 |

> 补充信息（播放地址、封面 URL、play_count 等）目前未入库存储，如有新需求需扩展 `mapVideoToMerchantContent` 与 Prisma 模型。

### 4. 推荐同步方案
1. **解析分享链接**  
   - 使用 `parseDouyinUserShare`（`lib/douyin/share-link.ts:39`）从抖音分享文案中提取 `sec_uid`；若返回 `userId` 同样支持。
2. **调用内部同步 API**  
   - 以管理员身份请求 `POST /api/tikhub/sync`，参数示例：  
     ```json
     {
       "sec_uid": "<从分享链接解析出的sec_uid>",
       "categoryId": "可选，商家分类ID",
       "businessType": "B2C",
       "maxVideos": 100
     }
     ```
   - 接口内部会实例化 `TikHubClient`，执行 `syncMerchantData`，并返回新旧视频增量统计。
3. **校验数据**  
   - 通过 `GET /api/merchants?search=<昵称>` 或 `GET /api/merchants/{id}` 查看商家详情；
   - 使用 `GET /api/merchants/{id}/contents` 验证作品列表，确认互动指标与文案落库正确。

### 5. 自定义脚本注意事项
若确需绕过 REST API 直接在脚本/任务中写库，请遵守以下原则：
- **复用映射方法**：直接调用 `mapUserProfileToMerchant`、`mapVideoToMerchantContent`，确保字段格式与 JSON 结构一致。
- **执行校验**：`validateMerchantData` 与 `validateContentData` 会检查必填项、数值合法性，避免脏数据写入。
- **聚合统计**：视频入库后需调用 `aggregateMerchantStats`（`lib/tikhub/mapper.ts:139`）更新商家总互动数，否则数据中心展示指标会失真。
- **节流与配额**：`TikHubClient.getAllUserVideos` 已带 500ms 分页间隔，外层批量同步时可复用 `batchSyncMerchants`（`lib/tikhub/sync-service.ts:208`），注意 TikHub API 额度。

### 6. 风险与限制
- TikHub API 需要有效的 `TIKHUB_API_KEY`，且按请求计费；批量同步前请确认配额。
- 解析短链依赖 Douyin 重定向，偶尔会触发风控，需要重试或更换代理头部（`lib/douyin/share-link.ts` 中已设置默认 UA）。
- 当前数据库仅存四个互动指标，若业务需要播放量、完播率等，需要调整 Prisma 模式并同步修改映射逻辑。
- Prisma 报错 “Unable to open the database file” 多出现在无 SQLite 文件的环境；线上环境应配置真实数据库或启用 PostgreSQL。

### 7. 建议的后续工作
1. 在运维脚本或外部服务中封装调用 `/api/tikhub/sync` 的调度逻辑，确保带上管理员身份。
2. 评估是否需要扩展 `MerchantContent` 字段以保存 `play_count` 等额外指标，如需要，更新 Prisma schema 与 `mapVideoToMerchantContent`。
3. 为同步流程增加监控或日志汇总（例如 TikHub 请求量、错误堆栈），便于排查 API 限流或数据异常。
4. 针对高价值商家，可在同步完成后触发二次处理（如调用 `parseDouyinVideoShare` 获取转录、生成摘要等），形成完整的数据运营链路。

---
> 文档维护：如 TikHub 或数据库模型变更，请同步更新此文档，保持字段映射与流程描述准确。
