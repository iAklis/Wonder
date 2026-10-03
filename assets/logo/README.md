# 图标文件

Wonder 图标使用黑色线条和透明背景。图标适用于浅色背景。

| 文件                                       | 用途                                                   |
| ------------------------------------------ | ------------------------------------------------------ |
| [logo.svg](logo.svg)                       | 可编辑的 SVG 矢量图，画布为 1254 × 1254                |
| [source.png](source.png)                   | 原始 PNG，1254 × 1254                                  |
| [public/icons/](../../public/icons/)       | 16、24、32、48、64、128、256、512 像素的 RGBA PNG 图标 |
| [preview.png](preview.png)                 | 各尺寸 PNG 的浅色背景预览                              |
| [svg-comparison.png](svg-comparison.png)   | 原始 PNG 与 SVG 渲染对比                               |
| [manifest-icons.json](manifest-icons.json) | Chrome 扩展图标配置片段                                |

SVG 使用原始 PNG 的轮廓，不包含嵌入位图。PNG 图标来自缩小后的原始 PNG。两种格式均保留原图比例和透明背景。PNG 图标也保留原图的留白。

## 扩展接入

构建脚本将 `public/icons/` 中的图标复制到扩展的 `icons/` 目录。

`manifest-icons.json` 是配置片段，不是完整清单。文件中的路径相对于构建后的扩展目录。

如需更新图标配置，将该片段合并到仓库根目录的 `manifest.json`。保留原有的弹窗等设置。
