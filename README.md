# ⚡ Scalper AI — User Guide

> **Multi-Agent Scalping Intelligence — Sub-Minute Trade Signals**
> A fast, mobile-first PWA that runs 7 AI agents in sequence to generate short-timeframe scalp signals.

---

## What is Scalper AI?

Scalper AI is the scalping-focused evolution of Kamote Trading AI. Instead of macro fundamentals and long-term sentiment, it focuses entirely on **sub-minute to 15-minute timeframe analysis** using agents that mirror how professional scalpers think.

### The 7-Agent Pipeline

| Phase | Agent | What It Analyzes |
|-------|-------|-----------------|
| 1 | Price Action | Candlestick structure, bar bias, ATR, volume profile |
| 2 | Order Flow | Bid/ask delta, imbalance %, book depth, big trades |
| 3 | Momentum | RSI (1m/5m/15m), MACD, Stochastic, EMA stack |
| 4 | Microstructure | Intraday S/R, VWAP position, liquidity pockets, session |
| 5 | Entry Signal | Votes across agents → LONG / SHORT / NO TRADE |
| 6 | Risk Gate | R:R check, position sizing, approval/block |
| 7 | Execution | Order type, urgency level, execution brief |

---

## Files

Place all 4 files in the **same folder**:
- `index.html` — UI
- `engine.js` — All logic, simulation, AI calls
- `manifest.json` — PWA manifest
- `sw.js` — Service worker (offline support)

Open `index.html` in Chrome, Safari, Edge, or Firefox.

---

## AI Provider Setup

Default is **Simulation Mode** — free, instant, no API key needed.

To use a real AI:
1. Go to ⚙ **Settings** tab
2. Choose your provider (OpenAI, Claude, Gemini, Groq, etc.)
3. Paste your API key
4. Tap **SAVE**

Groq is recommended for scalping — it's the fastest inference available.

---

## Supported Symbols

| Asset Class | Examples |
|-------------|---------|
| Crypto | BTCUSD, ETHUSD, SOLUSDT |
| Forex | EURUSD, GBPUSD, USDJPY |
| Gold/Commodities | XAUUSD, XAGUSD |
| Equities | AAPL, TSLA, NVDA, MSFT |

---

## Timeframes

| TF | Use For |
|----|---------|
| 1m | Ultra-fast scalps (seconds to 2 min holds) |
| 3m | Standard scalp (2–5 min holds) |
| 5m | Comfortable scalp (5–10 min holds) |
| 15m | Momentum scalp (10–30 min holds) |

---

## Understanding the Signal

### Exec Banner
- **LONG** (green) / **SHORT** (red) / **NO TRADE** (grey)
- **URGENCY**: IMMEDIATE → act now | READY → set order | STANDBY → wait

### Entry Levels
- **Entry** — suggested fill price
- **T1** — first target (partial exit, 1:1.5R minimum)
- **T2** — extended target (trail stop from T1)
- **Stop Loss** — hard exit level

### Risk Gate Status
- ✓ **APPROVED** — full size, proceed
- ⚠ **REDUCE** — half size, lower confidence
- ✕ **BLOCKED** — do not trade (bad R:R or no signal)

### Signal Confidence
- Driven by vote alignment across all 4 analysis agents
- Below 60% → Risk Gate reduces size
- Above 80% → Immediate execution recommended

---

## Install as PWA (Add to Home Screen)

**Android (Chrome):** Menu → Add to Home Screen  
**iPhone (Safari):** Share → Add to Home Screen

Works offline after first load.

---

## Disclaimer

> ⚠ Scalper AI is for educational and simulation purposes only. All signals are AI-generated and do not constitute financial advice. Scalp trading carries substantial risk of loss. Always use stop losses and proper risk management. DYOR. Trade responsibly.

---

*⚡ Scalper AI v1.0 — rebuilt from Kamote Trading AI*
