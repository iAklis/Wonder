import { Monitor, ShieldCheck } from "lucide-react";
import { t, useSettings } from "../model";

export function Preview() {
  const { values } = useSettings();
  return (
    <aside className="reading-preview">
      <div className="preview-heading">
        <span className="status-dot" />
        {t("阅读效果", "READING PREVIEW")}
        <Monitor size={15} />
      </div>
      <div className="preview-paper">
        <span className="preview-eyebrow">A WORLD OF IDEAS</span>
        <h3>
          Stay curious.
          <br />
          Read beyond borders.
        </h3>
        <p hidden={values.isShowDualLanguage !== "yes"}>
          Every language opens a window to a different way of seeing the world.
        </p>
        <div
          className={`preview-translation style-${values.dualStyle}`}
          hidden={values.isShowDualLanguage !== "yes"}
        >
          每一种语言，都为我们打开一扇以不同方式看世界的窗。
        </div>
        {values.isShowDualLanguage !== "yes" && (
          <div className="preview-translation">
            每一种语言，都为我们打开一扇以不同方式看世界的窗。
          </div>
        )}
        <div className="preview-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
      <p className="preview-note">
        {t(
          "内置双语样式示意；自定义 CSS 在网页中生效。",
          "Built-in bilingual style preview. Custom CSS applies on web pages.",
        )}
      </p>
      <div className="local-note">
        <ShieldCheck size={17} />
        <span>
          {t("设置保存在当前浏览器", "Settings stay in this browser")}
        </span>
      </div>
    </aside>
  );
}
