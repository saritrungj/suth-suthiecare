import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Homepage sections are addressed by hash so links work from any page.
const ITEMS = [
  { to: "/#services", key: "services" },
  { to: "/#steps", key: "steps" },
  { to: "/help-center", key: "help" },
  { to: "/history", key: "history" },
];

export default function PublicNavLinks({ onNavigate, className = "" }) {
  const { t } = useTranslation();
  const { pathname, hash } = useLocation();

  const isActive = (to) => {
    const [path, section] = to.split("#");
    if (section) return pathname === "/" && hash === `#${section}`;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const handleClick = (event, to) => {
    const [path, section] = to.split("#");
    // Already on the homepage: scroll instead of re-routing.
    if (section && pathname === path) {
      const target = document.getElementById(section);
      if (target) {
        event.preventDefault();
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
        window.history.replaceState(null, "", to);
      }
    }
    onNavigate?.();
  };

  return (
    <ul className={`pub-nav-links ${className}`}>
      {ITEMS.map((item) => (
        <li key={item.key}>
          <Link
            to={item.to}
            aria-current={isActive(item.to) ? "page" : undefined}
            onClick={(event) => handleClick(event, item.to)}
          >
            {t(`public_nav.${item.key}`)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
