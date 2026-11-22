// 文章库：每篇文章的正文与信息放在 library/ 下，一个文件一篇。
// 新增文章：先写好 library/文件名.js（照抄 first-blog.js 的写法），
// 再把文件名（不含 .js）登记到下面清单里，越靠前越新。
const posts = [];
const libraryFiles = ['first-blog'];
const libraryBase = new URL('library/', document.currentScript.src);

window.libraryReady = (async () => {
  for (const name of libraryFiles) {
    await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(name + '.js', libraryBase).href;
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
