import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t, useSettings } from "../model";
import { Choice, Row, Section, Toggle } from "../shared";

export function Appearance() {
  const { values, set } = useSettings();
  const [css, setCss] = useState(values.customDualStyle);
  useEffect(() => setCss(values.customDualStyle), [values.customDualStyle]);
  return (
    <>
      <Section title={t("界面主题", "Interface theme")}>
        <Row
          title={t("配色模式", "Color mode")}
          description={t(
            "设置页与弹窗共用此主题。",
            "Used by both settings and the extension popup.",
          )}
        >
          <Choice
            label={t("配色模式", "Color mode")}
            value={values.darkMode}
            onChange={(v) => void set("darkMode", v)}
            options={[
              ["auto", t("跟随系统", "System")],
              ["no", t("浅色", "Light")],
              ["yes", t("深色", "Dark")],
            ]}
          />
        </Row>
      </Section>
      <Section title={t("译文样式", "Translation style")}>
        <Toggle
          name="isShowDualLanguage"
          title={t("双语对照", "Bilingual reading")}
        />
        <Row
          title={t("双语样式", "Bilingual style")}
          description={t(
            "为译文添加视觉区分。",
            "Give translated text a distinct appearance.",
          )}
        >
          <Choice
            label={t("双语样式", "Bilingual style")}
            value={values.dualStyle}
            onChange={(v) => void set("dualStyle", v)}
            options={[
              ["none", t("默认", "Default")],
              ["underline", t("下划线", "Underline")],
              ["weakening", t("弱化", "Subtle")],
              ["mask", t("模糊遮罩", "Mask")],
              ["highlight", t("高亮", "Highlight")],
            ]}
          />
        </Row>
        <div className="p-5 space-y-3">
          <label htmlFor="customDualStyle" className="row-title">
            {t("自定义译文 CSS", "Custom translation CSS")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              "输入 CSS 声明，例如 color: #2563eb;。此项需要单独保存。",
              "Enter CSS declarations, such as color: #2563eb;. Save this field explicitly.",
            )}
          </p>
          <Textarea
            id="customDualStyle"
            className="font-mono text-xs min-h-24"
            placeholder="color: #2563eb;"
            value={css}
            onChange={(e) => setCss(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={css === values.customDualStyle}
            onClick={() => void set("customDualStyle", css)}
          >
            {t("保存样式", "Save style")}
          </Button>
        </div>
      </Section>
    </>
  );
}
