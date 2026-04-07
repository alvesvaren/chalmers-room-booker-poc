import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export type AppTabId = "schedule" | "rooms" | "mine";

const tabDefs: { id: AppTabId; labelKey: string }[] = [
  { id: "rooms", labelKey: "tabs.rooms" },
  { id: "schedule", labelKey: "tabs.schedule" },
  { id: "mine", labelKey: "tabs.mine" },
];

export function AppTabs({
  active,
  onChange,
}: {
  active: AppTabId;
  onChange: (id: AppTabId) => void;
}) {
  const { t } = useTranslation();
  const tabs = useMemo(
    () => tabDefs.map((d) => ({ id: d.id, label: t(d.labelKey) })),
    [t],
  );

  return (
    <div className="border-te-border border-b">
      <div
        className="flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t("tabs.mainNav")}
      >
        {tabs.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`focus-visible:outline-te-accent relative shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                selected ? "text-te-accent" : "text-te-muted hover:text-te-text"
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {selected ? (
                <span className="bg-te-accent absolute inset-x-2 bottom-0 h-0.5 rounded-full" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
