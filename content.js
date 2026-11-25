// 文章库：每篇文章的正文与信息放在 library/ 下，一个文件一篇。
// 新增文章：先写好 library/文件名.js（照抄 first-blog.js 的写法），
// 再把文件名（不含 .js）登记到下面清单里，越靠前越新。
const posts = [];
const libraryFiles = ['polar-symmetry', 'fil-music', 'first-blog'];
const contentUrl = new URL(document.currentScript.src);
const siteVersion = contentUrl.searchParams.get('v');
const libraryBase = new URL('library/', contentUrl);

window.libraryReady = (async () => {
  for (const name of libraryFiles) {
    await new Promise(resolve => {
      const script = document.createElement('script');
      const url = new URL(name + '.js', libraryBase);
      if (siteVersion) url.searchParams.set('v', siteVersion);
      script.src = url.href;
      script.onload = resolve;
      script.onerror = () => {
        console.warn('文章未能加载：library/' + name + '.js');
        resolve();
      };
      document.head.append(script);
    });
  }
  return posts;
})();
