import { useState } from "react";
import { X, Sparkles, Wrench, Rocket } from "lucide-react";
import { CHANGELOG, CURRENT_VERSION, type ChangelogEntry } from "../../../shared/changelog";

const TYPE_CONFIG: Record<ChangelogEntry["type"], { label: string; icon: typeof Sparkles; cls: string }> = {
  major: { label: "major", icon: Rocket, cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  minor: { label: "feature", icon: Sparkles, cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  patch: { label: "fix", icon: Wrench, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

export function VersionBadge({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group"
      >
        <span className="text-[10px] font-mono text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
          v{CURRENT_VERSION}
        </span>
        {!collapsed && (
          <span className="text-[10px] text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 transition-colors">
            What's new
          </span>
        )}
      </button>

      {open && <ChangelogDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function ChangelogDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-lg z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Changelog</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current version: <span className="font-mono font-medium">v{CURRENT_VERSION}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />

            <div className="space-y-6">
              {CHANGELOG.map((entry, i) => {
                const config = TYPE_CONFIG[entry.type];
                const Icon = config.icon;
                const isLatest = i === 0;

                return (
                  <div key={entry.version} className="relative pl-7">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center ${
                      isLatest
                        ? "border-primary bg-primary"
                        : "border-border bg-background"
                    }`}>
                      {isLatest && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                    </div>

                    {/* Content */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">v{entry.version}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${config.cls}`}>
                          <Icon className="h-2.5 w-2.5" />
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDate(entry.date)}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{entry.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {entry.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border text-center shrink-0">
          <p className="text-[10px] text-muted-foreground">
            Caploom — Cap Table Manager
          </p>
        </div>
      </div>
    </>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
