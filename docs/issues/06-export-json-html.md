# Issue 06：JSON + HTML 导出

**优先级**：P0 | **类型**：AFK | **阻塞**：Issue 03

## 目标

在浏览页添加导出下拉菜单。JSON 导出完整结构化数据，HTML 导出独立可离线浏览的网页文件。

## 用户故事

- US-03：作为用户，我希望备份数据能导出为通用格式（HTML/JSON）

## 验收标准

- [ ] 浏览页顶部有导出下拉按钮：`[📥 导出 ▼]`
- [ ] JSON 导出：浏览器下载 `weibo-export.json`，包含完整字段和原始 API JSON
- [ ] JSON 结构正确：`{ exported_at, total, posts: [...] }`
- [ ] HTML 导出：独立 `.html` 文件，内嵌 Design V2 CSS
- [ ] HTML 文件可直接在浏览器打开，离线可读
- [ ] HTML 布局与浏览页卡片样式一致
- [ ] 导出范围跟随当前筛选条件（账号、日期、类型）

## 不在此范围

- Markdown ZIP 导出 → Issue 08
- PDF 导出 → Issue 08

## 涉及文件

```
app/posts/actions.ts           — 添加 JSON/HTML 导出 actions
lib/export-html.ts             — HTML 生成模板
```