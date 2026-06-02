# 🍠 Kamote Trading AI — User Guide

> **Multi-Agent Intelligence for Financial Markets**
> A step-by-step tutorial for getting started and making the most of the app.

---

## Table of Contents

1. [What is Kamote Trading AI?](#1-what-is-kamote-trading-ai)
2. [Getting Started — Installation](#2-getting-started--installation)
3. [Setting Up Your AI Provider](#3-setting-up-your-ai-provider)
4. [Running Your First Analysis](#4-running-your-first-analysis)
5. [Understanding the Results](#5-understanding-the-results)
6. [Using the Watchlist](#6-using-the-watchlist)
7. [Viewing History](#7-viewing-history)
8. [Exporting Reports](#8-exporting-reports)
9. [Tips & Tricks](#9-tips--tricks)
10. [Disclaimer](#10-disclaimer)

---

## 1. What is Kamote Trading AI?

Kamote Trading AI is a **mobile-first progressive web app (PWA)** that simulates a team of AI financial analysts working together to evaluate any asset — stocks, crypto, forex, or commodities.

Instead of one AI opinion, you get a **multi-agent pipeline** with five phases:

| Phase | Agent | What It Does |
|-------|-------|-------------|
| Phase 1 | Fundamentals Analyst | Evaluates financial health, metrics, and valuation |
| Phase 1 | Sentiment Analyst | Reads crowd psychology, fear & greed, social volume |
| Phase 1 | Technical Analyst | Reads charts, trends, RSI, MACD, support/resistance |
| Phase 1 | News Analyst | Scans recent headlines and assesses news impact |
| Phase 2 | Bull & Bear Research | Debate: argues both sides of the trade |
| Phase 3 | Trader Agent | Makes a BUY / SELL / HOLD call with entry & targets |
| Phase 4 | Risk Manager | Reviews the trade, approves or rejects it |
| Phase 5 | Portfolio Manager | Delivers the final verdict and allocation |

---

## 2. Getting Started — Installation

### Option A — Use directly in your browser

1. Download all four files and place them in the **same folder**:
   - `index.html`
   - `works.js`
   - `manifest.json`
   - `sw.js`

2. Open `index.html` in any modern browser (Chrome, Safari, Edge, Firefox).

> ⚠️ **Important:** Open the file through a local server or directly — do not rename or move individual files. They must stay together in the same folder.

### Option B — Install as a PWA (Add to Home Screen)

On **Android (Chrome)**:
1. Open the app in Chrome.
2. Tap the **three-dot menu** (⋮) in the top right.
3. Tap **"Add to Home screen"**.
4. Name it **Kamote Trading AI** and tap **Add**.

On **iPhone/iPad (Safari)**:
1. Open the app in Safari.
2. Tap the **Share** button (the box with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**.

The app will now appear on your home screen like a native app — with the 🍠 icon — and works **offline** after the first load.

---

## 3. Setting Up Your AI Provider

By default, Kamote Trading AI runs in **Simulation Mode** — no API key needed. It generates realistic, randomized market analysis instantly.

To connect a **real AI** for live responses:

**Step 1** — Tap the ⚙ Settings tab at the bottom of the screen (or tap ⚙ in the top-right header).

**Step 2** — Under **AI Provider**, choose your provider:

| Provider | Best For |
|----------|----------|
| Simulation | Free, instant, no setup |
| OpenAI (GPT) | General purpose, reliable |
| Anthropic (Claude) | Nuanced analysis, strong reasoning |
| Google (Gemini) | Fast, multimodal |
| DeepSeek | Cost-efficient |
| Groq | Ultra-fast inference |
| Mistral AI | Lightweight, open-source |
| OpenRouter | Access multiple models with one key |

**Step 3** — Paste your **API Key** in the field provided.

**Step 4** — Optionally, enter a **Model Name** (leave blank for the provider's default).

**Step 5** — Tap **Save Settings**.

> 🔒 Your API key is stored only in your browser's local storage. It is never sent to any server other than your chosen AI provider.

---

## 4. Running Your First Analysis

**Step 1** — Make sure you are on the **Analyze** tab (📊 bottom nav).

**Step 2** — Tap the input field at the top and type an asset symbol. Examples:

| Asset Type | Example Symbols |
|------------|----------------|
| Stocks | `AAPL`, `TSLA`, `NVDA`, `MSFT` |
| Crypto | `BTCUSD`, `ETHUSD`, `SOLUSDT` |
| Forex | `EURUSD`, `GBPUSD`, `USDJPY` |
| Commodities | `XAUUSD` (Gold), `XAGUSD` (Silver) |

**Step 3** — Or tap one of the **quick-pick chips** (AAPL, TSLA, NVDA, BTCUSD…) to instantly load a popular symbol.

**Step 4** — Tap **▶ Analyze**.

**Step 5** — Watch the loading screen as each agent runs in sequence. The progress bar shows which phase is active.

**Step 6** — When complete, all results appear below the input. Scroll down to read every phase.

> ⏱ A full analysis typically takes **5–15 seconds** depending on your connection and provider.

---

## 5. Understanding the Results

### Phase 1 — Analyst Cards

Each of the four analyst cards shows:

**Fundamentals Analyst**
- Bull Score vs Bear Score (0–100)
- Key financial metrics (P/E ratio, revenue growth, margins, etc.)
- A written summary of the fundamental picture

**Sentiment Analyst**
- Positive % vs Negative % sentiment split
- Fear & Greed Index (0 = Extreme Fear, 100 = Extreme Greed)
- Social media volume level
- Written sentiment summary

**Technical Analyst**
- Trend direction and Bias (Bullish / Neutral / Bearish)
- Trend Strength %
- RSI, MACD, MA50, support & resistance levels
- Chart pattern notes

**News Analyst**
- Impact score (0–100) and label (Low / Moderate / High Impact)
- Risk Level (Low → Critical)
- Top recent headlines
- News summary

---

### Phase 2 — Research Debate

Two panels present opposing cases:

**📈 Bullish Case** — reasons to buy, potential upside %, confidence %

**📉 Bearish Case** — reasons to be cautious, potential downside %, confidence %

Read both to understand the full risk picture before making any decision.

---

### Phase 3 — Trader Agent

The trader synthesizes all analyst reports and produces:

| Field | Meaning |
|-------|---------|
| **BUY / SELL / HOLD** | The trade signal |
| **Entry** | Suggested entry price |
| **Target** | Price target if the trade goes right |
| **Stop Loss** | Price level to exit if the trade goes wrong |
| **Confidence** | How certain the trader is (shown as a meter bar) |
| **Timeframe** | Intraday / Swing / Short-term / Medium-term |

---

### Phase 4 — Risk Manager

The risk manager reviews the trader's call:

| Status | Meaning |
|--------|---------|
| ✓ **APPROVED** | Trade parameters are acceptable |
| ⚠ **REVIEW NEEDED** | Marginal — reduce position size |
| ✕ **REJECTED** | Risk/reward is unfavorable — do not trade |

Key metrics shown: Risk/Reward Ratio, Position Size, Max Drawdown, Exposure Level.

---

### Phase 5 — Portfolio Manager (Final Verdict)

The portfolio manager gives the **final decision** — taking the trader signal and risk approval together:

- 🚀 **BUY** — confident long entry
- 🔻 **SELL** — short or exit positions
- ⏸ **HOLD** — wait for better confirmation

Shows overall confidence % and recommended portfolio allocation %.

---

## 6. Using the Watchlist

The app automatically saves any symbol you analyze to your **Watchlist**.

**To view your watchlist:** Tap the ⭐ **Watchlist** tab in the bottom nav.

**To re-analyze a symbol:** Tap the symbol name — it will run a fresh analysis instantly and switch you back to the Analyze tab.

**To remove a symbol:** Tap the **✕** button next to it.

---

## 7. Viewing History

Every completed analysis is saved to your history.

**To view history:** Tap the 🕐 **History** tab in the bottom nav.

Each entry shows:
- The **symbol** analyzed
- The **final decision** (BUY / SELL / HOLD) color-coded
- The **date** of the analysis

**To re-run an analysis:** Tap any history entry.

**To clear all history:** Tap the **🗑 Clear History** button at the bottom of the History page.

> History is stored locally in your browser. Clearing your browser data will also clear the history.

---

## 8. Exporting Reports

After running an analysis, you can export the results.

**Go to Settings** (⚙ tab) and scroll to the bottom.

**⬇ Export JSON** — Downloads a raw JSON file with all data from every phase of the analysis. Useful for developers or building your own tools.

**📄 Export Report** — Downloads an HTML file formatted as a clean report. Open it in any browser and use **Print → Save as PDF** to get a PDF.

> Both export options are only available after at least one analysis has been completed.

---

## 9. Tips & Tricks

**Toggle Light/Dark Mode**
Tap the ☀ button in the top-right header, or go to Settings and toggle **Light Mode**.

**Keyboard Shortcuts (desktop/laptop)**

| Shortcut | Action |
|----------|--------|
| `Enter` | Run analysis (when symbol field is focused) |
| `Ctrl + Enter` | Run analysis (anywhere) |
| `Ctrl + ,` | Open settings |
| `Escape` | Close modals |

**Best symbols to try first**
If you're new, start with `AAPL`, `BTCUSD`, or `EURUSD` — these give rich, realistic simulated data across all analyst types.

**What does Simulation Mode actually do?**
In Simulation Mode, the app generates statistically realistic market analysis using randomized but internally consistent data — the analyst scores, metrics, and trader signals all relate to each other. It's great for understanding how the platform works before connecting a real AI provider.

**Offline support**
Once the app has loaded once, it works offline thanks to the built-in service worker. Your settings, watchlist, and history are all stored locally and persist across sessions.

---

## 10. Disclaimer

> ⚠️ **Kamote Trading AI is a simulation for educational and demonstration purposes only.**
>
> All analysis, signals, and recommendations are AI-generated and do **not** constitute financial advice. This tool should not be used as the sole basis for any investment decision. Past performance is not indicative of future results.
>
> Always do your own research (DYOR) and consult a licensed financial advisor before making any investment decisions. Trade responsibly.

---

*Made with 🍠 by Kamote Trading AI — v1.0.0*
