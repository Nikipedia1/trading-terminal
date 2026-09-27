# Order-flow formulas (reproducible from raw aggressor ticks)

All quantities use **aggressor side** from the public trade stream:
- Binance `m` (isBuyerMaker): `true` → aggressor = **sell**, `false` → aggressor = **buy**
- Same mapping on Bybit/OKX after normalization

Never invent ticks. Empty buffer → empty metrics.

## Footprint cell

```
cell(timeSec, priceTick).buyQty  = Σ qty where aggressor=buy  ∧ trade in candle ∧ round(price)=priceTick
cell(...).sellQty = Σ qty where aggressor=sell ∧ …
cell.delta = buyQty − sellQty
```

## Bar aggregates

```
barDelta     = Σ cell.delta over price in bar
barBuy / barSell = Σ buyQty / Σ sellQty
POC_bar      = priceTick with max (buyQty+sellQty) in that bar
unfinished_auction_high = true if highest traded tick in bar has sellQty==0 and buyQty>0
unfinished_auction_low  = true if lowest  traded tick in bar has buyQty==0  and sellQty>0
```
(Unfinished auction = one side of the extreme print is zero — classic footprint reading.)

## Effective / Trapped (Deep Trades)

```
Given print at price P, time t, aggressor side S.
Let C = first fully closed candle with open > candle containing t.

effective_buy  = S=buy  ∧ C.close > P
effective_sell = S=sell ∧ C.close < P
trapped_*      = opposite
pending        = no closed next candle yet
```

## Stacked imbalance

```
ratio(level) = buy / (buy+sell)   (0 if tot=0)
buy_imbalance  = ratio ≥ 0.7
sell_imbalance = ratio ≤ 0.3
stacked_run    = max consecutive buy_imbalance (or sell) along adjacent ticks
```

## Absorption / aggression (candle)

```
delta = barDelta from ticks
closePos = (close−low)/(high−low)
strong = |delta| ≥ 35% of max |delta| in window

aggression_buy  = strong ∧ delta>0 ∧ closePos ≥ 2/3
aggression_sell = strong ∧ delta<0 ∧ closePos ≤ 1/3
absorption_buy  = strong ∧ delta>0 ∧ closePos ≤ 0.5   # buy volume, price held low
absorption_sell = strong ∧ delta<0 ∧ closePos ≥ 0.5
```

## Iceberg heuristic (not detection)

Public L2 cannot prove icebergs. Heuristic only:

```
At price P over window W:
  tradeVol = Σ aggressor qty at P
  bookMax  = max resting size observed at P in W (if book samples exist)
  score    = tradeVol / max(bookMax, ε)
iceberg_suspect = score ≥ K (default K=3) ∧ tradeVol ≥ minNotional
```

## CVD

```
CVD[t] = Σ barDelta[i] for i ≤ t   (from first bar in series)
```

## Value area

Standard: sort buckets by volume, expand from POC alternating high/low until ≥ vaTarget (0.68/0.70/0.80) of total volume.
