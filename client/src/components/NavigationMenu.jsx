import {
  useEffect,
  useState,
} from "react";

const MENU_GROUPS = [
  {
    title: "Overview",

    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "▣",
      },

      {
        id: "market",
        label: "Live Market",
        icon: "↗",
      },

      {
        id: "charts",
        label: "Charts",
        icon: "▦",
      },

      {
        id: "wallet",
        label: "Wallet",
        icon: "$",
      },

      {
        id: "orders",
        label: "Orders & Trades",
        icon: "⇄",
      },
    ],
  },

  {
    title: "Automation",

    items: [
      {
        id: "engine",
        label: "Trading Engine",
        icon: "⚡",
      },

      {
        id: "selector",
        label: "Auto Market Selector",
        icon: "◎",
      },

      {
        id: "scanner",
        label: "Market Scanner",
        icon: "⌕",
      },

      {
        id: "risk",
        label: "Risk Manager",
        icon: "◆",
      },

      {
        id: "autotrader",
        label: "Auto Trader",
        icon: "▶",
      },
    ],
  },

  {
    title: "Analysis",

    items: [
      {
        id: "signals",
        label: "Signals",
        icon: "◉",
      },

      {
        id: "indicators",
        label: "Indicators",
        icon: "≋",
      },

      {
        id: "analytics",
        label: "Analytics",
        icon: "▥",
      },

      {
        id: "performance",
        label: "Server Performance",
        icon: "↗",
      },

      {
        id: "backtest",
        label: "Backtesting",
        icon: "◫",
      },
    ],
  },

  {
    title: "System",

    items: [
      {
        id: "activity",
        label: "Server Activity",
        icon: "☷",
      },
    ],
  },
];

function NavigationMenu({
  activeView,
  onNavigate,
  engineStatus,
  emergencyStop = false,
}) {
  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(
      false,
    );

  /*
   * Close the mobile drawer whenever the
   * selected page changes.
   */
  useEffect(
    () => {
      setMobileOpen(
        false,
      );
    },
    [
      activeView,
    ],
  );

  /*
   * Prevent the page behind the mobile
   * navigation drawer from scrolling.
   */
  useEffect(
    () => {
      if (
        !mobileOpen
      ) {
        document.body.style
          .overflow =
          "";

        return undefined;
      }

      document.body.style
        .overflow =
        "hidden";

      return () => {
        document.body.style
          .overflow =
          "";
      };
    },
    [
      mobileOpen,
    ],
  );

  function navigate(
    id,
  ) {
    onNavigate(
      id,
    );

    setMobileOpen(
      false,
    );
  }

  return (
    <>
      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Open navigation menu"
        aria-expanded={
          mobileOpen
        }
        onClick={() =>
          setMobileOpen(
            true,
          )
        }
      >
        <span />

        <span />

        <span />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="navigation-backdrop"
          aria-label="Close navigation menu"
          onClick={() =>
            setMobileOpen(
              false,
            )
          }
        />
      )}

      <aside
        className={
          mobileOpen
            ? "navigation-menu mobile-open"
            : "navigation-menu"
        }
      >
        <div className="navigation-header">
          <div className="navigation-brand-mark">
            B
          </div>

          <div>
            <span>
              TRADING BOT
            </span>

            <strong>
              Control Center
            </strong>
          </div>

          <button
            type="button"
            className="navigation-close"
            aria-label="Close navigation menu"
            onClick={() =>
              setMobileOpen(
                false,
              )
            }
          >
            ×
          </button>
        </div>

        <div className="navigation-engine-status">
          <div
            className={
              emergencyStop
                ? "navigation-status-dot danger"
                : engineStatus ===
                    "Monitoring"
                  ? "navigation-status-dot online"
                  : "navigation-status-dot"
            }
          />

          <div>
            <span>
              Trading engine
            </span>

            <strong>
              {emergencyStop
                ? "Emergency stop"
                : engineStatus ||
                  "Loading"}
            </strong>
          </div>
        </div>

        <nav className="navigation-groups">
          {MENU_GROUPS.map(
            (
              group,
            ) => (
              <section
                className="navigation-group"
                key={
                  group.title
                }
              >
                <p className="navigation-group-title">
                  {
                    group.title
                  }
                </p>

                <div className="navigation-links">
                  {group.items.map(
                    (
                      item,
                    ) => (
                      <button
                        type="button"
                        key={
                          item.id
                        }
                        className={
                          activeView ===
                          item.id
                            ? "navigation-link active"
                            : "navigation-link"
                        }
                        onClick={() =>
                          navigate(
                            item.id,
                          )
                        }
                      >
                        <span className="navigation-link-icon">
                          {
                            item.icon
                          }
                        </span>

                        <span className="navigation-link-label">
                          {
                            item.label
                          }
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </section>
            ),
          )}
        </nav>

        <div className="navigation-footer">
          <span>
            PAPER TRADING
          </span>

          <small>
            Server automation continues running when you change views.
          </small>
        </div>
      </aside>
    </>
  );
}

export default NavigationMenu;