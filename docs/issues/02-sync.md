# Issue 02：单账号同步

**优先级**：P0 | **类型**：AFK | **阻塞**：Issue 01

## 目标

实现微博数据抓取核心 + 同步流程。用户添加一个微博号（UID + Cookie），点击同步后系统自动抓取全部帖子并存到 SQLite。

## 用户故事

- US-01：作为用户，我希望能一键备份我所有的微博帖子
- US-05：作为用户，我希望能增量同步（只抓新帖子）

## 验收标准

- [ ] 账号页可添加账号：输入 UID + Cookie → 测试连接 → 显示昵称
- [ ] 测试连接失败时显示明确错误（Cookie 过期 / 网络错误）
- [ ] 同步页选择账号 → 开始同步 → 实时进度（当前页数、已抓取总数、新增数）
- [ ] 进度百分比和预估剩余时间
- [ ] 帖子按页抓取并 upsert 入库，不重复
- [ ] 首次全量同步：抓取该账号的全部历史微博
- [ ] 增量同步：第二次只抓 since_id 之后的新帖子
- [ ] 同步过程中可取消，已入库帖子保留
- [ ] 同步日志记录：开始/结束时间、耗时、抓取数、新增数、状态
- [ ] 同步历史列表（最近 50 条）
- [ ] Cookie 过期时显示明确错误提示，引导重新获取

## 技术要点

- `lib/weibo-fetcher.ts`：调用 `m.weibo.cn/api/container/getIndex`，since_id 游标分页
- 长文自动展开：`/statuses/extend`
- 速率限制：1.5s 间隔，最多重试 3 次
- 客户端驱动批处理：每次 Server Action 只抓 1 页（20 条），避免超时
- Mobile User-Agent + Referer 头

## 涉及文件

```
lib/weibo-fetcher.ts          — 微博 API 抓取 + 解析
app/sync/page.tsx             — 同步控制 UI
app/sync/actions.ts           — 同步 Server Actions
app/accounts/page.tsx         — 账号添加/列表
app/accounts/actions.ts       — 账号 CRUD + 测试连接
```