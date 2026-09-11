# Wonder

Wonder 是一个网页双语翻译扩展，支持 Google 和 Edge 翻译，可配置站点与语言规则、自定义词典和翻译样式。

Edge 翻译使用在线接口 `edge.microsoft.com/translate/translatetext`，无需配置 API 密钥；支持自动检测源语言。旧版 Yandex 设置会自动迁移为 Edge。该接口与浏览器内置、使用本地模型的 `Translator` API 不同，待翻译文本会发送给 Microsoft。

## 安装

准备对应浏览器的扩展 ZIP 并解压；从源码构建请参阅 [开发指南](DEVELOPER.md#构建)。

### Chrome / Edge

Chrome 最低版本为 127；Edge 请使用近期版本。

1. 打开 `chrome://extensions` 或 `edge://extensions`，开启「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择解压后包含 `manifest.json` 的目录；本地构建时为 `dist/chrome`。
3. 在工具栏的扩展菜单中固定 Wonder。

### Firefox

桌面 Firefox 最低版本为 140。

1. 打开 `about:debugging#/runtime/this-firefox`，点击「临时载入附加组件」。
2. 选择解压目录中的 `manifest.json`；本地构建时为 `dist/firefox/manifest.json`。

Firefox 构建未签名，临时安装在浏览器重启后失效；长期安装需要另行签名。

## 使用

1. 打开普通网页，点击工具栏上的 Wonder 图标。
2. 选择目标语言和翻译服务，点击「翻译此页」。
3. 开启「双语对照」可同时显示原文和译文；点击「显示原文」可恢复。

通过弹窗中的设置按钮，可调整主题、翻译样式、网站规则、词典和快捷键，以及导入导出配置。大部分设置即时保存，带有保存按钮的项目需手动保存。

- 安装或重新加载扩展后，请刷新已打开的网页。
- 浏览器内部页面（如 `chrome://`）无法翻译。
- 翻译失败时，请检查网络或切换翻译服务。

## 开发

从源码构建见 [本地构建指南](DEVELOPER.md)。

## 隐私与许可证

翻译内容会发送到所选翻译服务。配置与翻译缓存保存在浏览器本地，隐私窗口中的翻译不写入持久化缓存。详情见 [隐私说明](PRIVACY)。

项目采用 [MPL-2.0](LICENSE) 许可证，上游来源与署名见 [NOTICE.md](NOTICE.md)。
