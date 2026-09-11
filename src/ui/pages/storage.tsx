import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, t, config, useSettings } from "../model";
import { Confirm, Row, Section } from "../shared";

export function Storage() {
  const { run } = useSettings();
  const file = useRef<HTMLInputElement>(null);
  const [cache, setCache] = useState<string | null>(null),
    [confirm, setConfirm] = useState<"reset" | "cache" | "import" | null>(null),
    [backup, setBackup] = useState("");
  const exportBackup = () => {
    const url = URL.createObjectURL(
      new Blob([config.export()], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `wonder-backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <Section
        title={t("配置备份", "Settings backup")}
        description={t(
          "兼容旧版扩展导出的 .txt 与 .json 备份。",
          "Compatible with .txt and .json backups from the original extension.",
        )}
      >
        <Row
          title={t("导出设置", "Export settings")}
          description={t(
            "保存语言、站点规则、词典与界面偏好。",
            "Save languages, site rules, dictionary, and interface preferences.",
          )}
        >
          <Button variant="outline" onClick={() => void run(exportBackup)}>
            <Download />
            {t("导出备份", "Export backup")}
          </Button>
        </Row>
        <Row
          title={t("导入设置", "Import settings")}
          description={t(
            "导入前会请求确认，完成后扩展将重新加载。",
            "Review before replacing settings. The extension reloads after import.",
          )}
        >
          <Button variant="outline" onClick={() => file.current?.click()}>
            <Upload />
            {t("选择备份", "Choose backup")}
          </Button>
          <input
            ref={file}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            hidden
            aria-label={t("备份文件", "Backup file")}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              e.target.value = "";
              if (selected)
                void run(async () => {
                  const text = await selected.text();
                  const value: unknown = JSON.parse(text);
                  if (
                    !value ||
                    typeof value !== "object" ||
                    Array.isArray(value)
                  )
                    throw new Error(t("无效的备份文件", "Invalid backup file"));
                  setBackup(text);
                  setConfirm("import");
                });
            }}
          />
        </Row>
      </Section>
      <Section title={t("本地存储", "Local storage")}>
        <Row
          title={t("翻译缓存", "Translation cache")}
          description={t(
            "缓存已翻译的内容，减少重复请求。",
            "Reuse previous translations to reduce repeated requests.",
          )}
        >
          <span className="text-sm text-muted-foreground">{cache}</span>
          <Button
            variant="outline"
            onClick={() =>
              void run(async () =>
                setCache(
                  String(
                    await api.runtime.sendMessage({ action: "getCacheSize" }),
                  ),
                ),
              )
            }
          >
            {t("计算占用", "Calculate size")}
          </Button>
        </Row>
        <Row
          title={t("清除翻译缓存", "Clear translation cache")}
          description={t(
            "保留所有个人设置与规则。",
            "Your preferences and rules are kept.",
          )}
        >
          <Button variant="outline" onClick={() => setConfirm("cache")}>
            {t("清除缓存", "Clear cache")}
          </Button>
        </Row>
      </Section>
      <Section title={t("重置", "Reset")}>
        <Row
          title={t("恢复默认设置", "Restore default settings")}
          description={t(
            "清除个性化设置，恢复初始状态。",
            "Remove custom preferences and return to the defaults.",
          )}
        >
          <Button variant="destructive" onClick={() => setConfirm("reset")}>
            {t("恢复默认", "Reset settings")}
          </Button>
        </Row>
      </Section>
      <Confirm
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm === "cache"
            ? t("清除翻译缓存？", "Clear translation cache?")
            : confirm === "import"
              ? t("用备份替换设置？", "Replace settings with this backup?")
              : t("恢复默认设置？", "Restore default settings?")
        }
        description={
          confirm === "cache"
            ? t(
                "下次翻译时会重新请求译文。个人设置不会被删除。",
                "Translations will be fetched again next time. Preferences are kept.",
              )
            : t(
                "此操作将更改当前配置并重新加载扩展，建议先导出备份。",
                "This changes your settings and reloads the extension. Export a backup first if needed.",
              )
        }
        destructive={confirm !== "import"}
        onConfirm={() =>
          void run(async () => {
            if (confirm === "cache") {
              const cleared = await api.runtime.sendMessage({
                action: "deleteTranslationCache",
                reload: false,
              });
              if (!cleared)
                throw new Error(
                  t(
                    "缓存清除失败，请重试。",
                    "Could not clear the cache. Please retry.",
                  ),
                );
              setCache("0 B");
            } else if (confirm === "import") await config.import(backup);
            else await config.restoreToDefault();
          })
        }
      />
    </>
  );
}
