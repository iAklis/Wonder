# LOGO 物料

黑色线条，透明背景，适合浅色背景。

| 文件 | 用途 |
| --- | --- |
| [logo.svg](logo.svg) | 可编辑的矢量路径，保留原图比例和透明背景，画布为 1254 × 1254 |
| [source.png](source.png) | 原始 PNG，1254 × 1254 |
| [../../public/icons/](../../public/icons/) | 16、24、32、48、64、128、256、512 像素的 RGBA PNG 图标 |
| [preview.png](preview.png) | 各尺寸 PNG 的浅色背景预览 |
| [svg-comparison.png](svg-comparison.png) | 原始 PNG 与 SVG 渲染对比 |
| [manifest-icons.json](manifest-icons.json) | Chrome 扩展图标配置片段 |

SVG 由原图轮廓描摹而成，不包含嵌入位图。PNG 图标由原始 PNG 等比例缩小，保留留白；小尺寸的细节会随缩小减少。

## 扩展接入

各尺寸 PNG 图标统一保存在 `public/icons/`，构建时复制到扩展的 `icons/` 目录。本目录只保留设计源文件、预览和配置示例。

`manifest-icons.json` 中的路径相对于构建后的扩展目录。按需将图标配置合并到仓库根目录的 `manifest.json`，并保留已有的弹窗等设置；该片段不是完整清单。
