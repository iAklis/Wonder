import { isFirefox, t, useSettings, setAutoTranslate } from "../model";
import { Section, Toggle } from "../shared";

export function Advanced() {
  const { run } = useSettings();
  return (
    <>
      <Section title={t("翻译行为", "Translation behavior")}>
        <Toggle
          name="isTranslateTitle"
          title={t("翻译网页标题", "Translate page titles")}
        />
        <Toggle
          name="translateTag_pre"
          title={t("翻译预格式化文本", "Translate preformatted text")}
          description={t(
            "包含网页中的 pre 文本块。",
            "Include text inside preformatted blocks.",
          )}
        />
        <Toggle
          name="dontSortResults"
          title={t("不重新排序翻译结果", "Keep translation result order")}
        />
        <Toggle
          name="autoTranslateWhenClickingALink"
          title={t(
            "点击链接后继续翻译",
            "Keep translating after following links",
          )}
          description={t(
            "启用时，浏览器会请求网页导航权限。",
            "Your browser will request navigation permission when enabled.",
          )}
          onChange={(enabled) => void run(() => setAutoTranslate(enabled))}
        />
      </Section>
      <Section title={t("浏览器集成", "Browser integration")}>
        <Toggle
          name="translateClickingOnce"
          title={t(
            "点击工具栏图标直接翻译",
            "Translate immediately on toolbar click",
          )}
          description={t(
            "开启后，点击图标切换翻译；可从右键菜单打开设置。",
            "Click the icon to toggle translation. Settings remain available from the context menu.",
          )}
        />
        <Toggle
          name="showTranslatePageContextMenu"
          title={t("显示右键翻译菜单", "Show translation in the context menu")}
        />
        {isFirefox && (
          <Toggle
            name="showButtonInTheAddressBar"
            title={t("在地址栏显示翻译按钮", "Show the address bar button")}
          />
        )}
        <Toggle
          name="showPopupMobile"
          title={t("显示移动端翻译浮窗", "Show the mobile translation popup")}
        />
      </Section>
    </>
  );
}
