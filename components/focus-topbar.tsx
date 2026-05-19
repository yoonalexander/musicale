interface FocusTopbarItem {
  label: string;
  value: React.ReactNode;
}

interface FocusTopbarProps {
  leftNav: React.ReactNode;
  modeTitle: string;
  items: FocusTopbarItem[];
  accountSlot: React.ReactNode;
}

export function FocusTopbar({
  leftNav,
  modeTitle,
  items,
  accountSlot,
}: FocusTopbarProps) {
  return (
    <header className="focus-topbar">
      <div className="focus-topbar__left">{leftNav}</div>

      <div className="focus-topbar__center">
        <div className="focus-topbar__mode">{modeTitle}</div>
        {items.map((item) => (
          <div className="focus-topbar__item" key={item.label}>
            <span className="focus-topbar__label">{item.label}</span>
            <strong className="focus-topbar__value">{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="focus-topbar__right">{accountSlot}</div>
    </header>
  );
}
