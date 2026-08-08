function formatMoney(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  );
}

function formatQuantity(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        8,
    },
  );
}

function formatPercent(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return `${
    number >= 0
      ? "+"
      : ""
  }${number.toFixed(
    2,
  )}%`;
}

function getProfitClass(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    number > 0
  ) {
    return "positive";
  }

  if (
    number < 0
  ) {
    return "negative";
  }

  return "neutral";
}

function WalletPanel({
  walletState,
}) {
  const {
    wallet,
    loading,
    error,
    loadWallet,
  } =
    walletState;

  if (
    loading &&
    !wallet
  ) {
    return (
      <section className="wallet-panel">
        <p>
          Loading wallet…
        </p>
      </section>
    );
  }

  if (!wallet) {
    return (
      <section className="wallet-panel">
        <p className="scanner-error">
          {error ||
            "Wallet unavailable."}
        </p>
      </section>
    );
  }

  const balances =
    Array.isArray(
      wallet.balances,
    )
      ? wallet.balances
      : [];

  return (
    <section className="wallet-panel">
      <div className="wallet-header">
        <div>
          <p className="panel-eyebrow">
            PAPER TRADING ACCOUNT
          </p>

          <h2>
            Wallet Balances
          </h2>
        </div>

        <button
          type="button"
          className="wallet-refresh-button"
          onClick={
            loadWallet
          }
          disabled={
            loading
          }
        >
          {loading
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </div>

      <div className="wallet-total-card">
        <span>
          Total Portfolio Balance
        </span>

        <strong>
          {formatMoney(
            wallet.totalBalance,
          )}
        </strong>

        <small
          className={getProfitClass(
            wallet.totalProfit,
          )}
        >
          {formatMoney(
            wallet.totalProfit,
          )}
          {" "}
          ·
          {" "}
          {formatPercent(
            wallet.totalReturnPercent,
          )}
        </small>
      </div>

      <div className="wallet-summary">
        <article>
          <span>
            USD Available
          </span>

          <strong>
            {formatMoney(
              wallet.cash,
            )}
          </strong>
        </article>

        <article>
          <span>
            Crypto Holdings
          </span>

          <strong>
            {formatMoney(
              wallet.cryptoValue,
            )}
          </strong>
        </article>

        <article>
          <span>
            Coins Held
          </span>

          <strong>
            {
              wallet.assetCount
            }
          </strong>
        </article>

        <article>
          <span>
            Realized P/L
          </span>

          <strong
            className={getProfitClass(
              wallet.realizedProfit,
            )}
          >
            {formatMoney(
              wallet.realizedProfit,
            )}
          </strong>
        </article>
      </div>

      <div className="wallet-assets-heading">
        <h3>
          Available Balances
        </h3>

        <span>
          Amount available to trade
        </span>
      </div>

      <div className="wallet-balance-list">
        <article className="wallet-balance-card wallet-usd-balance">
          <div className="wallet-balance-name">
            <strong>
              USD
            </strong>

            <small>
              Cash
            </small>
          </div>

          <div className="wallet-balance-primary">
            <span>
              Available
            </span>

            <strong>
              {formatMoney(
                wallet.cash,
              )}
            </strong>
          </div>

          <div className="wallet-balance-secondary">
            <span>
              Ready for new purchases
            </span>
          </div>
        </article>

        {balances.map(
          (
            balance,
          ) => (
            <article
              className="wallet-balance-card"
              key={
                balance.symbol
              }
            >
              <div className="wallet-balance-name">
                <strong>
                  {
                    balance.asset
                  }
                </strong>

                <small>
                  {
                    balance.symbol
                  }
                </small>
              </div>

              <div className="wallet-balance-primary">
                <span>
                  Balance
                </span>

                <strong>
                  {formatQuantity(
                    balance.quantity,
                  )}
                  {" "}
                  {
                    balance.asset
                  }
                </strong>
              </div>

              <div className="wallet-balance-primary">
                <span>
                  Available to trade
                </span>

                <strong className="positive">
                  {formatQuantity(
                    balance.quantity,
                  )}
                  {" "}
                  {
                    balance.asset
                  }
                </strong>
              </div>

              <div className="wallet-balance-details">
                <div>
                  <span>
                    Current price
                  </span>

                  <strong>
                    {formatMoney(
                      balance.price,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    USD value
                  </span>

                  <strong>
                    {formatMoney(
                      balance.marketValue,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Avg. entry
                  </span>

                  <strong>
                    {formatMoney(
                      balance.averageEntryPrice,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Unrealized P/L
                  </span>

                  <strong
                    className={getProfitClass(
                      balance.unrealizedProfit,
                    )}
                  >
                    {formatMoney(
                      balance.unrealizedProfit,
                    )}
                  </strong>

                  <small
                    className={getProfitClass(
                      balance.unrealizedPercent,
                    )}
                  >
                    {formatPercent(
                      balance.unrealizedPercent,
                    )}
                  </small>
                </div>
              </div>
            </article>
          ),
        )}

        {balances.length ===
          0 && (
          <p className="empty-state">
            No cryptocurrency is currently held.
          </p>
        )}
      </div>

      {error && (
        <p className="scanner-error">
          {
            error
          }
        </p>
      )}
    </section>
  );
}

export default WalletPanel;