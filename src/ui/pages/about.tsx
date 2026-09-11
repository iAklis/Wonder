import { Badge } from "@/components/ui/badge";
import { t } from "../model";
import { Brand, Section } from "../shared";

export function About() {
  return (
    <Section title="Wonder">
      <div className="about-content">
        <Brand />
        <Badge variant="secondary">
          v{chrome.runtime.getManifest().version}
        </Badge>
        <p>
          {t(
            "Wonder 帮助你双语阅读网页、跨越语言边界，提供清晰、易用的翻译设置。",
            "Wonder helps you read web pages in two languages, with clear and simple translation settings.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          MPL-2.0 ·{" "}
          {t(
            "致谢原项目与所有贡献者。",
            "With thanks to the original project and its contributors.",
          )}
        </p>
      </div>
    </Section>
  );
}
