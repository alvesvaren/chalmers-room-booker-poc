export type AppTabId = "schedule" | "rooms" | "mine";

const tabs: { id: AppTabId; label: string }[] = [
  { id: "schedule", label: "Schema" },
  { id: "rooms", label: "Rum" },
  { id: "mine", label: "Mina bokningar" },
];

export function AppTabs({ active, onChange }: { active: AppTabId; onChange: (id: AppTabId) => void }) {
  return (
    <div className='border-b border-te-border'>
      <div
        className='flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        role='tablist'
        aria-label='Huvudnavigering'
      >
        {tabs.map(t => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type='button'
              role='tab'
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`relative shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-te-accent ${
                selected ? "text-te-accent" : "text-te-muted hover:text-te-text"
              }`}
              onClick={() => onChange(t.id)}
            >
              {t.label}
              {selected ? <span className='absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-te-accent' /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
