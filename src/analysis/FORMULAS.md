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
absorption_buy  = strong ∧ delta>0 ∧ closePos ≤ 0.5
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

## Order Flow Imbalance (OFI) – Cont, Kukanov & Stoikov 2014

L1 (best quotes only):

```
e_n (bid):
  if bidPrice ↑ → +curr.bidSize
  if bidPrice same → +(curr.bidSize − prev.bidSize)
  if bidPrice ↓ → −prev.bidSize

e_n (ask):
  if askPrice ↓ → −curr.askSize
  if askPrice same → −(curr.askSize − prev.askSize)
  if askPrice ↑ → +prev.askSize

OFI_step = e_bid + e_ask
OFI_cum  = Σ OFI_step over interval
```

## Multi-level OFI (MLOFI)

Same Cont rules applied independently at each of the top N levels (default N=5),
then summed (equal weight, or optional harmonic/linear decay):

```
for k = 0 .. N-1:
  contrib_k = levelBidContribution(prev.bids[k], curr.bids[k])
            + levelAskContribution(prev.asks[k], curr.asks[k])
  weight_k  = 1 | 1/(k+1) | (N−k)/N
MLOFI_step = Σ weight_k · contrib_k
MLOFI_cum  = Σ MLOFI_step
```

Missing levels contribute 0 — never invent sizes/prices.

Multi-level depth imbalance:

```
bidTot = Σ size over top N bids
askTot = Σ size over top N asks
multiDepthImb = (bidTot − askTot) / (bidTot + askTot)   ∈ [-1, 1]
```

## Cyclic analysis (real OHLCV only)

Never invent bars. Empty / short series → empty model (`ready: false`).

### Dominant + secondary period (autocorrelation)

```
detrend = close − SMA(close, maxPeriod/2)
for lag ∈ [minPeriod, maxPeriod]:
  corr(lag) = Σ (det[i]−μ)(det[i−lag]−μ) / Σ (det−μ)²
dominantPeriod = argmax corr(lag)
strength = clamp(corr(dominantPeriod), 0, 1)

# Secondary: same search excluding ±25% neighbourhood of primary lag
secondaryPeriod = argmax corr(lag)  for lag outside exclude band
```

Fixed period override when `fixedPeriod ≥ minPeriod`.

### Bandpass cycle (Ehlers-inspired 2-pole)

```
β = cos(2π / period)
γ = 1 / cos(2π · bandwidth / period)   # bandwidth ≈ 0.35
α = γ − √(γ² − 1)

hp[i] = 0.5(1+α)(close[i]−close[i−1]) + α·hp[i−1]
cycle[i] = 0.5(1−α)(hp[i]−hp[i−1]) + β(1+α)·cycle[i−1] − α·cycle[i−2]
wave = SMA(close, period) + cycle
```

Secondary wave uses `secondaryPeriod` the same way.

### Phase

```
re = cycle[i]
im = cycle[i] − cycle[i−1]
phaseDeg = atan2(im, re) · 180/π   ∈ [0, 360)
```

Cycle-high marks ≈ phase crossing 0°; cycle-low ≈ crossing 180°.

### Amplitude envelope (RMS)

```
win = max(3, floor(period / 2))
amp[i] = √( mean( cycle[j]² for j ∈ [i−win+1, i] ) )
ampUpper = trend + amp
ampLower = trend − amp
```

### Projected turning points

Uses real last bar time + measured bar duration only (no synthetic prices):

```
barsToHigh = (360 − phaseDeg) / 360 · period
barsToLow  = (180 − phaseDeg) / 360 · period   # wrapped
nextHighTime = lastTime + barsToHigh · barDurationSec
nextLowTime  = lastTime + barsToLow  · barDurationSec
barsToNextTurn = min(barsToHigh, barsToLow)
```

### Schaff Trend Cycle (STC)

```
macd = EMA(close, 23) − EMA(close, 50)
st1  = 100 · stoch(macd, cycleLen)
pf   = smooth(st1, factor 0.5)
STC  = smooth( 100 · stoch(pf, cycleLen), factor 0.5 )   ∈ [0, 100]
```

### Weekday seasonality (UTC)

```
for each bar i ≥ 1:
  ret% = (close[i] − close[i−1]) / close[i−1] · 100
  dow  = UTC weekday of bar time (0=Sun … 6=Sat)
  bucket[dow].sum += ret%;  bucket[dow].n += 1
avgPct[dow] = sum / n   (0 if n=0)
```
