import { useState } from "react";
import { t } from "./model";

const mottos = [
  {
    text: t("让好内容，没有语言边界。", "Good ideas belong in every language."),
  },
  { text: t("轻盈，专注于阅读。", "Less friction. More reading.") },
  {
    text: t("阅读使人充实。", "Reading maketh a full man."),
    author: t("弗朗西斯·培根", "Francis Bacon"),
    source:
      "https://en.wikisource.org/wiki/The_Essays_of_Francis_Bacon/L_Of_Studies",
  },
  {
    text: t("没有一艘船能像一本书。", "There is no Frigate like a Book"),
    author: t("艾米莉·狄金森", "Emily Dickinson"),
    source:
      "https://www.poetryfoundation.org/poems/52199/there-is-no-frigate-like-a-book-1286",
  },
];

export function Motto() {
  const [motto] = useState(
    () => mottos[Math.floor(Math.random() * mottos.length)],
  );
  return (
    <div className="motto" aria-label={t("阅读寄语", "Reading motto")}>
      <span>{motto.text}</span>
      {motto.author && (
        <a href={motto.source} target="_blank" rel="noreferrer">
          — {motto.author}
        </a>
      )}
    </div>
  );
}
