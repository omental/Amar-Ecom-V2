type Tab = {
  id: string;
  label: string;
};

export function OpsTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-[24px] border border-[var(--color-brd)] bg-white p-2 shadow-[var(--shadow-subtle)]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-[18px] px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-subtle)]"
                  : "text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
