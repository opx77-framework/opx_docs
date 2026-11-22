import { Download, GitBranch } from "lucide-react";
import { org } from "@/lib/shared";

const button =
  "not-prose inline-flex items-center gap-1.5 rounded-md border bg-fd-card px-3 py-1.5 text-sm font-medium text-fd-foreground no-underline transition-colors hover:bg-fd-accent";

/** GitHub and download buttons at the top of a resource page. */
export function ResourceLinks({ repo }: { repo: string }) {
  const github = `https://github.com/${org}/${repo}`;
  return (
    <div className="not-prose mb-6 flex flex-row gap-2">
      <a className={button} href={github} target="_blank" rel="noreferrer">
        <GitBranch className="size-4" /> GitHub
      </a>
      <a className={button} href={`${github}/archive/refs/heads/main.zip`}>
        <Download className="size-4" /> Download
      </a>
    </div>
  );
}
