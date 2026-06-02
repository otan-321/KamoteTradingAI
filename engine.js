'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────

const APP_VERSION = '2.0.0';
const SK = {
  SETTINGS: 'scalper_settings',
  HISTORY:  'scalper_history',
  WATCHLIST:'scalper_watchlist',
  THEME:    'scalper_theme',
};

const TIMEFRAMES = ['1m','3m','5m','15m'];
const SCALP_LABELS = ['PRICE ACTION','ORDER FLOW','MOMENTUM','MICRO-STRUCTURE','ENTRY SIGNAL','RISK GATE','EXECUTION'];

// TF → Binance interval string + minutes
const TF_MAP = { '1m': { binance: '1m', min: 1 }, '3m': { binance: '3m', min: 3 }, '5m': { binance: '5m', min: 5 }, '15m': { binance: '15m', min: 15 } };

// ─── Settings ─────────────────────────────────────────────────────────────────

const Settings = {
  defaults: {
    provider: 'claude_builtin',
    apiKey: '',
    model: '',
    baseUrl: '',
    riskPct: 1,
    maxSpread: 0.05,
    tfDefault: '5m',
  },

  get() {
    try {
      const r = localStorage.getItem(SK.SETTINGS);
      return r ? { ...this.defaults, ...JSON.parse(r) } : { ...this.defaults };
    } catch { return { ...this.defaults }; }
  },

  save(s) {
    try { localStorage.setItem(SK.SETTINGS, JSON.stringify(s)); } catch {}
  },
};

// ─── History & Watchlist ──────────────────────────────────────────────────────

const History = {
  getAll() { try { return JSON.parse(localStorage.getItem(SK.HISTORY) || '[]'); } catch { return []; } },
  add(e) {
    const h = this.getAll();
    h.unshift({ ...e, id: Date.now(), date: new Date().toISOString() });
    if (h.length > 100) h.pop();
    localStorage.setItem(SK.HISTORY, JSON.stringify(h));
  },
  clear() { localStorage.removeItem(SK.HISTORY); }
};

const Watchlist = {
  getAll() { try { return JSON.parse(localStorage.getItem(SK.WATCHLIST) || '[]'); } catch { return []; } },
  add(sym) {
    const l = this.getAll();
    if (!l.includes(sym)) { l.unshift(sym); if (l.length > 20) l.pop(); localStorage.setItem(SK.WATCHLIST, JSON.stringify(l)); }
  },
  remove(sym) { localStorage.setItem(SK.WATCHLIST, JSON.stringify(this.getAll().filter(s => s !== sym))); }
};

// ─── Asset Classification ─────────────────────────────────────────────────────

const Asset = {
  classify(sym) {
    const s = sym.toUpperCase().replace('/', '');
    if (/^(BTC|ETH|SOL|XRP|ADA|BNB|DOGE|AVAX|LINK|DOT|MATIC|LTC|BCH|ATOM|UNI|AAVE|FIL|ALGO|NEAR)(USD|USDT|BUSD)?$/.test(s)) return 'crypto';
    if (/^(EUR|GBP|AUD|NZD|CAD|CHF|JPY|SGD|HKD|NOK|SEK|DKK|MXN|ZAR)(USD|JPY|GBP|EUR|CAD|AUD|CHF|NZD)?$/.test(s) || /USD(JPY|CAD|CHF|MXN|SGD|HKD)/.test(s)) return 'forex';
    if (/^(XAU|GOLD|XAG|SILVER|OIL|WTI|CL|BRENT)(USD)?$/.test(s)) return 'commodity';
    return 'equity';
  },

  // Convert user symbol → Binance USDT pair (for crypto)
  toBinanceSymbol(sym) {
    const s = sym.toUpperCase().replace('/', '');
    if (s.endsWith('USDT') || s.endsWith('BUSD')) return s;
    if (s.endsWith('USD')) return s.replace('USD', 'USDT');
    // Bare tickers
    const cryptos = ['BTC','ETH','SOL','XRP','ADA','BNB','DOGE','AVAX','LINK','DOT','MATIC','LTC','BCH','ATOM','UNI','AAVE','FIL','ALGO','NEAR'];
    const bare = s.replace(/USDT$|USD$/, '');
    if (cryptos.includes(bare) || cryptos.includes(s)) return (cryptos.includes(s) ? s : bare) + 'USDT';
    return s + 'USDT';
  },

  // Forex: get the base/quote from standard pair notation
  toForexPair(sym) {
    const s = sym.toUpperCase().replace('/', '');
    if (s.length === 6) return { base: s.slice(0, 3), quote: s.slice(3) };
    if (s === 'XAUUSD' || s === 'GOLDUSD' || s === 'GOLD') return { base: 'XAU', quote: 'USD' };
    if (s === 'XAGUSD' || s === 'SILVER') return { base: 'XAG', quote: 'USD' };
    return { base: s.slice(0, 3), quote: s.slice(3) || 'USD' };
  }
};

// ─── Live Market Data ─────────────────────────────────────────────────────────

const MarketData = {

  // ── Crypto via Binance public API (no key needed) ──────────────────────────
  async fetchBinanceKlines(symbol, interval, limit = 100) {
    const binSym = Asset.toBinanceSymbol(symbol);
    const url = `https://api.binance.com/api/v3/klines?symbol=${binSym}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
    const data = await res.json();
    // [openTime, open, high, low, close, volume, closeTime, quoteAssetVol, numTrades, takerBuyBaseVol, takerBuyQuoteVol, ignore]
    return data.map(k => ({
      time:   k[0],
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
      trades: parseInt(k[8]),
      buyVol: parseFloat(k[9]),   // taker buy volume
      sellVol:parseFloat(k[5]) - parseFloat(k[9]),
    }));
  },

  async fetchBinanceTicker(symbol) {
    const binSym = Asset.toBinanceSymbol(symbol);
    const [ticker24, bookTicker] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binSym}`).then(r => r.json()),
      fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${binSym}`).then(r => r.json()),
    ]);
    return {
      price:     parseFloat(ticker24.lastPrice),
      bid:       parseFloat(bookTicker.bidPrice),
      ask:       parseFloat(bookTicker.askPrice),
      bidQty:    parseFloat(bookTicker.bidQty),
      askQty:    parseFloat(bookTicker.askQty),
      volume24h: parseFloat(ticker24.volume),
      change24h: parseFloat(ticker24.priceChangePercent),
      high24h:   parseFloat(ticker24.highPrice),
      low24h:    parseFloat(ticker24.lowPrice),
    };
  },

  async fetchBinanceDepth(symbol, limit = 20) {
    const binSym = Asset.toBinanceSymbol(symbol);
    const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${binSym}&limit=${limit}`);
    const data = await res.json();
    const bids = data.bids.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }));
    const asks = data.asks.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }));
    const bidVol = bids.reduce((s, b) => s + b.qty, 0);
    const askVol = asks.reduce((s, a) => s + a.qty, 0);
    return { bids, asks, bidVol, askVol };
  },

  async fetchBinanceRecentTrades(symbol, limit = 100) {
    const binSym = Asset.toBinanceSymbol(symbol);
    const res = await fetch(`https://api.binance.com/api/v3/trades?symbol=${binSym}&limit=${limit}`);
    const data = await res.json();
    return data.map(t => ({
      price:    parseFloat(t.price),
      qty:      parseFloat(t.qty),
      isBuyerMaker: t.isBuyerMaker,
      time:     t.time,
    }));
  },

  // ── Forex via exchangerate-api (free, no key for base rates) ───────────────
  async fetchForexRate(base, quote) {
    // Use frankfurter.app — free, no key, ECB data
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`);
    if (!res.ok) throw new Error('Forex rate fetch failed');
    const data = await res.json();
    return data.rates[quote];
  },

  // Forex historical via frankfurter (daily bars only — use for context)
  async fetchForexHistory(base, quote, days = 30) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    const endStr   = end.toISOString().split('T')[0];
    const res = await fetch(`https://api.frankfurter.app/${startStr}..${endStr}?from=${base}&to=${quote}`);
    if (!res.ok) throw new Error('Forex history fetch failed');
    const data = await res.json();
    const dates = Object.keys(data.rates).sort();
    return dates.map(d => ({ date: d, close: data.rates[d][quote] }));
  },

  // ── Equities & Gold via Yahoo Finance (via allorigins proxy, no key) ───────
  async fetchYahooQuote(sym) {
    const ticker = this.toYahooTicker(sym);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=5m&range=1d`;
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    if (!res.ok) throw new Error('Yahoo quote fetch failed');
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('No Yahoo data');
    return result;
  },

  async fetchYahooKlines(sym, interval = '5m', range = '1d') {
    const ticker = this.toYahooTicker(sym);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    if (!res.ok) throw new Error('Yahoo klines fetch failed');
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('No Yahoo data');
    const times   = result.timestamp;
    const ohlcv   = result.indicators.quote[0];
    const candles = [];
    for (let i = 0; i < times.length; i++) {
      if (ohlcv.open[i] == null) continue;
      candles.push({
        time:   times[i] * 1000,
        open:   ohlcv.open[i],
        high:   ohlcv.high[i],
        low:    ohlcv.low[i],
        close:  ohlcv.close[i],
        volume: ohlcv.volume[i] || 0,
      });
    }
    return candles;
  },

  toYahooTicker(sym) {
    const s = sym.toUpperCase().replace('/', '');
    const map = {
      'XAUUSD': 'GC=F', 'GOLD': 'GC=F', 'GOLDUSD': 'GC=F',
      'XAGUSD': 'SI=F', 'SILVER': 'SI=F',
      'OILUSD': 'CL=F', 'WTIUSD': 'CL=F', 'WTI': 'CL=F', 'OIL': 'CL=F',
      'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'USDJPY=X',
      'AUDUSD': 'AUDUSD=X', 'USDCAD': 'USDCAD=X', 'USDCHF': 'USDCHF=X',
      'NZDUSD': 'NZDUSD=X', 'EURGBP': 'EURGBP=X', 'EURJPY': 'EURJPY=X',
      'GBPJPY': 'GBPJPY=X',
    };
    return map[s] || s;
  },

  // ── Unified fetch: auto-routes by asset type ───────────────────────────────
  async fetchCandles(sym, tf) {
    const type = Asset.classify(sym);
    const interval = TF_MAP[tf]?.binance || '5m';

    if (type === 'crypto') {
      return await this.fetchBinanceKlines(sym, interval, 120);
    } else {
      // For equity/forex/commodity, use Yahoo with closest interval
      const yInterval = tf === '1m' ? '1m' : tf === '3m' ? '5m' : tf === '5m' ? '5m' : '15m';
      const yRange = (tf === '1m' || tf === '3m') ? '1d' : '5d';
      return await this.fetchYahooKlines(sym, yInterval, yRange);
    }
  },

  async fetchCurrentPrice(sym) {
    const type = Asset.classify(sym);
    if (type === 'crypto') {
      const t = await this.fetchBinanceTicker(sym);
      return t.price;
    } else {
      const candles = await this.fetchYahooKlines(sym, '1m', '1d');
      return candles[candles.length - 1]?.close || 0;
    }
  }
};

// ─── Technical Indicators (real math, no random) ──────────────────────────────

const Indicators = {

  // Simple Moving Average
  sma(values, period) {
    const result = new Array(values.length).fill(null);
    for (let i = period - 1; i < values.length; i++) {
      const slice = values.slice(i - period + 1, i + 1);
      result[i] = slice.reduce((a, b) => a + b, 0) / period;
    }
    return result;
  },

  // Exponential Moving Average
  ema(values, period) {
    const k = 2 / (period + 1);
    const result = new Array(values.length).fill(null);
    // Find first valid index
    let start = period - 1;
    result[start] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = start + 1; i < values.length; i++) {
      result[i] = values[i] * k + result[i - 1] * (1 - k);
    }
    return result;
  },

  // RSI
  rsi(closes, period = 14) {
    const result = new Array(closes.length).fill(null);
    if (closes.length < period + 1) return result;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    result[period] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
      result[i] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
    }
    return result;
  },

  // MACD
  macd(closes, fast = 12, slow = 26, signal = 9) {
    const emaFast   = this.ema(closes, fast);
    const emaSlow   = this.ema(closes, slow);
    const macdLine  = closes.map((_, i) => (emaFast[i] !== null && emaSlow[i] !== null) ? emaFast[i] - emaSlow[i] : null);
    const validMacd = macdLine.filter(v => v !== null);
    const sigArr    = this.ema(validMacd, signal);
    // Align signal back to full array length
    const sigFull   = new Array(closes.length).fill(null);
    let vi = 0;
    for (let i = 0; i < closes.length; i++) {
      if (macdLine[i] !== null) { sigFull[i] = sigArr[vi++]; }
    }
    const hist = closes.map((_, i) => (macdLine[i] !== null && sigFull[i] !== null) ? macdLine[i] - sigFull[i] : null);
    return { macdLine, signalLine: sigFull, histogram: hist };
  },

  // Stochastic
  stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    const kValues = new Array(closes.length).fill(null);
    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highSlice = highs.slice(i - kPeriod + 1, i + 1);
      const lowSlice  = lows.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...highSlice);
      const lowest  = Math.min(...lowSlice);
      kValues[i] = highest === lowest ? 50 : ((closes[i] - lowest) / (highest - lowest)) * 100;
    }
    const validK = kValues.filter(v => v !== null);
    const dSmooth = this.sma(validK, dPeriod);
    const dFull = new Array(closes.length).fill(null);
    let vi = 0;
    for (let i = 0; i < closes.length; i++) {
      if (kValues[i] !== null) { dFull[i] = dSmooth[vi++]; }
    }
    return { k: kValues, d: dFull };
  },

  // ATR (Average True Range)
  atr(highs, lows, closes, period = 14) {
    const tr = closes.map((c, i) => {
      if (i === 0) return highs[i] - lows[i];
      return Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    });
    const result = new Array(closes.length).fill(null);
    const slice = tr.slice(0, period);
    result[period - 1] = slice.reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
    }
    return result;
  },

  // VWAP (intraday, reset per session)
  vwap(candles) {
    let cumTPV = 0, cumVol = 0;
    return candles.map(c => {
      const tp = (c.high + c.low + c.close) / 3;
      cumTPV += tp * c.volume;
      cumVol += c.volume;
      return cumVol > 0 ? cumTPV / cumVol : c.close;
    });
  },

  // Bollinger Bands
  bollinger(closes, period = 20, stdDev = 2) {
    const mid = this.sma(closes, period);
    const upper = new Array(closes.length).fill(null);
    const lower = new Array(closes.length).fill(null);
    for (let i = period - 1; i < closes.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = mid[i];
      const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
      const sd = Math.sqrt(variance);
      upper[i] = mean + stdDev * sd;
      lower[i] = mean - stdDev * sd;
    }
    return { mid, upper, lower };
  },

  // Volume Profile (simplified: split into N price buckets)
  volumeProfile(candles, buckets = 20) {
    if (!candles.length) return [];
    const allHighs = candles.map(c => c.high);
    const allLows  = candles.map(c => c.low);
    const priceMin = Math.min(...allLows);
    const priceMax = Math.max(...allHighs);
    const step = (priceMax - priceMin) / buckets;
    const profile = Array.from({ length: buckets }, (_, i) => ({
      priceMin: priceMin + i * step,
      priceMax: priceMin + (i + 1) * step,
      volume: 0,
    }));
    for (const c of candles) {
      const tp = (c.high + c.low + c.close) / 3;
      const idx = Math.min(Math.floor((tp - priceMin) / step), buckets - 1);
      if (idx >= 0) profile[idx].volume += c.volume;
    }
    // Point of control = highest volume bucket
    const poc = profile.reduce((a, b) => b.volume > a.volume ? b : a);
    return { profile, poc, priceMin, priceMax };
  },

  // Support/Resistance via pivot points
  pivots(candles) {
    if (candles.length < 2) return {};
    const prev = candles[candles.length - 2];
    const H = prev.high, L = prev.low, C = prev.close;
    const P  = (H + L + C) / 3;
    const R1 = 2 * P - L;
    const R2 = P + (H - L);
    const S1 = 2 * P - H;
    const S2 = P - (H - L);
    return { P, R1, R2, S1, S2 };
  },

  // Last values helper
  last(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== null && !isNaN(arr[i])) return arr[i];
    }
    return null;
  },

  // Candle classification
  classifyCandle(o, h, l, c) {
    const body = Math.abs(c - o);
    const range = h - l;
    const upperWick = h - Math.max(o, c);
    const lowerWick = Math.min(o, c) - l;
    const bodyRatio = range > 0 ? body / range : 0;
    if (bodyRatio < 0.1) return 'Doji';
    if (upperWick > body * 2 && lowerWick < body * 0.5) return c > o ? 'Shooting Star' : 'Pin Bar';
    if (lowerWick > body * 2 && upperWick < body * 0.5) return c > o ? 'Hammer' : 'Inverted Hammer';
    if (bodyRatio > 0.7) return c > o ? 'Bullish Marubozu' : 'Bearish Marubozu';
    return c > o ? 'Bullish' : 'Bearish';
  },

  // Detect engulfing pattern
  isEngulfing(candles) {
    if (candles.length < 2) return null;
    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);
    if (currBody < prevBody * 1.5) return null;
    if (curr.close > curr.open && prev.close < prev.open) return 'Bullish Engulfing';
    if (curr.close < curr.open && prev.close > prev.open) return 'Bearish Engulfing';
    return null;
  },

  // Session detection
  getSession() {
    const h = new Date().getUTCHours();
    if (h >= 22 || h < 8)  return 'Asian Session';
    if (h >= 8 && h < 12)  return 'London Open';
    if (h >= 12 && h < 17) return 'London/NY Overlap';
    if (h >= 17 && h < 22) return 'NY Session';
    return 'Off-Hours';
  },
};

// ─── Real Analysis Pipeline ───────────────────────────────────────────────────

const Analysis = {

  // Phase 1 — Price Action from real candles
  async runPriceAction(candles, tf) {
    const last = candles[candles.length - 1];
    const closes = candles.map(c => c.close);
    const highs  = candles.map(c => c.high);
    const lows   = candles.map(c => c.low);
    const vols   = candles.map(c => c.volume);

    const atrArr = Indicators.atr(highs, lows, closes, 14);
    const atr    = Indicators.last(atrArr) || 0;

    const { open, high, low, close, volume } = last;
    const range = high - low;
    const body  = Math.abs(close - open);

    const barBias = Indicators.isEngulfing(candles) || Indicators.classifyCandle(open, high, low, close);

    // Volume relative to 20-bar average
    const vol20  = vols.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volRel = volume / vol20;
    const volLabel = volRel > 2 ? 'Climax' : volRel > 1.5 ? 'Spike' : volRel > 1.1 ? 'High' : volRel < 0.7 ? 'Low' : 'Average';

    // Bias score: based on candle close position within range
    const closePos = range > 0 ? (close - low) / range : 0.5;
    const biasScore = Math.round(closePos * 100);

    // Recent trend: last 5 bars
    const trend5 = closes[closes.length - 1] > closes[closes.length - 5] ? 'up' : 'down';

    const summary = `${tf} ${barBias} candle | O:${open.toFixed(4)} H:${high.toFixed(4)} L:${low.toFixed(4)} C:${close.toFixed(4)} | ATR:${atr.toFixed(4)} | Vol:${volLabel} (${volRel.toFixed(1)}x avg) | ${biasScore > 60 ? 'Candle structure favors longs — close in upper half.' : biasScore < 40 ? 'Candle structure favors shorts — close in lower half.' : 'Indecisive close — wait for confirmation.'}`;

    return { barBias, open, high, low, close, range, atr, vol: volLabel, volRel, biasScore, trend5, summary };
  },

  // Phase 2 — Order Flow from real trade/book data (crypto) or estimated (others)
  async runOrderFlow(sym, type, candles) {
    let bidVol, askVol, delta, imbalance, side, pressure, spread, book, bigTrades;

    if (type === 'crypto') {
      try {
        const [depth, trades] = await Promise.all([
          MarketData.fetchBinanceDepth(sym, 20),
          MarketData.fetchBinanceRecentTrades(sym, 200),
        ]);
        bidVol = depth.bidVol;
        askVol = depth.askVol;
        delta  = bidVol - askVol;
        const bestBid = depth.bids[0]?.price || 0;
        const bestAsk = depth.asks[0]?.price || 0;
        spread = bestAsk > 0 ? (bestAsk - bestBid) / bestAsk : 0;

        // Book imbalance
        imbalance = Math.abs(delta) / (bidVol + askVol) * 100;
        side = delta > 0 ? 'BUY' : 'SELL';

        // Tape analysis: last 200 trades
        let buyTrades = 0, sellTrades = 0, bigBuy = 0, bigSell = 0;
        const avgSize = trades.reduce((s, t) => s + t.qty, 0) / trades.length;
        for (const t of trades) {
          if (!t.isBuyerMaker) { buyTrades += t.qty; if (t.qty > avgSize * 5) bigBuy++; }
          else { sellTrades += t.qty; if (t.qty > avgSize * 5) bigSell++; }
        }
        bigTrades = bigBuy + bigSell;
        side = buyTrades > sellTrades ? 'BUY' : 'SELL';
        delta = buyTrades - sellTrades;
        imbalance = Math.abs(delta) / (buyTrades + sellTrades) * 100;

        // Book structure
        const bidDepth3 = depth.bids.slice(0, 3).reduce((s, b) => s + b.qty, 0);
        const askDepth3 = depth.asks.slice(0, 3).reduce((s, a) => s + a.qty, 0);
        if (bidDepth3 > askDepth3 * 2) book = 'Stacked Bids';
        else if (askDepth3 > bidDepth3 * 2) book = 'Stacked Asks';
        else if (depth.bids.some(b => b.qty > avgSize * 20)) book = 'Iceberg Detected';
        else book = 'Balanced';

        pressure = imbalance > 60 ? 'Strong' : imbalance > 35 ? 'Moderate' : 'Weak';
      } catch {
        // Fallback: estimate from candle taker volumes
        const last20 = candles.slice(-20);
        bidVol = last20.reduce((s, c) => s + (c.buyVol || 0), 0);
        askVol = last20.reduce((s, c) => s + (c.sellVol || c.volume - (c.buyVol || c.volume / 2)), 0);
        delta  = bidVol - askVol;
        imbalance = Math.abs(delta) / (bidVol + askVol + 1) * 100;
        side = delta > 0 ? 'BUY' : 'SELL';
        pressure = imbalance > 60 ? 'Strong' : imbalance > 35 ? 'Moderate' : 'Weak';
        spread = 0.001; book = 'Estimated'; bigTrades = 0;
      }
    } else {
      // Non-crypto: estimate from candle data (taker buy volume not available)
      const last20 = candles.slice(-20);
      const up   = last20.filter(c => c.close > c.open);
      const down = last20.filter(c => c.close <= c.open);
      bidVol = up.reduce((s, c) => s + c.volume, 0);
      askVol = down.reduce((s, c) => s + c.volume, 0);
      delta  = bidVol - askVol;
      imbalance = Math.abs(delta) / (bidVol + askVol + 1) * 100;
      side  = delta > 0 ? 'BUY' : 'SELL';
      pressure = imbalance > 60 ? 'Strong' : imbalance > 35 ? 'Moderate' : 'Weak';
      spread = 0.0002; book = 'Estimated (non-crypto)'; bigTrades = 0;
    }

    const summary = `Order flow: ${pressure} ${side} pressure | Imbalance: ${imbalance.toFixed(1)}% | Book: ${book} | ${bigTrades} large trades detected | Spread: ${(spread * 100).toFixed(4)}% | ${imbalance > 50 ? `Clear ${side}-side institutional interest.` : 'Balanced flow — no decisive edge.'}`;

    return { bidVol, askVol, delta, imbalance, side, pressure, spread, book, bigTrades, summary };
  },

  // Phase 3 — Momentum from real indicators
  async runMomentum(candles) {
    const closes = candles.map(c => c.close);
    const highs  = candles.map(c => c.high);
    const lows   = candles.map(c => c.low);

    const rsiArr   = Indicators.rsi(closes, 14);
    const rsi      = Indicators.last(rsiArr);
    // Approximate 1m and 15m RSI from available candles
    const rsi1m    = Indicators.last(Indicators.rsi(closes.slice(-30), 7)) || rsi;
    const rsi15m   = Indicators.last(Indicators.rsi(closes.slice(-60), 21)) || rsi;

    const macdData = Indicators.macd(closes);
    const macdLine = Indicators.last(macdData.macdLine);
    const sigLine  = Indicators.last(macdData.signalLine);
    const hist     = (macdLine !== null && sigLine !== null) ? macdLine - sigLine : 0;

    const stoch    = Indicators.stochastic(highs, lows, closes, 14, 3);
    const stochK   = Indicators.last(stoch.k);
    const stochD   = Indicators.last(stoch.d);

    const ema9Arr  = Indicators.ema(closes, 9);
    const ema21Arr = Indicators.ema(closes, 21);
    const ema50Arr = Indicators.ema(closes, 50);
    const ema9     = Indicators.last(ema9Arr);
    const ema21    = Indicators.last(ema21Arr);
    const ema50    = Indicators.last(ema50Arr);
    const price    = closes[closes.length - 1];

    const above = price > ema9 && ema9 > ema21;
    const below = price < ema9 && ema9 < ema21;

    let moscore = 0;
    if (rsi > 55) moscore += 20; else if (rsi < 45) moscore -= 20;
    if (hist > 0) moscore += 15; else if (hist < 0) moscore -= 15;
    if (above) moscore += 20; else if (below) moscore -= 20;
    if (stochK > 60) moscore += 10; else if (stochK < 40) moscore -= 10;
    if (rsi > 70) moscore += 10; else if (rsi < 30) moscore -= 10; // extremes matter
    const momentum = moscore > 20 ? 'Bullish' : moscore < -20 ? 'Bearish' : 'Neutral';

    const summary = `Momentum: ${momentum} (score: ${moscore}) | RSI: ${rsi?.toFixed(1)} (1m≈${rsi1m?.toFixed(1)}, 15m≈${rsi15m?.toFixed(1)}) | MACD hist: ${hist > 0 ? '+' : ''}${hist?.toFixed(5)} | Stoch K/D: ${stochK?.toFixed(1)}/${stochD?.toFixed(1)} | EMA9: ${ema9?.toFixed(4)}, EMA21: ${ema21?.toFixed(4)} | ${above ? 'Price above both EMAs — bull stack confirmed.' : below ? 'Price below both EMAs — bear stack confirmed.' : 'Price between EMAs — compression zone.'}`;

    return { rsi1m, rsi5m: rsi, rsi15m, macdLine, signal: sigLine, hist, stochK, stochD, ema9, ema21, ema50, momentum, moscore, summary };
  },

  // Phase 4 — Microstructure: pivots, VWAP, volume profile
  async runMicroStructure(candles, price) {
    const vwapArr = Indicators.vwap(candles);
    const vwap    = vwapArr[vwapArr.length - 1];
    const pivots  = Indicators.pivots(candles);
    const volProf = Indicators.volumeProfile(candles, 20);
    const boll    = Indicators.bollinger(candles.map(c => c.close), 20, 2);
    const bbUpper = Indicators.last(boll.upper);
    const bbLower = Indicators.last(boll.lower);
    const session = Indicators.getSession();

    const { S1, S2, R1, R2 } = pivots;
    const vwapPos = price > vwap ? 'Above VWAP — bullish intraday bias' : 'Below VWAP — bearish intraday bias';

    // Determine if price is near any key level (within 0.1%)
    const nearLevel = [S1, S2, R1, R2, vwap].find(l => l && Math.abs(price - l) / price < 0.001);
    const liquidity = nearLevel
      ? `Price within 0.1% of key level (${nearLevel.toFixed(4)}) — expect reaction`
      : price < S1 ? `Resting buy stops below S1 (${S1?.toFixed(4)})`
      : price > R1 ? `Resting sell stops above R1 (${R1?.toFixed(4)})`
      : 'Balanced liquidity between pivot levels';

    // POC proximity
    const poc = volProf.poc;
    const nearPOC = poc && Math.abs(price - ((poc.priceMin + poc.priceMax) / 2)) / price < 0.002;

    const structScore = Math.round(
      (nearPOC ? 20 : 0) +
      (price > vwap ? 20 : 0) +
      (price > (pivots.P || price) ? 15 : 0) +
      (bbUpper && price < bbUpper ? 10 : 0) +
      (bbLower && price > bbLower ? 10 : 0) +
      25 // base
    );

    const summary = `Pivots — S1:${S1?.toFixed(4)} S2:${S2?.toFixed(4)} | R1:${R1?.toFixed(4)} R2:${R2?.toFixed(4)} | VWAP: ${vwap?.toFixed(4)} → ${vwapPos} | BB: ${bbLower?.toFixed(4)}–${bbUpper?.toFixed(4)} | POC: ${poc ? ((poc.priceMin + poc.priceMax) / 2).toFixed(4) : 'N/A'} | Session: ${session} | ${liquidity}`;

    return { s1: S1, s2: S2, r1: R1, r2: R2, liquidity, vwap, vwapPos, sessions: session, structScore, bbUpper, bbLower, summary };
  },

  // Phase 5 — Entry Signal (same voting logic but on real data)
  async runEntrySignal(price, paData, ofData, moData, msData) {
    const bullVotes = [
      paData.biasScore > 55,
      ofData.side === 'BUY' && ofData.imbalance > 35,
      moData.momentum === 'Bullish',
      price > msData.vwap,
      moData.rsi5m > 50 && moData.rsi5m < 70,
      moData.hist > 0,
    ].filter(Boolean).length;

    const bearVotes = [
      paData.biasScore < 45,
      ofData.side === 'SELL' && ofData.imbalance > 35,
      moData.momentum === 'Bearish',
      price < msData.vwap,
      moData.rsi5m < 50 && moData.rsi5m > 30,
      moData.hist < 0,
    ].filter(Boolean).length;

    let signal, confidence, setup;

    if (bullVotes >= 4) {
      signal = 'LONG';
      confidence = Math.min(95, 55 + bullVotes * 7);
      const setups = [];
      if (moData.momentum === 'Bullish' && moData.hist > 0) setups.push('Momentum Break');
      if (price > msData.vwap) setups.push('VWAP Reclaim');
      if (ofData.side === 'BUY') setups.push('Order Flow Surge');
      if (paData.barBias?.includes('Bullish') || paData.barBias?.includes('Hammer')) setups.push('Bull Structure');
      setup = setups[0] || 'Bull Confluence';
    } else if (bearVotes >= 4) {
      signal = 'SHORT';
      confidence = Math.min(95, 55 + bearVotes * 7);
      const setups = [];
      if (moData.momentum === 'Bearish' && moData.hist < 0) setups.push('Breakdown');
      if (price < msData.vwap) setups.push('VWAP Rejection');
      if (ofData.side === 'SELL') setups.push('Ask Wall');
      if (paData.barBias?.includes('Bearish') || paData.barBias?.includes('Star')) setups.push('Bear Structure');
      setup = setups[0] || 'Bear Confluence';
    } else {
      signal = 'NO TRADE';
      confidence = Math.min(45, 10 + Math.max(bullVotes, bearVotes) * 6);
      setup = 'Conflicting signals — wait for alignment';
    }

    const atr   = paData.atr || 0.001;
    const entry = price;
    const target1 = signal === 'LONG'  ? entry + atr * 1.5
                  : signal === 'SHORT' ? entry - atr * 1.5 : entry;
    const target2 = signal === 'LONG'  ? entry + atr * 3.0
                  : signal === 'SHORT' ? entry - atr * 3.0 : entry;
    const stop    = signal === 'LONG'  ? entry - atr * 1.0
                  : signal === 'SHORT' ? entry + atr * 1.0 : entry;

    const rr1 = stop !== entry ? parseFloat((Math.abs(target1 - entry) / Math.abs(stop - entry)).toFixed(2)) : 0;
    const rr2 = stop !== entry ? parseFloat((Math.abs(target2 - entry) / Math.abs(stop - entry)).toFixed(2)) : 0;

    const summary = `${signal} — ${setup} | Entry: ${entry.toFixed(4)} | T1: ${target1.toFixed(4)} (${rr1}R) | T2: ${target2.toFixed(4)} (${rr2}R) | SL: ${stop.toFixed(4)} | ${bullVotes} bull / ${bearVotes} bear votes | Confidence: ${confidence}%`;

    return { signal, confidence, setup, entry, target1, target2, stop, rr1, rr2, bullVotes, bearVotes, summary };
  },

  // Phase 6 — Risk Gate
  async runRiskGate(entryData, settings) {
    const rr = entryData.rr1;
    const conf = entryData.confidence;
    const maxRisk = parseFloat(settings.riskPct) || 1;
    let status, reason, positionSize;

    if (entryData.signal === 'NO TRADE') {
      status = 'BLOCKED'; reason = 'No valid signal from entry agents.'; positionSize = 0;
    } else if (rr < 1.5) {
      status = 'BLOCKED'; reason = `R:R too low (${rr}R). Minimum 1.5R required.`; positionSize = 0;
    } else if (conf < 60) {
      status = 'REDUCE'; reason = `Confidence ${conf}% below threshold. Halve normal size.`; positionSize = parseFloat((maxRisk * 0.5).toFixed(2));
    } else if (rr >= 2) {
      status = 'APPROVED'; reason = `Strong setup. ${rr}R with ${conf}% confidence. Full size.`; positionSize = maxRisk;
    } else {
      status = 'APPROVED'; reason = `Acceptable ${rr}R setup. Proceed at standard size.`; positionSize = parseFloat((maxRisk * 0.75).toFixed(2));
    }
    return { status, reason, positionSize, rr };
  },

  // Phase 7 — Execution Brief
  async runExecution(sym, entryData, riskData) {
    const valid   = riskData.status !== 'BLOCKED';
    const urgency = entryData.confidence > 80 ? 'IMMEDIATE' : entryData.confidence > 65 ? 'READY' : 'STANDBY';
    const orderType = entryData.rr1 > 2.5 ? 'Limit' : 'Market';
    const notes = valid
      ? `${urgency} ${entryData.signal} via ${orderType} order. Size: ${riskData.positionSize}% risk. Trail stop after T1 hit. ATR-based levels from live data.`
      : 'Stand down. Insufficient confluence — reassess on next candle close.';
    return { valid, urgency, orderType, notes, signal: entryData.signal };
  },
};

// ─── AI Commentary via Claude ─────────────────────────────────────────────────

const AI = {
  async getScalpCommentary(sym, tf, type, paData, ofData, moData, msData, entryData, price) {
    try {
      const prompt = `You are an expert scalp trader analyzing REAL live market data. Provide a concise, professional scalp trading assessment.

SYMBOL: ${sym} | TYPE: ${type} | TIMEFRAME: ${tf} | LIVE PRICE: ${price}

=== REAL INDICATOR DATA ===
PRICE ACTION: ${paData.summary}
ORDER FLOW: ${ofData.summary}
MOMENTUM: ${moData.summary}
MICROSTRUCTURE: ${msData.summary}
ENTRY SIGNAL: ${entryData.summary}

Respond with ONLY a JSON object (no markdown):
{
  "commentary": "2-3 sentences: what the real data tells you right now, actionable insight",
  "keyRisk": "1 sentence: the main risk to this trade",
  "watchFor": "1 thing to watch that could invalidate or confirm the setup"
}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error('AI call failed');
      const data = await response.json();
      const text = data.content[0].text.replace(/```json?|```/g, '').trim();
      return JSON.parse(text);
    } catch {
      return {
        commentary: `Real data analysis: ${entryData.signal === 'NO TRADE' ? 'Insufficient confluence detected. Market structure is indecisive — wait for clearer alignment before entering.' : `${entryData.signal} setup detected with ${entryData.confidence}% confidence based on live indicator confluence.`}`,
        keyRisk: entryData.signal !== 'NO TRADE' ? `Key risk: ${entryData.signal === 'LONG' ? 'Reversal if price breaks below stop loss' : 'Short squeeze if price reclaims entry level'}` : 'No active trade risk.',
        watchFor: `Watch ${entryData.signal === 'LONG' ? msData.r1?.toFixed(4) + ' (R1 resistance)' : entryData.signal === 'SHORT' ? msData.s1?.toFixed(4) + ' (S1 support)' : 'next candle close for direction'}`
      };
    }
  }
};

// ─── Main Analysis Pipeline ───────────────────────────────────────────────────

async function runAnalysis(sym, tf, onProgress) {
  const settings = Settings.get();
  const type     = Asset.classify(sym);

  onProgress(0, 'Fetching live market data…');

  // Fetch real candles first (the foundation of everything)
  let candles;
  try {
    candles = await MarketData.fetchCandles(sym, tf);
    if (!candles || candles.length < 30) throw new Error('Insufficient candle data');
  } catch (e) {
    throw new Error(`Market data fetch failed for ${sym}: ${e.message}. Check symbol spelling. Crypto: BTCUSD, ETHUSD, SOLUSDT. Forex: EURUSD, GBPUSD. Stocks: AAPL, TSLA, NVDA. Gold: XAUUSD`);
  }

  const price = candles[candles.length - 1].close;

  onProgress(0, 'Analyzing price action…');
  const paData = await Analysis.runPriceAction(candles, tf);

  onProgress(1, 'Reading order flow…');
  const ofData = await Analysis.runOrderFlow(sym, type, candles);

  onProgress(2, 'Computing indicators…');
  const moData = await Analysis.runMomentum(candles);

  onProgress(3, 'Mapping market structure…');
  const msData = await Analysis.runMicroStructure(candles, price);

  onProgress(4, 'Generating entry signal…');
  const entryData = await Analysis.runEntrySignal(price, paData, ofData, moData, msData);

  onProgress(5, 'Running risk gate…');
  const riskData = await Analysis.runRiskGate(entryData, settings);

  onProgress(6, 'Compiling AI execution brief…');
  const execData  = await Analysis.runExecution(sym, entryData, riskData);
  const aiComment = await AI.getScalpCommentary(sym, tf, type, paData, ofData, moData, msData, entryData, price);

  const result = { sym, tf, type, price, timestamp: Date.now(), candles: candles.slice(-50), paData, ofData, moData, msData, entryData, riskData, execData, aiComment };
  History.add({ sym, tf, signal: entryData.signal, confidence: entryData.confidence, price });
  Watchlist.add(sym);
  return result;
}

// ─── UI ───────────────────────────────────────────────────────────────────────

const App = {
  result: null,

  init() {
    this.bindNav();
    this.bindMain();
    this.bindSettings();
    this.bindExport();
    this.loadSettingsToForm();
    this.renderWatchlist();
    this.renderHistory();
    this.startClock();
    this.applyTheme();
    this.registerSW();
    this.tab('scan');
    // Show live mode in status bar
    document.getElementById('statusMode').textContent = 'LIVE';
  },

  tab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  },

  bindNav() {
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => this.tab(b.dataset.tab)));
  },

  bindMain() {
    document.getElementById('scanBtn').addEventListener('click', () => this.startScan());
    document.getElementById('symInput').addEventListener('keydown', e => { if (e.key === 'Enter') this.startScan(); });
    document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
      document.getElementById('symInput').value = c.dataset.sym;
      this.startScan();
    }));
    document.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.tf-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    }));
  },

  getActiveTF() {
    const btn = document.querySelector('.tf-btn.active');
    return btn ? btn.dataset.tf : '5m';
  },

  async startScan() {
    const sym = document.getElementById('symInput').value.trim().toUpperCase();
    if (!sym) { this.toast('Enter a symbol', 'warn'); return; }
    const tf = this.getActiveTF();
    this.showLoading(true, sym);
    this.result = null;
    try {
      const res = await runAnalysis(sym, tf, (phase, label) => this.updateProgress(phase, label));
      this.result = res;
      this.renderResult(res);
      this.renderWatchlist();
      this.renderHistory();
      this.toast(`${sym} scan complete — ${res.execData.signal}`, res.execData.signal === 'NO TRADE' ? 'warn' : 'ok');
    } catch (e) {
      console.error(e);
      this.toast(e.message, 'err');
    }
    this.showLoading(false);
  },

  showLoading(on, sym = '') {
    document.getElementById('loadingOverlay').classList.toggle('show', on);
    document.getElementById('scanBtn').disabled = on;
    if (on && sym) document.getElementById('loadingSym').textContent = sym;
    if (!on) document.getElementById('progressBar').style.width = '0%';
  },

  updateProgress(phase, label) {
    const total = SCALP_LABELS.length;
    const pct = Math.round(((phase + 1) / total) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = SCALP_LABELS[phase] || '';
    document.getElementById('progressSub').textContent = label;
  },

  renderResult(r) {
    document.getElementById('resultSection').style.display = 'block';
    const { sym, tf, price, paData, ofData, moData, msData, entryData, riskData, execData, aiComment } = r;

    document.getElementById('resSym').textContent   = sym;
    document.getElementById('resTF').textContent    = tf;
    document.getElementById('resPrice').textContent = price >= 1 ? price.toFixed(4) : price.toFixed(6);
    document.getElementById('resTime').textContent  = new Date().toLocaleTimeString();

    const banner = document.getElementById('execBanner');
    const ec = execData.signal === 'LONG' ? 'signal-long' : execData.signal === 'SHORT' ? 'signal-short' : 'signal-flat';
    banner.className = 'exec-banner ' + ec;
    document.getElementById('execSignal').textContent  = execData.signal;
    document.getElementById('execUrgency').textContent = execData.urgency;

    // AI commentary in notes
    const notes = aiComment
      ? `${aiComment.commentary}\n\n⚠ ${aiComment.keyRisk}\n👁 ${aiComment.watchFor}`
      : execData.notes;
    document.getElementById('execNotes').textContent = notes;

    document.getElementById('riskStatus').textContent  = riskData.status;
    document.getElementById('riskStatus').className    = 'risk-badge risk-' + riskData.status.toLowerCase();
    document.getElementById('riskReason').textContent  = riskData.reason;

    const fmt = v => v != null ? (Math.abs(v) >= 1 ? v.toFixed(4) : v.toFixed(6)) : '--';
    document.getElementById('entryVal').textContent  = fmt(entryData.entry);
    document.getElementById('t1Val').textContent     = fmt(entryData.target1);
    document.getElementById('t2Val').textContent     = fmt(entryData.target2);
    document.getElementById('slVal').textContent     = fmt(entryData.stop);
    document.getElementById('rr1Val').textContent    = entryData.rr1 + 'R';
    document.getElementById('rr2Val').textContent    = entryData.rr2 + 'R';
    document.getElementById('setupVal').textContent  = entryData.setup || '--';
    document.getElementById('confBar').style.width   = (entryData.confidence || 0) + '%';
    document.getElementById('confVal').textContent   = (entryData.confidence || 0) + '%';
    document.getElementById('bullVotes').textContent = '▲ ' + (entryData.bullVotes ?? 0);
    document.getElementById('bearVotes').textContent = '▼ ' + (entryData.bearVotes ?? 0);

    this.fillPhaseCard('pa',  paData,  ['barBias','vol','biasScore','atr'], paData.summary);
    this.fillPhaseCard('of',  ofData,  ['side','pressure','imbalance','book'], ofData.summary);
    this.fillPhaseCard('mo',  moData,  ['momentum','rsi5m','hist','stochK'], moData.summary);
    this.fillPhaseCard('ms',  msData,  ['structScore','sessions','vwapPos'], msData.summary);

    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
  },

  fillPhaseCard(id, data, keys, summary) {
    const card = document.getElementById('card-' + id);
    if (!card) return;
    const metaEl = card.querySelector('.card-meta');
    const sumEl  = card.querySelector('.card-summary');
    if (metaEl) metaEl.innerHTML = keys.map(k => {
      let v = data[k] ?? '--';
      if (typeof v === 'number') v = Math.abs(v) < 0.01 ? v.toFixed(5) : v.toFixed ? v.toFixed(2) : v;
      return `<span class="meta-item"><span class="meta-key">${k.toUpperCase()}</span><span class="meta-val">${v}</span></span>`;
    }).join('');
    if (sumEl) sumEl.textContent = summary || '';
  },

  renderWatchlist() {
    const cont = document.getElementById('watchlistItems');
    const items = Watchlist.getAll();
    if (!items.length) { cont.innerHTML = '<div class="empty-msg">No symbols yet — run a scan.</div>'; return; }
    cont.innerHTML = items.map(s => `
      <div class="wl-item">
        <span class="wl-sym" data-sym="${s}">${s}</span>
        <button class="wl-rm" data-sym="${s}">✕</button>
      </div>`).join('');
    cont.querySelectorAll('.wl-sym').forEach(el => el.addEventListener('click', () => {
      document.getElementById('symInput').value = el.dataset.sym;
      this.tab('scan');
      this.startScan();
    }));
    cont.querySelectorAll('.wl-rm').forEach(el => el.addEventListener('click', () => {
      Watchlist.remove(el.dataset.sym);
      this.renderWatchlist();
    }));
  },

  renderHistory() {
    const cont = document.getElementById('historyItems');
    const items = History.getAll();
    if (!items.length) { cont.innerHTML = '<div class="empty-msg">No history yet.</div>'; return; }
    cont.innerHTML = items.slice(0, 50).map(h => {
      const cls = h.signal === 'LONG' ? 'sig-long' : h.signal === 'SHORT' ? 'sig-short' : 'sig-flat';
      const t = new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="hist-item" data-sym="${h.sym}">
        <span class="hist-sym">${h.sym}</span>
        <span class="hist-tf">${h.tf || '5m'}</span>
        <span class="hist-sig ${cls}">${h.signal}</span>
        <span class="hist-conf">${h.confidence}%</span>
        <span class="hist-time">${t}</span>
      </div>`;
    }).join('');
    cont.querySelectorAll('.hist-item').forEach(el => el.addEventListener('click', () => {
      document.getElementById('symInput').value = el.dataset.sym;
      this.tab('scan');
      this.startScan();
    }));
  },

  bindSettings() {
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => { History.clear(); this.renderHistory(); this.toast('History cleared', 'ok'); });
    document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());
  },

  loadSettingsToForm() {
    const s = Settings.get();
    ['riskPct'].forEach(k => {
      const el = document.getElementById('set-' + k);
      if (el) el.value = s[k] || '';
    });
  },

  saveSettings() {
    const s = Settings.get();
    const riskEl = document.getElementById('set-riskPct');
    if (riskEl) s.riskPct = riskEl.value;
    Settings.save(s);
    this.toast('Settings saved', 'ok');
  },

  bindExport() {
    document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJSON());
    document.getElementById('exportRptBtn').addEventListener('click', () => this.exportReport());
  },

  exportJSON() {
    if (!this.result) { this.toast('Run a scan first', 'warn'); return; }
    const exportData = { ...this.result };
    delete exportData.candles; // Don't include 50 candles in JSON export
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `scalper_${this.result.sym}_${Date.now()}.json`; a.click();
  },

  exportReport() {
    if (!this.result) { this.toast('Run a scan first', 'warn'); return; }
    const r = this.result;
    const ai = r.aiComment || {};
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Scalper AI — ${r.sym}</title>
    <style>body{font-family:monospace;background:#000;color:#0f0;padding:2rem}h1{color:#0ff}table{width:100%;border-collapse:collapse}td,th{border:1px solid #0f0;padding:6px 10px}th{background:#001100}pre{white-space:pre-wrap;color:#adf;font-size:0.85em}</style></head>
    <body><h1>⚡ Scalper AI v2.0 (LIVE DATA) — ${r.sym} / ${r.tf}</h1>
    <p>Generated: ${new Date().toLocaleString()} | Live Price: ${r.price} | Asset Type: ${r.type}</p>
    <h2>Signal: ${r.execData.signal} | Risk Gate: ${r.riskData.status}</h2>
    <p><b>AI Commentary:</b> ${ai.commentary || ''}</p>
    <p><b>Key Risk:</b> ${ai.keyRisk || ''}</p>
    <p><b>Watch For:</b> ${ai.watchFor || ''}</p>
    <h3>Entry Levels (ATR-Based, Live Data)</h3>
    <table><tr><th>Entry</th><th>Target 1</th><th>Target 2</th><th>Stop Loss</th><th>R:R1</th><th>R:R2</th></tr>
    <tr><td>${r.entryData.entry?.toFixed(4)}</td><td>${r.entryData.target1?.toFixed(4)}</td><td>${r.entryData.target2?.toFixed(4)}</td><td>${r.entryData.stop?.toFixed(4)}</td><td>${r.entryData.rr1}R</td><td>${r.entryData.rr2}R</td></tr></table>
    <h3>Agent Reports</h3>
    <p><b>🕯 Price Action:</b> ${r.paData.summary}</p>
    <p><b>📊 Order Flow:</b> ${r.ofData.summary}</p>
    <p><b>⚡ Momentum:</b> ${r.moData.summary}</p>
    <p><b>🔬 Microstructure:</b> ${r.msData.summary}</p>
    <p style="color:#555;font-size:0.8em;margin-top:2rem">⚠ Scalper AI v2.0 uses real market data and AI analysis for educational purposes. Not financial advice. Scalp trading involves substantial risk of loss.</p>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `scalper_${r.sym}_report.html`; a.click();
  },

  toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4000);
  },

  startClock() {
    const el = document.getElementById('clockEl');
    const tick = () => { if (el) el.textContent = new Date().toLocaleTimeString(); };
    tick(); setInterval(tick, 1000);
  },

  applyTheme() {
    document.body.classList.toggle('light', localStorage.getItem(SK.THEME) === 'light');
  },

  toggleTheme() {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem(SK.THEME, isLight ? 'light' : 'dark');
  },

  registerSW() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
