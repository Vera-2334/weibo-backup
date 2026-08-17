# 微博备份工具（weibo-backup）

一款**本地运行**的个人微博备份工具。提供微博 Cookie 后，自动抓取全部微博、评论和图片，存入本地 SQLite 数据库，支持流畅浏览、随机翻看、那年今日和多格式导出。

> 把你的微博完整备份到本地，永久保存你的数字记忆。

## ✨ 特性

- **一键同步**：帖子 → 评论 → 图片，自动增量抓取
- **多账号**：同时管理多个微博账号，Cookie 分别保存
- **时间线浏览**：按时间倒序浏览，支持搜索与日期筛选
- **随机刷**：随机翻看旧微博
- **那年今日**：按日期回顾历年同一天的内容
- **详情弹窗**：查看完整内容、图片和评论
- **多格式导出**：JSON / HTML / Markdown（zip）/ PDF（打印）
- **图片本地化**：下载图片到本地，并通过代理绕过防盗链
- **可选 Turso 备份**：把本地数据库镜像到 Turso 云端（可选）

## 🚀 快速开始

### 前置要求

- Node.js 18+
- 一个微博账号（用于获取自己的 Cookie）

### 安装运行

```bash
git clone https://github.com/Vera-2334/weibo-backup.git
cd weibo-backup
npm install
npm run dev
```

打开浏览器访问 **http://localhost:3001**。

### 获取微博 SUB Cookie

1. 用浏览器登录 [weibo.com](https://weibo.com)
2. 打开开发者工具（F12）→ **Application / 存储** → **Cookies** → 选择 `https://weibo.com`
3. 找到名为 `SUB` 的 Cookie，复制它的**值**
4. 回到 App 的「账号」页，填入这个 SUB 并保存

### 开始同步

进入「同步」页，点击**一键同步**。程序会自动抓取微博、评论和图片，存入本地 `data.db`。

## 📤 导出格式

| 格式 | 说明 |
|------|------|
| JSON | 完整结构化数据，便于二次处理 |
| HTML | 单文件网页，可直接在浏览器查看 |
| Markdown | 按时间打包成 zip，适合归档阅读 |
| PDF | 通过浏览器「打印」导出为 PDF |

## ☁️ 可选：备份到 Turso

默认数据只存在本地 `data.db`。如果想在云端再存一份，可以配置 [Turso](https://turso.tech)：

```bash
cp .env.example .env.local
```

在 `.env.local` 里填入 `TURSO_BACKUP_URL` 和 `TURSO_BACKUP_TOKEN`（可选 `TURSO_BACKUP_PROXY` 走代理）。

## 🔧 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TURSO_BACKUP_URL` | 否 | Turso 数据库地址（`libsql://...`） |
| `TURSO_BACKUP_TOKEN` | 否 | Turso 数据库 auth token |
| `TURSO_BACKUP_PROXY` | 否 | 直连不通时使用的 HTTP 代理 |

> ⚠️ 请用 `TURSO_BACKUP_*`，不要用 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`——后两者会让整个 App 直接连远程库，本地 `data.db` 就不再读写了。

## 🛠 技术栈

- [Next.js](https://nextjs.org) 16（App Router）+ React 19 + TypeScript
- [libSQL](https://github.com/tursodatabase/libsql)（本地 SQLite 文件）
- [lucide-react](https://lucide.dev) 图标
- Tailwind CSS 4

## 📁 目录结构

```
app/            # 页面（浏览 / 随机刷 / 那年今日 / 同步 / 账号）
lib/            # 数据库、导出、微博抓取、图片下载
scripts/        # CLI 同步脚本
docs/           # PRD 和开发记录
data.db         # 本地数据库（自动生成，已被 .gitignore 忽略）
```

## ⚖️ 免责声明

本项目仅供**个人备份自己账号的内容**使用。请遵守微博的服务条款，不要用于抓取他人数据或任何商业/滥用用途。使用本项目产生的数据，其合法性由使用者自行负责。

## 📄 License

[MIT](./LICENSE)
