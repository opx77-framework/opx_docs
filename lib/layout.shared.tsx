import { BookIcon, Boxes, Network } from "lucide-react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, org } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <span className="font-mono font-bold tracking-tight">{appName}</span>,
      url: "/docs",
    },
    githubUrl: `https://github.com/${org}`,
    links: [
      { type: "main", text: "Documentation", url: "/docs", icon: <BookIcon />, on: "nav" },
      { type: "main", text: "Architecture", url: "/docs/architecture", icon: <Network />, on: "all" },
      { type: "main", text: "Resources", url: "/docs/resources", icon: <Boxes />, on: "all" },
    ],
  };
}
