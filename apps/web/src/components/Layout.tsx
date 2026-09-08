import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { shortAddress } from "../lib/format";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const { user, logout, authenticated } = usePrivy();

  const wallet = user?.wallet;
  const address = (wallet?.address as string | undefined) ?? null;
  const email =
    (user?.email as { address?: string } | undefined)?.address ?? null;
  const avatar = email
    ? email
        .split("@")[0]!
        .slice(0, 2)
        .toUpperCase()
    : "SH";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">S</div>
          <span className="sidebar-logo-text">splitHappens</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Overview</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <DashboardIcon />
            <span>Dashboard</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{avatar}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{email ?? "You"}</div>
              <div className="sidebar-user-address">
                {authenticated && address
                  ? shortAddress(address)
                  : "not connected"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">Arc Testnet · USDC</div>
          <div className="topbar-actions">
            {authenticated && (
              <button
                className="btn btn-ghost"
                onClick={() => void logout()}
              >
                Log out
              </button>
            )}
          </div>
        </header>
        <div className="page">{children}</div>
      </main>
    </div>
  );
}

function DashboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
