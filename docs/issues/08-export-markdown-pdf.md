# Issue 08：Markdown + PDF 导出

**优先级**：P2 | **类型**：AFK | **阻塞**：Issue 06

## 目标

补充 Markdown ZIP（Obsidian 兼容）和 PDF（浏览器打印）两种导出格式。

## 用户故事

- US-08：作为用户，我希望能导出 Markdown 格式方便导入 Obsidian
- US-10：作为用户，我希望能导出 PDF / 打印成册

## 验收标准

- [ ] Markdown ZIP 导出：下载 `.zip` 文件
- [ ] 解压后每个帖子一个 `.md` 文件，命名 `YYYY-MM-DD_HHmm_weibo_id.md`
- [ ] 每篇 .md 带 frontmatter（date, weibo_id, uid, is_original）
- [ ] 图片以相对路径引用
- [ ] 可直接解压到 Obsidian vault 使用
- [ ] PDF 导出：点击后打开打印优化新窗口
- [ ] 打印窗口隐藏导航栏和过滤栏
- [ ] 触发 `window.print()`，用户选择「另存为 PDF」
- [ ] 导出范围跟随当前筛选条件

## 技术要点

- Markdown ZIP：使用 `jszip` 打包
- Frontmatter：YAML 格式
- PDF：无新依赖，纯浏览器打印方案

## 涉及文件

```
app/posts/actions.ts           — 添加 Markdown/PDF 导出 actions
```