import { NavLink } from "react-router-dom";
import { Pencil, ClipboardList, Star } from "lucide-react";

const tabs = [
  { to: "/", label: "批改", icon: Pencil },
  { to: "/history", label: "历史", icon: ClipboardList },
  { to: "/errors", label: "错题集", icon: Star },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-light bg-white">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[13px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-text-tertiary"
              }`
            }
          >
            <Icon size={22} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
