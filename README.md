# Le1sure7's Home Page
- 修改文字：在 index.html 和 post.html 修改站名，在 index.html 修改首页介绍。
- 写博客：修改 content.js 的 posts；每篇使用唯一 id，把新文章放在数组开头，日期用 YYYY-MM-DD。
- 配色、布局和动画：style.css。原始壁纸备份在 wallpaper_original/。白天和夜晚的整图分别在 wallpaper_day/ 和 wallpaper_night/，作为裁剪源图。电脑端横屏壁纸在各自的 desktop/ 子文件夹，手机端竖屏壁纸在各自的 mobile/ 子文件夹，文件名都与源图相同。图片清单、构图焦点和横屏标题位置在 theme.js 的 wallpapers 中，desktop 和 mobile 各一套清单，随机池互不影响；宽高比小于 3:5 的竖屏（手机）用手机端，其余（含平板和横屏手机）用电脑端。


## 壁纸裁剪

在项目根目录运行 PowerShell。脚本分析画面的轮廓与暖色区域，为电脑端和手机端分别取景，生成 desktop/（3840×2160）和 mobile/（1440×2880）两个子文件夹，放在源图旁边，文件名沿用源图名。重复运行会更新同名文件。新增壁纸时把整图放进主题目录，运行脚本后再到 theme.js 对应的 desktop 或 mobile 清单中登记文件名；只想给某一端加图时，直接把图片放进该子文件夹并在清单里登记即可。

~~~powershell
.\Crop-Wallpaper.ps1 .\wallpaper_day\KOn_day.jpg
~~~

群像可指定优先保留的矩形。以下用法保留《轻音少女》左侧两人的脸部。四个数依次为左、上、右、下边界，按画幅宽高归一化到 0 至 1。

~~~powershell
.\Crop-Wallpaper.ps1 .\wallpaper_day\KOn_day.jpg -KeepRegion 0.15,0.09,0.402,0.60
~~~
