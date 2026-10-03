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

## GitHub CI 与 nightly

`Check` 工作流在主分支推送和 Pull Request 时执行格式、类型、lint、单元测试、浏览器集成测试及双浏览器打包。正式版本继续通过 `v*` 标签触发 `Release`。

`Nightly` 每天北京时间 08:23（UTC 00:23）检查 GitHub 默认分支的 HEAD；当前默认分支为 `main`。也可以在 Actions → Nightly → Run workflow 手动运行，分支选择默认分支。GitHub 的定时任务可能延迟，工作流文件必须位于默认分支才能生效。

- 检查先于安装依赖和构建。提交已存在对应的已发布 nightly 预发行版时，跳过验证、打包与发布；仍会留下一个显示跳过原因的 Actions 运行记录。
- 尚未发布时，固定本次检查得到的完整提交 SHA，复用 `Check` 的全部验证和打包步骤，再发布 `nightly-<完整 SHA>`。即使构建期间主分支前进，产物也只对应已选定的 SHA。
- 同一提交只发布一次；首次运行会构建。失败的构建、未完成的草稿或仅创建的标签不算成功，下次定时或手动运行会重试。GitHub API 失败会明确报错，不会误判为需要构建。
- 发布到 [GitHub Releases](https://github.com/iAklis/Wonder/releases)，标记为 Pre-release，不替换正式版的 Latest。上传与校验全部完成后才公开，保留历史 nightly。

每个 nightly 包含 `wonder-<版本>-nightly-<短 SHA>-chrome.zip`、`wonder-<版本>-nightly-<短 SHA>-firefox.zip`、`release.json` 和 `SHA256SUMS`。扩展 manifest 保持源码中的数字版本号；nightly 身份记录在文件名、Release 标签和 `release.json` 中。Firefox ZIP 仍为未签名扩展，安装方式见 [README](README.md#安装)。

无需额外 Secret：检查和构建只使用 `contents: read`；独立发布 job 使用仓库的 `GITHUB_TOKEN` 和 `contents: write` 创建标签及预发行版。
