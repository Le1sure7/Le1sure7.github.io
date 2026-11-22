# Le1sure7's Home Page
- 网址：https://le1sure7.github.io/
- 网站目前正在建设中，欢迎访问！
- 这是我的个人主页兼Blog，主要用于记录我的学习笔记、技术分享以及个人兴趣爱好等内容。希望能与大家一起交流和成长。

## 写博客

文章正文与信息放在 `library/`，一个文件一篇，照抄 `library/first-blog.js` 的结构；再把文件名（不含 `.js`）登记到 `content.js` 的 `libraryFiles` 清单，越靠前越新，每篇 id 唯一，日期用 YYYY-MM-DD。页面按清单动态加载，直接双击 `index.html` 用 file:// 预览也能读到文章。

正文使用简易 Markdown：`# 小标题`、`- 无序列表`、`1. 有序列表`（行首 Tab 或两个空格表示嵌套）、`**粗体**`、`*斜体*`、`***粗斜体***`、`~~删除线~~`。`Essays/` 放原始 Markdown 草稿，发布时把内容搬进 `library/`。