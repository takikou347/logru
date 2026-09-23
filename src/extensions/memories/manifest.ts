import type { ExtensionManifest } from "../types";

/** 思い出。旅行やお出かけのしおりと記録と写真。グループごとに切り替える。docs/logru/extensions/memories */
export const memoriesManifest: ExtensionManifest = {
  key: "memories",
  label: "思い出",
  description: "旅行やお出かけのしおりと、写真の記録をまとめる。ふとした出来事も、その日に残せる。",
  alwaysOn: false,
  notificationKinds: ["memories.like"],
  tour: [
    {
      target: '[aria-label="思い出の操作"]',
      text: "旅行の前に「思い出を作る」で、しおりを作れます。日々のことは「記録する」から写真と一言で残せます。",
    },
  ],
};
