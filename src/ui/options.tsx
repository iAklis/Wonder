import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRightLeft,
  BookOpen,
  ChevronRight,
  Database,
  Globe2,
  Heart,
  Keyboard,
  Menu,
  Palette,
  Search,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SettingsProvider, t } from "./model";
import { Brand, ErrorNotice, SaveStatus } from "./shared";
import { Dictionary, RuleList, SpecialRules } from "./rules";
import { Preview } from "./pages/preview";
import { Translation } from "./pages/translation";
import { Appearance } from "./pages/appearance";
import { Shortcuts } from "./pages/shortcuts";
import { Advanced } from "./pages/advanced";
import { Storage } from "./pages/storage";
import { About } from "./pages/about";
import { Motto } from "./motto";

const pages = [
  {
    id: "main",
    title: t("翻译偏好", "Translation"),
    description: t(
      "让每一次阅读，都更自然。",
      "Make every page feel a little more familiar.",
    ),
    icon: ArrowRightLeft,
    keywords: "google edge language 语言 目标 双语 动态",
  },
  {
    id: "appearance",
    title: t("外观与显示", "Appearance"),
    description: t(
      "以你喜欢的方式，阅读两种语言。",
      "Two languages, styled for the way you read.",
    ),
    icon: Palette,
    keywords: "theme dark css style 主题 深色 浅色 样式",
  },
  {
    id: "rules",
    title: t("网站与语言", "Sites & languages"),
    description: t(
      "决定哪些内容自动翻译，哪些保持原样。",
      "Choose what gets translated automatically, and what stays original.",
    ),
    icon: Globe2,
    keywords: "always never rules 自动 永不 规则",
  },
  {
    id: "translations",
    title: t("词典与适配", "Dictionary & rules"),
    description: t(
      "为专业词汇和特定网站，添加一点定制。",
      "A little customization for your terminology and favorite sites.",
    ),
    icon: BookOpen,
    keywords: "json custom dictionary selectors 自定义 词条 选择器",
  },
  {
    id: "hotkeys",
    title: t("快捷键", "Keyboard shortcuts"),
    description: t(
      "把常用操作，放在指尖。",
      "Keep your most-used actions within reach.",
    ),
    icon: Keyboard,
    keywords: "shortcut keyboard 快捷键 键盘",
  },
  {
    id: "others",
    title: t("高级设置", "Advanced"),
    description: t(
      "微调扩展在浏览器中的行为。",
      "Fine-tune how the extension works in your browser.",
    ),
    icon: Settings2,
    keywords:
      "title navigation context menu mobile 标题 链接 菜单 移动 代码 pre",
  },
  {
    id: "storage",
    title: t("数据与备份", "Data & backup"),
    description: t(
      "管理本地缓存，保存你的个性化设置。",
      "Manage local storage and keep a copy of your preferences.",
    ),
    icon: Database,
    keywords: "import export reset cache storage 导入 导出 重置 缓存 存储",
  },
  {
    id: "donation",
    title: t("关于", "About"),
    description: t(
      "让语言不再成为阅读的边界。",
      "A more open web, one page at a time.",
    ),
    icon: Heart,
    keywords: "about support source 关于 开源 支持",
  },
];
function App() {
  const [page, setPage] = useState(location.hash.slice(1) || "main"),
    [search, setSearch] = useState(""),
    [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const update = () => {
      setPage(location.hash.slice(1) || "main");
      setSearch("");
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const current = pages.find((item) => item.id === page) ?? pages[0];
  const matching = pages.filter((item) =>
    `${item.title} ${item.description} ${item.keywords}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const navigation = (
    <nav aria-label={t("设置导航", "Settings navigation")}>
      {pages.map((item, index) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={current.id === item.id ? "page" : undefined}
          onClick={() => {
            setMenuOpen(false);
            setSearch("");
          }}
          className={`nav-item ${index === 4 || index === 7 ? "nav-divider" : ""}`}
        >
          <item.icon size={18} />
          <span>{item.title}</span>
          {item.id === current.id && <span className="nav-active-dot" />}
        </a>
      ))}
    </nav>
  );
  return (
    <div className="settings-layout">
      <aside className="sidebar">
        <Brand compact />
        <div className="sidebar-caption">{t("工作空间", "WORKSPACE")}</div>
        {navigation}
        <div className="sidebar-bottom">
          v{chrome.runtime.getManifest().version}
        </div>
      </aside>
      <div className="settings-main">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mobile-menu"
                  aria-label={t("打开导航", "Open navigation")}
                >
                  <Menu />
                </Button>
              </DialogTrigger>
              <DialogContent className="mobile-nav">
                <DialogHeader>
                  <DialogTitle>{t("设置", "Settings")}</DialogTitle>
                  <DialogDescription>
                    {t("选择设置分组", "Choose a settings group")}
                  </DialogDescription>
                </DialogHeader>
                {navigation}
              </DialogContent>
            </Dialog>
            <span className="text-muted-foreground">
              {t("设置", "Settings")}
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span>{current.title}</span>
          </div>
          <SaveStatus />
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR READING, YOUR WAY</div>
              <h1>{current.title}</h1>
              <p>{current.description}</p>
            </div>
            <div className="search-box">
              <Search size={16} />
              <Input
                aria-label={t("查找设置", "Find settings")}
                placeholder={t("查找设置…", "Find settings…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <ErrorNotice />
          {search ? (
            <div className="search-results panel">
              {matching.length ? (
                matching.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setSearch("")}
                  >
                    <item.icon size={20} />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <ChevronRight size={16} />
                  </a>
                ))
              ) : (
                <div className="empty-state">
                  <Search />
                  <p>{t("没有找到相关设置", "No matching settings")}</p>
                  <Button variant="link" onClick={() => setSearch("")}>
                    {t("清除搜索", "Clear search")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`content-grid ${["main", "appearance"].includes(current.id) ? "has-preview" : ""}`}
            >
              <div className="settings-content">
                {current.id === "main" ? (
                  <Translation />
                ) : current.id === "appearance" ? (
                  <Appearance />
                ) : current.id === "rules" ? (
                  <>
                    <RuleList
                      name="alwaysTranslateSites"
                      title={t(
                        "总是翻译的网站",
                        "Always translate these sites",
                      )}
                      description={t(
                        "打开这些网站时自动翻译。",
                        "Translate automatically when you visit these sites.",
                      )}
                    />
                    <RuleList
                      name="neverTranslateSites"
                      title={t("永不翻译的网站", "Never translate these sites")}
                      description={t(
                        "这些网站保持原文，不自动翻译。",
                        "Keep these sites in their original language.",
                      )}
                    />
                    <RuleList
                      name="alwaysTranslateLangs"
                      title={t(
                        "总是翻译的语言",
                        "Always translate these languages",
                      )}
                      description={t(
                        "检测到这些语言时自动翻译。",
                        "Translate automatically when these languages are detected.",
                      )}
                    />
                    <RuleList
                      name="neverTranslateLangs"
                      title={t(
                        "永不翻译的语言",
                        "Never translate these languages",
                      )}
                      description={t(
                        "阅读这些语言时保留原文。",
                        "Read these languages in their original form.",
                      )}
                    />
                  </>
                ) : current.id === "translations" ? (
                  <>
                    <Dictionary />
                    <SpecialRules />
                  </>
                ) : current.id === "hotkeys" ? (
                  <Shortcuts />
                ) : current.id === "others" ? (
                  <Advanced />
                ) : current.id === "storage" ? (
                  <Storage />
                ) : (
                  <About />
                )}
              </div>
              {["main", "appearance"].includes(current.id) && <Preview />}
            </div>
          )}
          <footer className="page-footer">
            <span>Wonder</span>
            <Motto />
          </footer>
        </main>
      </div>
    </div>
  );
}
document.documentElement.lang = chrome.i18n.getUILanguage();
createRoot(document.getElementById("root")!).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>,
);
