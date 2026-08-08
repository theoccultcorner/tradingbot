import {
  useEffect,
  useState,
} from "react";

const DEFAULT_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "ADAUSD",
  "DOGEUSD",
  "LINKUSD",
  "AVAXUSD",
  "XRPUSD",
];

const DEFAULT_SETTINGS = {
  enabled: false,
  timeframe: "15m",
  minimumScore: 60,
  minimumConfidence: 60,
  scanIntervalMinutes: 5,
  symbols: DEFAULT_SYMBOLS,
};

function AutoMarketSelectorPanel({
  autoSelector,
}) {
  const {
    selector,
    loading,
    error,
    saveSettings,
    runNow,
  } = autoSelector;

  const [
    draft,
    setDraft,
  ] = useState(
    DEFAULT_SETTINGS,
  );

  /*
   * Whenever the server selector state changes,
   * synchronize the form with the saved values.
   */
  useEffect(() => {
    if (
      !selector?.settings
    ) {
      return;
    }

    setDraft({
      ...DEFAULT_SETTINGS,
      ...selector.settings,

      symbols:
        Array.isArray(
          selector.settings
            .symbols,
        ) &&
        selector.settings
          .symbols.length >
          0
          ? selector.settings
              .symbols
          : DEFAULT_SYMBOLS,
    });
  }, [
    selector?.settings,
  ]);

  function updateDraft(
    name,
    value,
  ) {
    setDraft(
      (previous) => ({
        ...previous,
        [name]:
          value,
      }),
    );
  }

  function toggleSymbol(
    symbol,
  ) {
    const currentSymbols =
      Array.isArray(
        draft.symbols,
      )
        ? draft.symbols
        : [];

    updateDraft(
      "symbols",

      currentSymbols.includes(
        symbol,
      )
        ? currentSymbols.filter(
            (item) =>
              item !==
              symbol,
          )
        : [
            ...currentSymbols,
            symbol,
          ],
    );
  }

  async function handleSave() {
    const result =
      await saveSettings(
        draft,
      );

    if (
      result?.success
    ) {
      /*
       * The hook updates selector state
       * from the server response.
       *
       * useEffect above then synchronizes
       * the visible form.
       */
      return;
    }
  }

  async function handleToggle() {
    const nextEnabled =
      !selector.settings
        ?.enabled;

    await saveSettings({
      ...draft,

      enabled:
        nextEnabled,
    });
  }

  return (
    <section className="panel auto-selector-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">
            AUTOMATIC MARKET ROTATION
          </span>

          <h2>
            Best-Market Selector
          </h2>
        </div>

        <button
          type="button"
          className={
            selector.settings
              ?.enabled
              ? "auto-toggle enabled"
              : "auto-toggle"
          }
          disabled={loading}
          onClick={
            handleToggle
          }
        >
          {selector.settings
            ?.enabled
            ? "Enabled"
            : "Disabled"}
        </button>
      </div>

      <div className="auto-settings-grid">
        <label>
          <span>
            Timeframe
          </span>

          <select
            value={
              draft.timeframe
            }
            onChange={(
              event,
            ) =>
              updateDraft(
                "timeframe",
                event.target
                  .value,
              )
            }
          >
            <option value="5m">
              5m
            </option>

            <option value="15m">
              15m
            </option>

            <option value="1h">
              1h
            </option>

            <option value="4h">
              4h
            </option>
          </select>
        </label>

        <label>
          <span>
            Minimum score
          </span>

          <input
            type="number"
            value={
              draft.minimumScore
            }
            onChange={(
              event,
            ) =>
              updateDraft(
                "minimumScore",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Minimum confidence
          </span>

          <input
            type="number"
            value={
              draft.minimumConfidence
            }
            onChange={(
              event,
            ) =>
              updateDraft(
                "minimumConfidence",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Scan interval
          </span>

          <input
            type="number"
            min="1"
            value={
              draft
                .scanIntervalMinutes
            }
            onChange={(
              event,
            ) =>
              updateDraft(
                "scanIntervalMinutes",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>
      </div>

      <div className="scanner-symbols">
        {DEFAULT_SYMBOLS.map(
          (symbol) => {
            const selected =
              Array.isArray(
                draft.symbols,
              ) &&
              draft.symbols.includes(
                symbol,
              );

            return (
              <button
                type="button"
                key={symbol}
                className={
                  selected
                    ? "scanner-symbol active"
                    : "scanner-symbol"
                }
                onClick={() =>
                  toggleSymbol(
                    symbol,
                  )
                }
              >
                {symbol.replace(
                  "USD",
                  "",
                )}
              </button>
            );
          },
        )}
      </div>

      <div className="selector-actions">
        <button
          type="button"
          className="run-scanner-button"
          disabled={loading}
          onClick={
            handleSave
          }
        >
          {loading
            ? "Saving..."
            : "Save Settings"}
        </button>

        <button
          type="button"
          className="run-scanner-button"
          disabled={loading}
          onClick={
            runNow
          }
        >
          Scan Now
        </button>
      </div>

      {error && (
        <p className="scanner-error">
          {error}
        </p>
      )}

      <div className="selector-result">
        <span>
          Latest selection
        </span>

        <strong>
          {selector
            .lastSelection
            ?.symbol ||
            "No qualified market"}
        </strong>

        <small>
          {selector
            .lastSelection
            ?.label ||
            "Waiting for a scan"}
        </small>

        {selector
          .lastSelection
          ?.score !==
          null &&
          selector
            .lastSelection
            ?.score !==
            undefined && (
            <small>
              Score:{" "}
              {
                selector
                  .lastSelection
                  .score
              }{" "}
              · Confidence:{" "}
              {
                selector
                  .lastSelection
                  .confidence
              }
              %
            </small>
          )}
      </div>

      <p className="auto-trader-note">
        The selector only changes the active server market when a
        full BUY setup meets both thresholds. It does not bypass
        the server trading engine or risk controls.
      </p>
    </section>
  );
}

export default AutoMarketSelectorPanel;