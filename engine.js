'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';
const SK = {
  SETTINGS: 'scalper_settings',
  HISTORY:  'scalper_history',
  WATCHLIST:'scalper_watchlist',
  THEME:    'scalper_theme',
};

const TIMEFRAMES = ['1m','3m','5m','15m'];
const SCALP_LABELS = ['PRICE ACTION','ORDER FLOW','MOMENTUM','MICRO-STRUCTURE','ENTRY SIGNAL','RISK GATE','EXECUTION'];

// ─── Settings ─────────────────────────────────────────────────────────────────

const Settings = {
  defaults: {
    provider: 'simulation',
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

  providerCfg(p) {
    return ({
      openai:     { baseUrl: 'https://api.openai.com/v1',                       model: 'gpt-4o-mini' },
      claude:     { baseUrl: 'https://api.anthropic.com/v1',                    model: 'claude-3-haiku-20240307' },
      gemini:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash' },
      deepseek:   { baseUrl: 'https://api.deepseek.com/v1',                     model: 'deepseek-chat' },
      openrouter: { baseUrl: 'https://openrouter.ai/api/v1',                    model: 'openai/gpt-4o-mini' },
      groq:       { baseUrl: 'https://api.groq.com/openai/v1',                  model: 'llama-3.1-8b-instant' },
      mistral:    { baseUrl: 'https://api.mistral.ai/v1',                       model: 'mistral-small' },
      simulation: { baseUrl: '', model: 'simulation' },
    })[p] || { baseUrl: '', model: 'simulation' };
  }
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

// ─── Simulation Engine ────────────────────────────────────────────────────────

const Sim = {
  ri: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
  rf: (a, b, d = 2) => parseFloat((Math.random() * (b - a) + a).toFixed(d)),
  pick: a => a[Math.floor(Math.random() * a.length)],
  delay: ms => new Promise(r => setTimeout(r, ms)),

  classifyAsset(sym) {
    const s = sym.toUpperCase();
    if (/BTC|ETH|SOL|XRP|ADA|BNB|DOGE|AVAX|LINK|DOT/.test(s)) return 'crypto';
    if (/USD|EUR|GBP|JPY|AUD|CHF|CAD|NZD/.test(s) && s.length <= 7) return 'forex';
    if (/XAU|XAG|OIL|WTI|CL/.test(s)) return 'commodity';
    return 'equity';
  },

  getTickSize(type) {
    return { crypto: 0.01, forex: 0.0001, commodity: 0.1, equity: 0.01 }[type] || 0.01;
  },

  genPrice(sym, type) {
    const ranges = { crypto: [0.5, 95000], forex: [0.55, 160], commodity: [15, 2500], equity: [5, 1200] };
    const [mn, mx] = ranges[type];
    return this.rf(mn, mx, type === 'forex' ? 5 : 2);
  },

  // Phase 1 — Price Action (candlestick / bar structure)
  async runPriceAction(sym, price, tf) {
    await this.delay(this.ri(300, 700));
    const barBias = this.pick(['Bullish','Bearish','Doji','Pin Bar','Engulfing']);
    const body = this.rf(0.1, 2.5, 2);
    const wick  = this.rf(0.05, 1.5, 2);
    const prevClose = this.rf(price * 0.995, price * 1.005, 5);
    const open  = prevClose;
    const close = this.rf(open - body * price / 100, open + body * price / 100, 5);
    const high  = Math.max(open, close) + wick * price / 100;
    const low   = Math.min(open, close) - wick * price / 100;
    const range = parseFloat((high - low).toFixed(5));
    const atr   = this.rf(range * 0.8, range * 3, 5);
    const vol   = this.pick(['Low','Average','High','Spike','Climax']);
    const biasScore = barBias === 'Bullish' || barBias === 'Engulfing' ? this.ri(60, 90)
                    : barBias === 'Bearish' ? this.ri(15, 40)
                    : this.ri(35, 65);
    return { barBias, open, close, high, low, range, atr, vol, biasScore,
      summary: `${tf} ${barBias} candle (O:${open.toFixed(5)} H:${high.toFixed(5)} L:${low.toFixed(5)} C:${close.toFixed(5)}). Body ${body.toFixed(2)}% of range. Volume: ${vol}. ATR: ${atr.toFixed(5)}. ${biasScore > 60 ? 'Structure favors longs.' : biasScore < 40 ? 'Structure favors shorts.' : 'Indecisive — wait for next bar.'}` };
  },

  // Phase 2 — Order Flow (bid/ask, delta, imbalance)
  async runOrderFlow(sym, price) {
    await this.delay(this.ri(250, 600));
    const bidVol   = this.ri(1000, 50000);
    const askVol   = this.ri(1000, 50000);
    const delta    = bidVol - askVol;
    const imbalance= parseFloat((Math.abs(delta) / (bidVol + askVol) * 100).toFixed(1));
    const side     = delta > 0 ? 'BUY' : 'SELL';
    const pressure = imbalance > 60 ? 'Strong' : imbalance > 35 ? 'Moderate' : 'Weak';
    const spread   = this.rf(0.0001, 0.002, 5);
    const book     = this.pick(['Stacked Bids','Stacked Asks','Balanced','Thin','Iceberg Detected']);
    const bigTrades= this.ri(0, 12);
    return { bidVol, askVol, delta, imbalance, side, pressure, spread, book, bigTrades,
      summary: `Order flow ${pressure} ${side} pressure. Delta: ${delta > 0 ? '+' : ''}${delta.toLocaleString()} | Imbalance: ${imbalance}%. Order book: ${book}. ${bigTrades} large orders in last 60s. Spread: ${spread.toFixed(5)}. ${imbalance > 50 ? `Institutional ${side}-side interest detected.` : 'Balanced flow — no clear edge.'}` };
  },

  // Phase 3 — Momentum (RSI, MACD, stochastic on M1–M15)
  async runMomentum(sym, price, tf) {
    await this.delay(this.ri(300, 650));
    const rsi1m  = this.rf(15, 85, 1);
    const rsi5m  = this.rf(20, 80, 1);
    const rsi15m = this.rf(25, 75, 1);
    const macdLine= this.rf(-0.5, 0.5, 4);
    const signal  = this.rf(-0.4, 0.4, 4);
    const hist    = parseFloat((macdLine - signal).toFixed(4));
    const stochK  = this.ri(5, 95);
    const stochD  = this.ri(5, 95);
    const ema9    = this.rf(price * 0.998, price * 1.002, 5);
    const ema21   = this.rf(price * 0.994, price * 1.006, 5);
    const above   = price > ema9 && ema9 > ema21;
    const below   = price < ema9 && ema9 < ema21;
    const moscore = (rsi5m > 55 ? 20 : rsi5m < 45 ? -20 : 0) + (hist > 0 ? 15 : -15) + (above ? 20 : below ? -20 : 0) + (stochK > 60 ? 10 : stochK < 40 ? -10 : 0);
    const momentum= moscore > 20 ? 'Bullish' : moscore < -20 ? 'Bearish' : 'Neutral';
    return { rsi1m, rsi5m, rsi15m, macdLine, signal, hist, stochK, stochD, ema9, ema21, momentum, moscore,
      summary: `Momentum ${momentum}. RSI 1m/5m/15m: ${rsi1m}/${rsi5m}/${rsi15m}. MACD hist: ${hist > 0 ? '+' : ''}${hist}. Stoch K/D: ${stochK}/${stochD}. EMA9: ${ema9.toFixed(5)}, EMA21: ${ema21.toFixed(5)}. Price is ${above ? 'above both EMAs — bull stack' : below ? 'below both EMAs — bear stack' : 'between EMAs — compressed'}.` };
  },

  // Phase 4 — Microstructure (level 2, tape, liquidity pockets)
  async runMicroStructure(sym, price) {
    await this.delay(this.ri(250, 550));
    const s1 = parseFloat((price * this.rf(0.997, 0.999)).toFixed(5));
    const s2 = parseFloat((price * this.rf(0.993, 0.996)).toFixed(5));
    const r1 = parseFloat((price * this.rf(1.001, 1.003)).toFixed(5));
    const r2 = parseFloat((price * this.rf(1.004, 1.007)).toFixed(5));
    const liquidity = this.pick(['Resting buy stops below S1','Resting sell stops above R1','Liquidity vacuum above R2','Double bottom liquidity at S2','Thin air above R1—gap risk','Clustered stops near S1']);
    const vwap   = this.rf(price * 0.997, price * 1.003, 5);
    const vwapPos= price > vwap ? 'Above VWAP — bullish intraday bias' : 'Below VWAP — bearish intraday bias';
    const sessions= this.pick(['London Open','NY Open','London/NY Overlap','Asian Session','Off-Hours']);
    const structScore = this.ri(30, 90);
    return { s1, s2, r1, r2, liquidity, vwap, vwapPos, sessions, structScore,
      summary: `Key levels — S1:${s1} S2:${s2} | R1:${r1} R2:${r2}. ${liquidity}. VWAP: ${vwap.toFixed(5)} → ${vwapPos}. Session: ${sessions}. Structure score: ${structScore}/100.` };
  },

  // Phase 5 — Entry Signal (the scalp setup)
  async runEntrySignal(sym, price, paData, ofData, moData, msData) {
    await this.delay(this.ri(400, 800));
    const bullVotes = [paData.biasScore > 55, ofData.side === 'BUY' && ofData.imbalance > 40, moData.momentum === 'Bullish', price > msData.vwap].filter(Boolean).length;
    const bearVotes = [paData.biasScore < 45, ofData.side === 'SELL' && ofData.imbalance > 40, moData.momentum === 'Bearish', price < msData.vwap].filter(Boolean).length;
    let signal, confidence, setup;
    if (bullVotes >= 3) { signal = 'LONG'; confidence = this.ri(65, 92); setup = this.pick(['Momentum Break','VWAP Reclaim','Order Flow Surge','EMA Stack','Support Bounce','Bull Flag']); }
    else if (bearVotes >= 3) { signal = 'SHORT'; confidence = this.ri(65, 92); setup = this.pick(['Breakdown','VWAP Rejection','Ask Wall','EMA Rollover','Resistance Fail','Bear Flag']); }
    else { signal = 'NO TRADE'; confidence = this.ri(20, 50); setup = 'Conflicting — wait for alignment'; }

    const entry   = parseFloat(price.toFixed(5));
    const spread  = ofData.spread;
    const atr     = paData.atr;
    const target1 = signal === 'LONG'  ? parseFloat((entry + atr * 1.5).toFixed(5))
                  : signal === 'SHORT' ? parseFloat((entry - atr * 1.5).toFixed(5)) : entry;
    const target2 = signal === 'LONG'  ? parseFloat((entry + atr * 3.0).toFixed(5))
                  : signal === 'SHORT' ? parseFloat((entry - atr * 3.0).toFixed(5)) : entry;
    const stop    = signal === 'LONG'  ? parseFloat((entry - atr * 1.0).toFixed(5))
                  : signal === 'SHORT' ? parseFloat((entry + atr * 1.0).toFixed(5)) : entry;
    const rr1 = stop !== entry ? parseFloat((Math.abs(target1 - entry) / Math.abs(stop - entry)).toFixed(2)) : 0;
    const rr2 = stop !== entry ? parseFloat((Math.abs(target2 - entry) / Math.abs(stop - entry)).toFixed(2)) : 0;
    return { signal, confidence, setup, entry, target1, target2, stop, rr1, rr2, bullVotes, bearVotes,
      summary: `${signal} — ${setup}. Entry: ${entry} | T1: ${target1} (${rr1}R) | T2: ${target2} (${rr2}R) | SL: ${stop}. ${bullVotes} bull / ${bearVotes} bear votes. Confidence: ${confidence}%.` };
  },

  // Phase 6 — Risk Gate
  async runRiskGate(entryData, settings) {
    await this.delay(this.ri(200, 500));
    const rr = entryData.rr1;
    const conf = entryData.confidence;
    const spread = 0.002;
    let status, reason, positionSize;
    const maxRisk = parseFloat(settings.riskPct) || 1;
    if (entryData.signal === 'NO TRADE') { status = 'BLOCKED'; reason = 'No valid signal from entry agents.'; positionSize = 0; }
    else if (rr < 1.5) { status = 'BLOCKED'; reason = `R:R too low (${rr}R). Minimum 1.5R required for scalp.`; positionSize = 0; }
    else if (conf < 60) { status = 'REDUCE'; reason = `Confidence ${conf}% below threshold. Halve normal size.`; positionSize = parseFloat((maxRisk * 0.5).toFixed(2)); }
    else if (rr >= 2) { status = 'APPROVED'; reason = `Strong setup. ${rr}R with ${conf}% confidence. Full size.`; positionSize = maxRisk; }
    else { status = 'APPROVED'; reason = `Acceptable ${rr}R setup. Proceed at standard size.`; positionSize = parseFloat((maxRisk * 0.75).toFixed(2)); }
    const maxLoss = parseFloat((positionSize * 100).toFixed(0));
    return { status, reason, positionSize, maxLoss, rr };
  },

  // Phase 7 — Execution Brief
  async runExecution(sym, entryData, riskData) {
    await this.delay(this.ri(150, 400));
    const valid = riskData.status !== 'BLOCKED';
    const urgency = entryData.confidence > 80 ? 'IMMEDIATE' : entryData.confidence > 65 ? 'READY' : 'STANDBY';
    const orderType = entryData.rr1 > 2.5 ? 'Limit' : 'Market';
    const expiry = this.pick(['Good for 60s','Good for 5m','GTC','IOC']);
    const notes = valid
      ? `${urgency} ${entryData.signal} via ${orderType} order. Size: ${riskData.positionSize}% risk. ${expiry}. Trail stop after T1 hit.`
      : 'Stand down. Reassess on next candle close.';
    return { valid, urgency, orderType, expiry, notes, signal: entryData.signal };
  },

  // ── AI Provider ──────────────────────────────────────────────────────────────
  async callAI(prompt, settings) {
    const cfg = Settings.providerCfg(settings.provider);
    const baseUrl = settings.baseUrl || cfg.baseUrl;
    const model   = settings.model || cfg.model;
    if (!settings.apiKey || settings.provider === 'simulation') throw new Error('simulation');

    const headers = { 'Content-Type': 'application/json' };
    if (settings.provider === 'claude') {
      headers['x-api-key'] = settings.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }

    const body = settings.provider === 'gemini'
      ? JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 600 } })
      : JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: 0.5 });

    const endpoint = settings.provider === 'gemini'
      ? `${baseUrl}/models/${model}:generateContent?key=${settings.apiKey}`
      : `${baseUrl}/chat/completions`;

    const res = await fetch(endpoint, { method: 'POST', headers, body });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    if (settings.provider === 'claude') return data.content[0].text;
    if (settings.provider === 'gemini') return data.candidates[0].content.parts[0].text;
    return data.choices[0].message.content;
  },

  // ── AI Prompts for each phase ─────────────────────────────────────────────
  buildPrompts(sym, price, tf, type) {
    const ctx = `Asset: ${sym} (${type}), Price: ${price}, Timeframe: ${tf}. Respond with ONLY a JSON object, no markdown, no explanation.`;
    return {
      priceAction: `${ctx} You are a scalp trader's Price Action agent. Return: {"barBias":"Bullish|Bearish|Doji|Pin Bar|Engulfing","open":float,"close":float,"high":float,"low":float,"range":float,"atr":float,"vol":"Low|Average|High|Spike|Climax","biasScore":0-100,"summary":"2 sentences max"}`,
      orderFlow:   `${ctx} You are an Order Flow agent. Return: {"bidVol":int,"askVol":int,"delta":int,"imbalance":float,"side":"BUY|SELL","pressure":"Weak|Moderate|Strong","spread":float,"book":"Stacked Bids|Stacked Asks|Balanced|Thin|Iceberg Detected","bigTrades":int,"summary":"2 sentences"}`,
      momentum:    `${ctx} You are a Momentum agent analyzing RSI, MACD, Stochastic, EMAs. Return: {"rsi1m":float,"rsi5m":float,"rsi15m":float,"macdLine":float,"signal":float,"hist":float,"stochK":int,"stochD":int,"ema9":float,"ema21":float,"momentum":"Bullish|Bearish|Neutral","moscore":int,"summary":"2 sentences"}`,
      microStructure:`${ctx} You are a Microstructure agent. Identify key intraday levels, VWAP position, session context, liquidity pockets. Return: {"s1":float,"s2":float,"r1":float,"r2":float,"liquidity":"short description","vwap":float,"vwapPos":"string","sessions":"string","structScore":0-100,"summary":"2 sentences"}`,
    };
  }
};

// ─── Main Analysis Pipeline ───────────────────────────────────────────────────

async function runAnalysis(sym, tf, onProgress) {
  const settings = Settings.get();
  const type     = Sim.classifyAsset(sym);
  const price    = Sim.genPrice(sym, type);
  const useAI    = settings.provider !== 'simulation' && settings.apiKey;
  const prompts  = Sim.buildPrompts(sym, price, tf, type);

  const step = (phase, label) => onProgress(phase, label);

  step(0, 'Reading price action…');
  let paData;
  try {
    if (useAI) {
      const raw = await Sim.callAI(prompts.priceAction, settings);
      paData = { ...JSON.parse(raw.replace(/```json?|```/g, '').trim()), status: 'complete' };
    } else throw new Error('sim');
  } catch { paData = await Sim.runPriceAction(sym, price, tf); }

  step(1, 'Scanning order flow…');
  let ofData;
  try {
    if (useAI) {
      const raw = await Sim.callAI(prompts.orderFlow, settings);
      ofData = { ...JSON.parse(raw.replace(/```json?|```/g, '').trim()), status: 'complete' };
    } else throw new Error('sim');
  } catch { ofData = await Sim.runOrderFlow(sym, price); }

  step(2, 'Calculating momentum…');
  let moData;
  try {
    if (useAI) {
      const raw = await Sim.callAI(prompts.momentum, settings);
      moData = { ...JSON.parse(raw.replace(/```json?|```/g, '').trim()), status: 'complete' };
    } else throw new Error('sim');
  } catch { moData = await Sim.runMomentum(sym, price, tf); }

  step(3, 'Mapping microstructure…');
  let msData;
  try {
    if (useAI) {
      const raw = await Sim.callAI(prompts.microStructure, settings);
      msData = { ...JSON.parse(raw.replace(/```json?|```/g, '').trim()), status: 'complete' };
    } else throw new Error('sim');
  } catch { msData = await Sim.runMicroStructure(sym, price); }

  step(4, 'Generating entry signal…');
  const entryData = await Sim.runEntrySignal(sym, price, paData, ofData, moData, msData);

  step(5, 'Running risk gate…');
  const riskData = await Sim.runRiskGate(entryData, settings);

  step(6, 'Compiling execution brief…');
  const execData = await Sim.runExecution(sym, entryData, riskData);

  const result = { sym, tf, type, price, timestamp: Date.now(), paData, ofData, moData, msData, entryData, riskData, execData };
  History.add({ sym, tf, signal: entryData.signal, confidence: entryData.confidence, price });
  Watchlist.add(sym);
  return result;
}

// ─── UI ───────────────────────────────────────────────────────────────────────

const App = {
  result: null,
  scanInterval: null,

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
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  tab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  },

  bindNav() {
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => this.tab(b.dataset.tab)));
  },

  // ── Main Scan Panel ─────────────────────────────────────────────────────────
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
    this.showLoading(true);
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
      this.toast('Scan failed: ' + e.message, 'err');
    }
    this.showLoading(false);
  },

  showLoading(on) {
    document.getElementById('loadingOverlay').classList.toggle('show', on);
    document.getElementById('scanBtn').disabled = on;
    if (!on) { document.getElementById('progressBar').style.width = '0%'; }
  },

  updateProgress(phase, label) {
    const total = SCALP_LABELS.length;
    const pct = Math.round(((phase + 1) / total) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = SCALP_LABELS[phase] || label;
    document.getElementById('progressSub').textContent = label;
  },

  // ── Result Rendering ────────────────────────────────────────────────────────
  renderResult(r) {
    document.getElementById('resultSection').style.display = 'block';
    const { sym, tf, price, paData, ofData, moData, msData, entryData, riskData, execData } = r;

    // Header
    document.getElementById('resSym').textContent = sym;
    document.getElementById('resTF').textContent = tf;
    document.getElementById('resPrice').textContent = price.toFixed(5);
    document.getElementById('resTime').textContent = new Date().toLocaleTimeString();

    // Exec banner
    const banner = document.getElementById('execBanner');
    const ec = execData.signal === 'LONG' ? 'signal-long' : execData.signal === 'SHORT' ? 'signal-short' : 'signal-flat';
    banner.className = 'exec-banner ' + ec;
    document.getElementById('execSignal').textContent = execData.signal;
    document.getElementById('execUrgency').textContent = execData.urgency;
    document.getElementById('execNotes').textContent = execData.notes;
    document.getElementById('riskStatus').textContent = riskData.status;
    document.getElementById('riskStatus').className = 'risk-badge risk-' + riskData.status.toLowerCase().replace(' ', '-');
    document.getElementById('riskReason').textContent = riskData.reason;

    // Entry levels
    document.getElementById('entryVal').textContent = entryData.entry?.toFixed(5) ?? '--';
    document.getElementById('t1Val').textContent    = entryData.target1?.toFixed(5) ?? '--';
    document.getElementById('t2Val').textContent    = entryData.target2?.toFixed(5) ?? '--';
    document.getElementById('slVal').textContent    = entryData.stop?.toFixed(5) ?? '--';
    document.getElementById('rr1Val').textContent   = entryData.rr1 + 'R';
    document.getElementById('rr2Val').textContent   = entryData.rr2 + 'R';
    document.getElementById('setupVal').textContent = entryData.setup ?? '--';
    document.getElementById('confBar').style.width  = (entryData.confidence || 0) + '%';
    document.getElementById('confVal').textContent  = (entryData.confidence || 0) + '%';

    // Votes
    document.getElementById('bullVotes').textContent = '▲ ' + (entryData.bullVotes ?? 0);
    document.getElementById('bearVotes').textContent = '▼ ' + (entryData.bearVotes ?? 0);

    // Phase cards
    this.fillPhaseCard('pa',  paData,  ['barBias','vol','biasScore', 'atr'], paData.summary);
    this.fillPhaseCard('of',  ofData,  ['side','pressure','imbalance','book'], ofData.summary);
    this.fillPhaseCard('mo',  moData,  ['momentum','rsi5m','hist','stochK'], moData.summary);
    this.fillPhaseCard('ms',  msData,  ['structScore','sessions','vwapPos'], msData.summary);

    // Scroll result into view
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
  },

  fillPhaseCard(id, data, keys, summary) {
    const card = document.getElementById('card-' + id);
    if (!card) return;
    const metaEl = card.querySelector('.card-meta');
    const sumEl  = card.querySelector('.card-summary');
    if (metaEl) metaEl.innerHTML = keys.map(k => {
      const v = data[k] ?? '--';
      return `<span class="meta-item"><span class="meta-key">${k.toUpperCase()}</span><span class="meta-val">${v}</span></span>`;
    }).join('');
    if (sumEl) sumEl.textContent = summary || '';
  },

  // ── Watchlist & History ─────────────────────────────────────────────────────
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

  // ── Settings ────────────────────────────────────────────────────────────────
  bindSettings() {
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => { History.clear(); this.renderHistory(); this.toast('History cleared', 'ok'); });
    document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());
    document.getElementById('providerSelect').addEventListener('change', () => this.onProviderChange());
  },

  loadSettingsToForm() {
    const s = Settings.get();
    const fields = ['provider','apiKey','model','baseUrl','riskPct','tfDefault'];
    fields.forEach(k => { const el = document.getElementById('set-' + k); if (el) el.value = s[k] || ''; });
    document.getElementById('providerSelect').value = s.provider || 'simulation';
    this.onProviderChange();
  },

  onProviderChange() {
    const p = document.getElementById('providerSelect').value;
    const show = p !== 'simulation';
    ['apiKey','model','baseUrl'].forEach(k => {
      const row = document.getElementById('row-' + k);
      if (row) row.style.display = show ? '' : 'none';
    });
  },

  saveSettings() {
    const s = {};
    ['provider','apiKey','model','baseUrl','riskPct','tfDefault'].forEach(k => {
      const el = document.getElementById('set-' + k) || document.getElementById('providerSelect');
      if (k === 'provider') s[k] = document.getElementById('providerSelect').value;
      else if (el) s[k] = el.value;
    });
    Settings.save(s);
    this.toast('Settings saved', 'ok');
  },

  // ── Export ──────────────────────────────────────────────────────────────────
  bindExport() {
    document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJSON());
    document.getElementById('exportRptBtn').addEventListener('click', () => this.exportReport());
  },

  exportJSON() {
    if (!this.result) { this.toast('Run a scan first', 'warn'); return; }
    const blob = new Blob([JSON.stringify(this.result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scalper_${this.result.sym}_${Date.now()}.json`;
    a.click();
  },

  exportReport() {
    if (!this.result) { this.toast('Run a scan first', 'warn'); return; }
    const r = this.result;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Scalper AI — ${r.sym}</title>
    <style>body{font-family:monospace;background:#000;color:#0f0;padding:2rem}h1{color:#0ff}table{width:100%;border-collapse:collapse}td,th{border:1px solid #0f0;padding:6px 10px}th{background:#001100}</style></head>
    <body><h1>⚡ Scalper AI — ${r.sym} / ${r.tf}</h1>
    <p>Generated: ${new Date().toLocaleString()} | Price: ${r.price}</p>
    <h2>Signal: ${r.execData.signal} | Risk: ${r.riskData.status}</h2>
    <p>${r.execData.notes}</p>
    <h3>Entry Levels</h3><table><tr><th>Entry</th><th>T1</th><th>T2</th><th>Stop</th><th>R1</th><th>R2</th></tr>
    <tr><td>${r.entryData.entry}</td><td>${r.entryData.target1}</td><td>${r.entryData.target2}</td><td>${r.entryData.stop}</td><td>${r.entryData.rr1}R</td><td>${r.entryData.rr2}R</td></tr></table>
    <h3>Agent Summaries</h3>
    <p><b>Price Action:</b> ${r.paData.summary}</p>
    <p><b>Order Flow:</b> ${r.ofData.summary}</p>
    <p><b>Momentum:</b> ${r.moData.summary}</p>
    <p><b>Microstructure:</b> ${r.msData.summary}</p>
    <p><b>Entry Signal:</b> ${r.entryData.summary}</p>
    <p style="color:#666;font-size:0.8em">⚠ Educational simulation only. Not financial advice.</p>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scalper_${r.sym}_report.html`;
    a.click();
  },

  // ── Utilities ────────────────────────────────────────────────────────────────
  toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
  },

  startClock() {
    const el = document.getElementById('clockEl');
    const tick = () => { if (el) el.textContent = new Date().toLocaleTimeString(); };
    tick();
    setInterval(tick, 1000);
  },

  applyTheme() {
    const dark = localStorage.getItem(SK.THEME) !== 'light';
    document.body.classList.toggle('light', !dark);
  },

  toggleTheme() {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem(SK.THEME, isLight ? 'light' : 'dark');
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
