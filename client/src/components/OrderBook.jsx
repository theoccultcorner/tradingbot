function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatQuantity(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  });
}

function normalizeLevel(level) {
  if (Array.isArray(level)) {
    return {
      price: Number(level[0]),
      quantity: Number(level[1]),
    };
  }

  return {
    price: Number(level?.price),
    quantity: Number(
      level?.quantity ?? level?.qty ?? level?.size,
    ),
  };
}

function BookRow({
  level,
  side,
  maximumQuantity,
}) {
  const normalized = normalizeLevel(level);

  const depthPercent =
    maximumQuantity > 0
      ? Math.min(
          (normalized.quantity / maximumQuantity) * 100,
          100,
        )
      : 0;

  return (
    <div className={`book-row ${side}`}>
      <div
        className="book-depth"
        style={{
          width: `${depthPercent}%`,
        }}
      />

      <span className="book-price">
        {formatPrice(normalized.price)}
      </span>

      <span>{formatQuantity(normalized.quantity)}</span>

      <span>
        {formatQuantity(
          normalized.price * normalized.quantity,
        )}
      </span>
    </div>
  );
}

function OrderBook({
  bids = [],
  asks = [],
  spread = null,
  limit = 10,
}) {
  const visibleBids = bids.slice(0, limit);
  const visibleAsks = asks.slice(0, limit).reverse();

  const allLevels = [...visibleBids, ...visibleAsks].map(
    normalizeLevel,
  );

  const maximumQuantity = Math.max(
    ...allLevels.map((level) => level.quantity || 0),
    0,
  );

  return (
    <section className="panel order-book-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">MARKET DEPTH</p>
          <h2>Order Book</h2>
        </div>

        <span className="spread-label">
          Spread: ${formatPrice(spread)}
        </span>
      </div>

      <div className="book-columns book-header">
        <span>Price</span>
        <span>Amount</span>
        <span>Total</span>
      </div>

      <div className="book-side asks">
        {visibleAsks.length > 0 ? (
          visibleAsks.map((level, index) => {
            const normalized = normalizeLevel(level);

            return (
              <BookRow
                key={`ask-${normalized.price}-${index}`}
                level={level}
                side="ask"
                maximumQuantity={maximumQuantity}
              />
            );
          })
        ) : (
          <p className="empty-state">Waiting for asks…</p>
        )}
      </div>

      <div className="order-book-spread">
        <strong>
          {spread === null
            ? "Waiting for market data"
            : `$${formatPrice(spread)} spread`}
        </strong>
      </div>

      <div className="book-side bids">
        {visibleBids.length > 0 ? (
          visibleBids.map((level, index) => {
            const normalized = normalizeLevel(level);

            return (
              <BookRow
                key={`bid-${normalized.price}-${index}`}
                level={level}
                side="bid"
                maximumQuantity={maximumQuantity}
              />
            );
          })
        ) : (
          <p className="empty-state">Waiting for bids…</p>
        )}
      </div>
    </section>
  );
}

export default OrderBook;