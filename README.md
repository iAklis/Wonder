# Wonder

Wonder 是一个网页双语翻译扩展。它支持 Google 和 Edge 在线翻译。

你可以设置网站规则、语言规则、自定义词典和翻译样式。

## 安装

准备对应浏览器的扩展 ZIP 文件。从源码构建的方法见 [开发指南](DEVELOPER.md#构建)。

解压 ZIP 文件。

### Chrome / Edge

Chrome 最低版本为 127。Edge 请使用近期版本。

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择解压后包含 `manifest.json` 的目录。本地构建的目录为 `dist/chrome`。
5. 在工具栏的扩展菜单中固定 Wonder。

### Firefox

桌面 Firefox 最低版本为 140。

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击「临时载入附加组件」。
3. 选择解压目录中的 `manifest.json`。本地构建的文件为 `dist/firefox/manifest.json`。

Firefox 扩展未签名。临时安装在浏览器重启后失效。长期安装需要另行签名。

## 使用

1. 打开普通网页。
2. 点击工具栏上的 Wonder 图标。
3. 选择目标语言。
4. 选择翻译服务。
5. 点击「翻译此页」。

如需同时显示原文和译文，开启「双语对照」。如需恢复原文，点击「显示原文」。

点击弹窗中的设置按钮，打开设置页面。你可以调整主题、翻译样式、网站规则、词典和快捷键，也可以导入或导出配置。

大部分设置会自动保存。如果设置项有保存按钮，点击该按钮保存更改。

- 安装或重新加载扩展后，请刷新已打开的网页。
- 浏览器内部页面（如 `chrome://`）无法翻译。
- 在线翻译失败时，检查网络连接或选择其他翻译服务。

## 翻译服务

### 在线翻译

Wonder 会将待翻译的文本发送到所选在线服务。Edge 使用在线接口 `edge.microsoft.com/translate/translatetext`。该接口无需 API 密钥。它支持自动检测原文语言。

Edge 在线翻译不使用浏览器的本地 `Translator` API。Wonder 会将旧版 Yandex 设置自动迁移为 Edge。

## 隐私与许可证

在线翻译会将文本发送到所选服务。

Wonder 在浏览器本地保存配置和在线翻译缓存。隐私窗口中的翻译不会写入持久化缓存。详情见 [隐私说明](PRIVACY)。

项目采用 [MPL-2.0](LICENSE) 许可证，上游来源与署名见 [NOTICE.md](NOTICE.md)。
