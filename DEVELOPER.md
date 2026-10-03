# 本地构建

## 环境

安装 Node.js 24。

如果尚未安装 pnpm 11.19.0，运行：

```sh
npm install --global pnpm@11.19.0
```

## 构建

获取源码后，运行以下命令：

```sh
cd wonder
pnpm install --frozen-lockfile
pnpm build
```

## 构建产物

| 路径               | 用途                           |
| ------------------ | ------------------------------ |
| `dist/chrome/`     | Chrome / Edge 扩展目录         |
| `dist/firefox/`    | Firefox 扩展目录，用于临时加载 |
| `dist/chrome.zip`  | Chrome / Edge 扩展 ZIP 文件    |
| `dist/firefox.zip` | Firefox 未签名扩展 ZIP 文件    |

构建完成后，按照 [安装说明](README.md#安装) 加载扩展。

## Nightly

Nightly 每天北京时间 08:23 检查 `main` 的 HEAD。如果该提交已发布 nightly，工作流会跳过构建。未完成的构建或发布可以重试。

通过检查后，工作流在 [GitHub Releases](https://github.com/iAklis/Wonder/releases) 发布预发行版。文件包括 Chrome / Edge ZIP、Firefox 未签名 ZIP、`release.json` 和 `SHA256SUMS`。预发行版不替换正式版的 Latest。

如需手动构建，在 Actions → Nightly → Run workflow 中选择 `main`。工作流使用 `GITHUB_TOKEN`，无需额外 Secret。
