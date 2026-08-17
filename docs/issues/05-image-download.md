# Issue 05：图片下载

**优先级**：P1 | **类型**：AFK | **阻塞**：Issue 02

## 目标

从微博 CDN 下载帖子图片到本地 `public/uploads/weibo/`，在浏览页和随机刷中显示本地图片。与同步分离，独立触发下载任务。

## 用户故事

- US-07：作为用户，我希望备份的微博图片也能存到本地

## 验收标准

- [ ] 同步时自动记录图片 URL 到 `weibo_images` 表
- [ ] 「下载图片」按钮：批量下载所有未下载的图片
- [ ] 图片保存到 `public/uploads/weibo/<weibo_id>_<index>.<ext>`
- [ ] 下载进度：已完成 N / 总数 M
- [ ] 帖子浏览页和随机刷自动使用本地图片（本地存在时优先本地）
- [ ] 本地图片不存在时回退到微博 CDN URL
- [ ] 下载失败的图片标记 `fetched = -1`，可点击重试
- [ ] 图片服务：本地图片可通过 `/uploads/weibo/...` 访问

## 涉及文件

```
lib/weibo-image-downloader.ts  — 图片下载工具
app/sync/actions.ts            — 添加下载任务 action
```