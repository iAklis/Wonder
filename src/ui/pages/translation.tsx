import { BookOpen } from "lucide-react";
import { t, config, useSettings } from "../model";
import { Choice, LanguageChoice, Row, Section, Toggle } from "../shared";

export function Translation() {
  const { values, set, run } = useSettings();
  return (
    <>
      <Section
        title={t("默认翻译", "Translation defaults")}
        description={t(
          "打开扩展后，将使用这些偏好。",
          "Your starting point whenever you translate a page.",
        )}
      >
        <Row
          title={t("目标语言", "Target language", "lblTargetLanguage")}
          description={t(
            "网页与文本翻译使用的语言。",
            "The language used for page and text translation.",
          )}
        >
          <LanguageChoice
            id="targetLanguage1"
            value={values.targetLanguage || "zh-CN"}
            label={t("目标语言", "Target language")}
            onChange={(value) =>
              void run(() => config.setTargetLanguage(value, true))
            }
          />
        </Row>
        <Row
          title={t("翻译服务", "Translation service")}
          description={t(
            "随时可以在扩展弹窗中切换。",
            "You can also switch services from the popup.",
          )}
        >
          <Choice
            id="pageTranslatorService"
            label={t("翻译服务", "Translation service")}
            value={values.pageTranslatorService}
            onChange={(value) => void set("pageTranslatorService", value)}
            options={[
              ["google", "Google Translate"],
              ["edge", "Edge Translate"],
            ]}
          />
        </Row>
      </Section>
      <Section title={t("阅读方式", "Reading experience")}>
        <Toggle
          name="isShowDualLanguage"
          title={t("双语对照", "Bilingual reading")}
          description={t(
            "同时显示原文和译文，保留阅读上下文。",
            "Show original text alongside its translation.",
          )}
        />
        <Toggle
          name="translateDynamicallyCreatedContent"
          title={t("翻译动态内容", "Translate dynamic content")}
          description={t(
            "滚动加载的新段落，也会自动翻译。",
            "Translate new paragraphs as the page loads more content.",
          )}
        />
      </Section>
      <div className="tip-panel">
        <BookOpen size={19} />
        <div>
          <strong>{t("从阅读开始", "Ready when you are")}</strong>
          <p>
            {t(
              "打开任意网页，点击工具栏中的扩展图标即可翻译。",
              "Open a web page and click the extension icon in your toolbar to translate.",
            )}
          </p>
        </div>
      </div>
    </>
  );
}
