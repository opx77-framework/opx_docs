import { BookText, MessagesSquare } from "lucide-react";
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
      { type: "main", text: "Documentation", url: "/docs", icon: <BookText />, on: "all" },
      {
        type: "main",
        text: "Issues",
        url: `https://github.com/${org}`,
        icon: <MessagesSquare />,
        on: "all",
        external: true,
      },
    ],
  };
}
