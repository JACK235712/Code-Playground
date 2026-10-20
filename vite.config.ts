import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { ProxyOptions } from 'vite'

const ZHIPU_ORIGIN = 'https://open.bigmodel.cn'
/** 浏览器只请求这个同源路径；真实域名和密钥都留在下面这份代理里 */
const AI_BASE = '/api/zhipu'
const CODEMIRROR = /node_modules\/(@codemirror|@lezer|@uiw)\//
const REACT = /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//

/**
 * 智谱接口不给浏览器发 CORS 头，前端直连必然被拦，所以让 dev server 代一手：
 * /api/zhipu/chat/completions → https://open.bigmodel.cn/api/paas/v4/chat/completions
 *
 * 密钥从 .env 读，读进来后由代理加到 Authorization 头上，客户端代码里一个字都看不到。
 * 注意变量名：Vite 会把所有 VITE_ 开头的变量原样打进浏览器包，
 * 密钥一旦叫 VITE_ZHIPU_API_KEY 就等于对访问者公开，所以这里首选 ZHIPU_API_KEY。
 * 为兼容旧写法，只有 ZHIPU_API_KEY 缺失时才回退读 VITE_ZHIPU_API_KEY。
 */
function makeProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const key = env.ZHIPU_API_KEY || env.VITE_ZHIPU_API_KEY || ''
  return {
    [AI_BASE]: {
      target: ZHIPU_ORIGIN,
      changeOrigin: true,
      rewrite: (path) => path.replace(AI_BASE, '/api/paas/v4'),
      // 没配密钥时也要把请求转出去，让上游回 401，前端才能给出准确提示
      ...(key ? { headers: { Authorization: `Bearer ${key}` } } : {}),
    },
  }
}

export default defineConfig(({ mode }) => {
  // 第三个参数传空字符串 = 不按 VITE_ 前缀过滤，这样 ZHIPU_API_KEY 也读得到
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      /**
       * 锁死端口。默认行为是「5173 被占就自动换 5174」，而 LocalStorage 按 origin 分桶，
       * 端口一换浏览器就换了个空盒子，registered_users 看着像被清空了，其实是存到了另一个端口下。
       * 宁可启动失败报错，也不要静默换端口把人的账号「弄丢」。
       */
      strictPort: true,
      host: true,
      proxy: makeProxy(env),
    },
    // vite preview 也挂同一份代理，build 出来的包照样能就地联调
    preview: {
      port: 5173,
      strictPort: true,
      proxy: makeProxy(env),
    },
    build: {
      rollupOptions: {
        output: {
          // 编辑器内核必须独占一个 chunk：否则 Rollup 会把它并进首页也要加载的共享 chunk，
          // 让只用编辑器的挑战页之外的人多下 500KB。
          // React 也要单独成组——不指定的话 Rollup 会把 jsx-runtime 塞进 codemirror chunk，
          // 于是首页为了一个 <jsx> 调用把整个编辑器内核拉下来。
          manualChunks(id) {
            const path = id.replace(/\\/g, '/')
            if (CODEMIRROR.test(path)) return 'codemirror'
            if (REACT.test(path)) return 'react'
          },
        },
      },
    },
  }
})
