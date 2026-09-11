# 本地构建

## 环境

准备 Node.js 24 和 pnpm 11.19.0。未安装 pnpm 时，运行：

```sh
npm install --global pnpm@11.19.0
```

## 构建

获取源码后，在项目目录安装依赖并构建：

```sh
cd wonder
pnpm install --frozen-lockfile
pnpm build
```

## 构建产物

| 路径 | 用途 |
| --- | --- |
| `dist/chrome/` | Chrome / Edge 加载目录 |
| `dist/firefox/` | Firefox 临时加载目录 |
| `dist/chrome.zip` | Chrome / Edge 扩展压缩包 |
| `dist/firefox.zip` | Firefox 未签名扩展压缩包 |

构建完成后，按照 [安装说明](README.md#安装) 加载扩展。
