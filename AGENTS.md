# 本项目的 Codex 工作说明
本项目是 GitHub Pages 个人博客。保留用户已有文章和资源。首页与文章页使用静态 HTML、CSS 和 JavaScript，从 main 分支根目录发布，所有站内链接使用相对路径。
首页保留右上角站内搜索及介绍下方的文章列表。尊重减少动态效果设置。个人资料或文章尚未提供时标注「待填写」。
文章正文与信息存放在 library/，一个文件一篇，content.js 的 libraryFiles 清单控制加载顺序；正文使用简易 Markdown（# 标题、- 与 1. 列表、**粗体**、*斜体*、~~删除线~~），渲染与搜索都在 app.js 中完成。
编辑后检查桌面和手机布局、搜索、文章链接和资源路径。

## 共用主题和 emoji
本项目现有及今后新增的网页统一通过 img.emoji 引用 assets/emoji/ 的本地图标。搜索使用 B 站网页顶栏的放大镜轮廓；配套图标采用相近线宽、圆头和单色轮廓，日间深色、夜间浅色。新增图标时在 ATTRIBUTION.txt 中注明来源与改动。装饰图标使用空 alt，纯图标按钮提供中文可访问名称。
按钮、文字、图标、边框和下拉菜单等内容必须同时适配日间与夜间：底色、文字色、图标色、边框色都随 data-theme 切换，不得写死只在单一主题下可读的颜色。新增控件复用 --ink、--quiet、--line、--accent、--icon-surface、--icon-ink、--icon-border、--icon-surface-hover；纯色图标用 currentColor 取主题色，页脚 GitHub 标志即属此类。叠在封面图片上的标题、签名和介绍文字保持白色并带阴影。改动后分别在两个主题下检查对比度和可读性。
所有页面在 head 中加载共用 theme.js 和 style.css，顶部导航右侧复用 data-toggle-theme 按钮及菜单内 data-auto-theme。自动主题以访客当地 06:00 至 18:00 为白天（不含 18:00）；手动选择在页面间保留，可恢复自动。白天封面来自 wallpaper_day/，夜晚来自 wallpaper_night/；电脑端与手机端各用 desktop/、mobile/ 子文件夹中的独立壁纸清单，宽高比小于 3:5 的竖屏取手机端，其余（含平板和横屏手机）取电脑端。增删图片时同步更新 theme.js 中对应设备与主题的 wallpapers 清单。
