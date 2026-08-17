# Issue 01：项目脚手架 + 空页面框架

**优先级**：P0 | **类型**：AFK | **阻塞**：无

## 目标

从零搭建 Next.js 项目骨架。复制 Design V2 完整设计系统，创建 4 个空页面和导航框架，搭好数据库 Schema。

## 用户故事

- 作为用户，打开应用能看到完整的导航和页面框架
- 作为开发者，后续功能只需在现成脚手架里填充内容

## 验收标准

- [ ] `npm run dev` 启动成功，浏览器打开 `localhost:3000`
- [ ] 4 个页面可导航切换：浏览 `/posts`、随机刷 `/shuffle`、同步 `/sync`、账号 `/accounts`
- [ ] 首页 `/` 自动重定向到 `/posts`
- [ ] Design V2 完整加载：色彩变量、字体、暗色模式、纸纹理
- [ ] 数据库 4 张表创建成功（`weibo_accounts`, `weibo_posts`, `weibo_images`, `weibo_sync_log`）
- [ ] 数据库查询函数可用（getXxx/createXxx/updateXxx/deleteXxx）
- [ ] 导航栏显示所有标签，活动标签高亮
- [ ] 移动端响应式适配

## 技术要点

- Next.js 16 App Router + React 19 + TypeScript
- TailwindCSS v4 + CSS 自定义属性（Design V2 令牌）
- `@libsql/client` 本地 SQLite
- 字体：Outfit + Noto Sans SC + Noto Serif SC

## 涉及文件

```
weibo-backup/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── CLAUDE.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── posts/page.tsx  (空壳)
│   ├── sync/page.tsx   (空壳)
│   ├── accounts/page.tsx (空壳)
│   └── shuffle/page.tsx (空壳)
├── lib/
│   ├── db.ts
│   └── types.ts
└── public/uploads/weibo/
```