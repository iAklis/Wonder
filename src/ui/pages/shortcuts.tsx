import { useEffect, useState } from "react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, isFirefox, t, config, useSettings } from "../model";
import { Row, Section } from "../shared";

export function Shortcuts() {
  const { values, run } = useSettings();
  const [commands, setCommands] = useState<chrome.commands.Command[]>([]);
  useEffect(() => {
    void api.commands.getAll().then(setCommands);
  }, []);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <Section
      title={t("键盘快捷键", "Keyboard shortcuts")}
      description={
        isFirefox
          ? t(
              "输入组合键，例如 Ctrl+Shift+Y，然后保存。",
              "Enter a shortcut such as Ctrl+Shift+Y, then save.",
            )
          : t(
              "快捷键由浏览器管理，可在原生设置中修改。",
              "Shortcuts are managed by your browser. Change them in its shortcut settings.",
            )
      }
    >
      {commands.map((command) => (
        <Row
          key={command.name}
          title={command.description || command.name || ""}
        >
          {isFirefox ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const name = command.name!;
                  const shortcut = drafts[name] ?? values.hotkeys[name] ?? "";
                  const commandsApi = api.commands as typeof api.commands & {
                    update: (change: {
                      name: string;
                      shortcut: string;
                    }) => Promise<void>;
                  };
                  await commandsApi.update({ name, shortcut });
                  config.set("hotkeys", {
                    ...values.hotkeys,
                    [name]: shortcut,
                  });
                });
              }}
            >
              <Input
                aria-label={command.description}
                value={
                  drafts[command.name!] ?? values.hotkeys[command.name!] ?? ""
                }
                onChange={(e) =>
                  setDrafts({ ...drafts, [command.name!]: e.target.value })
                }
              />
              <Button variant="outline" size="sm">
                {t("保存", "Save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${t("恢复默认快捷键", "Reset shortcut")} ${command.description || command.name}`}
                onClick={() =>
                  void run(async () => {
                    const name = command.name!;
                    const commandsApi = api.commands as typeof api.commands & {
                      reset: (name: string) => Promise<void>;
                    };
                    await commandsApi.reset(name);
                    const updated = await api.commands.getAll();
                    setCommands(updated);
                    setDrafts((current) => {
                      const next = { ...current };
                      delete next[name];
                      return next;
                    });
                    config.set(
                      "hotkeys",
                      Object.fromEntries(
                        updated.map((item) => [
                          item.name!,
                          item.shortcut || "",
                        ]),
                      ),
                    );
                  })
                }
              >
                <RotateCcw />
              </Button>
            </form>
          ) : (
            <kbd>
              {values.hotkeys[command.name!] || t("未设置", "Not assigned")}
            </kbd>
          )}
        </Row>
      ))}
      {!isFirefox && (
        <div className="p-5 border-t">
          <Button
            variant="outline"
            onClick={() =>
              void run(() =>
                api.tabs.create({ url: "chrome://extensions/shortcuts" }),
              )
            }
          >
            {t("打开浏览器快捷键设置", "Open browser shortcuts")}
            <ArrowUpRight />
          </Button>
        </div>
      )}
    </Section>
  );
}
