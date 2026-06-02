/**
 * Kamote Trading AI - Multi-Agent Intelligence for Financial Markets
 * works.js — Core Application Logic
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';
const STORAGE_KEYS = {
  SETTINGS: 'tradefirm_settings',
  HISTORY:  'tradefirm_history',
  WATCHLIST:'tradefirm_watchlist',
  THEME:    'tradefirm_theme',
};

const PHASE_LABELS = ['ANALYST TEAM', 'RESEARCH DEBATE', 'TRADER DECISION', 'RISK REVIEW', 'PORTFOLIO FINAL'];

// ─── Settings Manager ─────────────────────────────────────────────────────────

const SettingsManager = {
  defaults: {
    provider: 'simulation',
    apiKey: '',
    model: '',
    baseUrl: '',
    useSimulation: true,
  },

  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...this.defaults, ...JSON.parse(raw) } : { ...this.defaults };
    } catch { return { ...this.defaults }; }
  },

  save(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) { console.warn('Settings save failed', e); }
  },

  getProviderConfig(provider) {
    const configs = {
      openai:     { baseUrl: 'https://api.openai.com/v1',          model: 'gpt-4o-mini' },
      gemini:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash' },
      claude:     { baseUrl: 'https://api.anthropic.com/v1',       model: 'claude-3-haiku-20240307' },
      deepseek:   { baseUrl: 'https://api.deepseek.com/v1',        model: 'deepseek-chat' },
      openrouter: { baseUrl: 'https://openrouter.ai/api/v1',       model: 'openai/gpt-4o-mini' },
      groq:       { baseUrl: 'https://api.groq.com/openai/v1',     model: 'llama-3.1-8b-instant' },
      mistral:    { baseUrl: 'https://api.mistral.ai/v1',          model: 'mistral-small' },
      simulation: { baseUrl: '', model: 'simulation' },
    };
    return configs[provider] || configs.simulation;
  }
};

// ─── History & Watchlist ──────────────────────────────────────────────────────

const HistoryManager = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]'); }
    catch { return []; }
  },
  add(entry) {
    const history = this.getAll();
    history.unshift({ ...entry, id: Date.now(), date: new Date().toISOString() });
    if (history.length > 50) history.pop();
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  },
  clear() { localStorage.removeItem(STORAGE_KEYS.HISTORY); }
};

const WatchlistManager = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.WATCHLIST) || '[]'); }
    catch { return []; }
  },
  add(symbol) {
    const list = this.getAll();
    if (!list.includes(symbol.toUpperCase())) {
      list.push(symbol.toUpperCase());
      localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(list));
    }
  },
  remove(symbol) {
    const list = this.getAll().filter(s => s !== symbol.toUpperCase());
    localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(list));
  }
};

// ─── Simulation Engine ────────────────────────────────────────────────────────

const SimulationEngine = {
  rng: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  rngf: (min, max, decimals = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],

  delay: ms => new Promise(resolve => setTimeout(resolve, ms)),

  classifyAsset(symbol) {
    const s = symbol.toUpperCase();
    if (/USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|NZD/.test(s) && s.length === 6) return 'forex';
    if (/BTC|ETH|SOL|ADA|DOT|AVAX|MATIC|LINK|UNI|XRP/.test(s)) return 'crypto';
    if (/XAU|XAG|CL|NG|HG|WHEAT|CORN|SOYB/.test(s)) return 'commodity';
    return 'equity';
  },

  generatePrice(symbol, assetType) {
    const priceRanges = {
      forex:     [0.80, 1.50],
      crypto:    [100, 70000],
      commodity: [15, 2200],
      equity:    [10, 900],
    };
    const [min, max] = priceRanges[assetType];
    return this.rngf(min, max, assetType === 'forex' ? 4 : 2);
  },

  async runFundamentalsAnalyst(symbol, assetType) {
    await this.delay(this.rng(800, 1800));
    const bullScore = this.rng(30, 95);
    const bearScore = 100 - bullScore + this.rng(-15, 15);
    const metrics = {
      equity: {
        'Revenue Growth': `${this.rngf(2, 35)}% YoY`,
        'Profit Margin': `${this.rngf(5, 42)}%`,
        'P/E Ratio': `${this.rngf(8, 65)}x`,
        'Debt/Equity': `${this.rngf(0.1, 2.5)}`,
        'EPS Growth': `${this.rngf(-5, 45)}%`,
        'ROE': `${this.rngf(8, 38)}%`,
      },
      crypto: {
        'Network Growth': `${this.rngf(5, 120)}% MoM`,
        'On-Chain Volume': `$${this.rngf(1, 50)}B`,
        'Active Wallets': `${this.rng(500, 5000)}K`,
        'Dev Activity': `${this.pick(['High','Medium','Low','Very High'])}`,
        'Market Cap Rank': `#${this.rng(1, 50)}`,
        'TVL Change': `${this.rngf(-20, 80)}%`,
      },
      forex: {
        'Interest Rate Diff': `${this.rngf(0.25, 4)}%`,
        'GDP Growth': `${this.rngf(-1, 5)}%`,
        'Inflation': `${this.rngf(1, 9)}%`,
        'Trade Balance': `${this.pick(['+','-'])}$${this.rngf(0.5, 80)}B`,
        'Central Bank Stance': this.pick(['Hawkish','Neutral','Dovish']),
        'Currency Reserves': `$${this.rng(100, 3000)}B`,
      },
      commodity: {
        'Supply Deficit': `${this.rngf(-5, 15)}%`,
        'Demand Growth': `${this.rngf(-3, 20)}%`,
        'Inventory Levels': this.pick(['Low','Normal','High','Critical']),
        'Production Cost': `$${this.rngf(10, 1200)}/oz`,
        'Seasonal Factor': this.pick(['Bullish','Neutral','Bearish']),
        'Geopolitical Risk': this.pick(['Low','Moderate','High','Extreme']),
      },
    };
    const m = metrics[assetType] || metrics.equity;
    const summaries = [
      `${symbol} demonstrates ${bullScore > 65 ? 'strong' : 'moderate'} fundamental characteristics. ${assetType === 'equity' ? 'Revenue trajectory is encouraging with improving margins.' : assetType === 'crypto' ? 'On-chain metrics signal healthy network adoption.' : 'Macro fundamentals present a compelling picture.'} Key risk factors include ${this.pick(['elevated valuations','competitive pressures','macro headwinds','regulatory uncertainty','liquidity concerns'])}.`,
      `Fundamental analysis reveals ${bullScore > 70 ? 'a favorable risk/reward setup' : 'mixed signals requiring caution'}. ${this.pick(['Institutional accumulation patterns are visible.','Retail participation remains elevated.','Smart money appears to be positioning.','Insider activity suggests confidence.'])} Valuation ${bullScore > 60 ? 'remains reasonable' : 'appears stretched'} relative to peers.`,
    ];
    return { bullScore: Math.min(95, Math.max(20, bullScore)), bearScore: Math.min(80, Math.max(15, bearScore)), metrics: m, summary: this.pick(summaries), analyst: 'Fundamentals Analyst', status: 'complete' };
  },

  async runSentimentAnalyst(symbol, assetType) {
    await this.delay(this.rng(600, 1400));
    const positive = this.rng(20, 85);
    const negative = 100 - positive + this.rng(-10, 10);
    const fearGreed = this.rng(10, 90);
    const fgLabel = fearGreed < 25 ? 'Extreme Fear' : fearGreed < 45 ? 'Fear' : fearGreed < 55 ? 'Neutral' : fearGreed < 75 ? 'Greed' : 'Extreme Greed';
    const socialVolume = this.pick(['Low','Moderate','High','Very High','Trending']);
    const summaries = [
      `Market sentiment for ${symbol} shows ${positive > 60 ? 'predominantly bullish' : positive > 40 ? 'mixed' : 'bearish'} retail positioning. Social media chatter is ${socialVolume.toLowerCase()} with ${fearGreed > 60 ? 'greedy' : fearGreed < 40 ? 'fearful' : 'neutral'} undertones. ${this.pick(['Reddit WSB mentions up 340%','Twitter/X trending in financial circles','Unusual options activity detected','Dark pool prints signal institutional interest','Whale wallets showing accumulation patterns'])}.`,
      `Crowd psychology analysis indicates ${positive > 55 ? 'optimism' : 'skepticism'} among market participants. Fear & Greed index at ${fearGreed} suggests ${fgLabel.toLowerCase()} conditions—${fearGreed > 70 ? 'a contrarian warning signal' : fearGreed < 30 ? 'potential bottom formation' : 'balanced positioning'}. ${this.pick(['Sentiment diverging from price action','Following the institutional footprint','Retail crowding into longs','Short interest elevated—squeeze potential','Options skew suggests hedging activity'])}.`,
    ];
    return { positive: Math.min(90, Math.max(10, positive)), negative: Math.min(80, Math.max(10, negative)), fearGreed, fgLabel, socialVolume, summary: this.pick(summaries), analyst: 'Sentiment Analyst', status: 'complete' };
  },

  async runTechnicalAnalyst(symbol, basePrice) {
    await this.delay(this.rng(700, 1600));
    const trend = this.pick(['Strong Uptrend','Uptrend','Sideways','Downtrend','Strong Downtrend']);
    const rsi = this.rngf(18, 82, 1);
    const macd = this.rngf(-5, 5, 2);
    const strength = this.rng(25, 95);
    const bias = strength > 55 ? 'Bullish' : strength > 45 ? 'Neutral' : 'Bearish';
    const support1 = parseFloat((basePrice * this.rngf(0.88, 0.96)).toFixed(2));
    const support2 = parseFloat((basePrice * this.rngf(0.78, 0.87)).toFixed(2));
    const resist1 = parseFloat((basePrice * this.rngf(1.04, 1.12)).toFixed(2));
    const resist2 = parseFloat((basePrice * this.rngf(1.13, 1.25)).toFixed(2));
    const ma50  = parseFloat((basePrice * this.rngf(0.93, 1.07)).toFixed(2));
    const ma200 = parseFloat((basePrice * this.rngf(0.82, 1.18)).toFixed(2));
    const summaries = [
      `Technical structure shows ${trend} conditions. RSI at ${rsi} is ${rsi > 70 ? 'overbought—momentum exhaustion possible' : rsi < 30 ? 'oversold—reversal signal active' : 'neutral with room to run'}. MACD ${macd > 0 ? 'bullish crossover' : 'bearish crossover'} with ${Math.abs(macd).toFixed(2)} histogram value. Price ${basePrice > ma50 ? 'above' : 'below'} 50-DMA suggests ${basePrice > ma50 ? 'bulls in control' : 'bear pressure dominant'}.`,
      `Chart analysis reveals ${bias.toLowerCase()} momentum with ${strength}% trend conviction. Key support cluster at $${support1}–$${support2} zone. Immediate resistance at $${resist1} acting as supply wall. ${this.pick(['Head & shoulders forming','Cup and handle breakout','Falling wedge resolution','Bull flag continuation','Double bottom confirmation','Descending triangle risk'])} pattern suggests directional move imminent.`,
    ];
    return { trend, bias, strength, rsi, macd, support1, support2, resist1, resist2, ma50, ma200, summary: this.pick(summaries), analyst: 'Technical Analyst', status: 'complete' };
  },

  async runNewsAnalyst(symbol, assetType) {
    await this.delay(this.rng(500, 1200));
    const impact = this.rng(20, 95);
    const impactLabel = impact > 70 ? 'High Impact' : impact > 45 ? 'Moderate Impact' : 'Low Impact';
    const riskLevel = this.pick(['Low','Moderate','Elevated','High','Critical']);
    const newsItems = {
      equity: [
        `${symbol} Q${this.rng(1,4)} earnings beat consensus by ${this.rngf(2,18)}%—shares react ${this.pick(['positively','with volatility'])}`,
        `Major analyst upgrade: ${this.pick(['Goldman Sachs','Morgan Stanley','JPMorgan','Bank of America'])} raises PT to $${this.rng(100,500)}`,
        `Insider buying detected: CEO purchases ${this.rng(5,50)}K shares at market`,
        `Strategic acquisition rumored—${this.pick(['synergies likely','premium expected','integration risks'])}`,
        `Regulatory headwinds emerge as ${this.pick(['FTC','SEC','DOJ','EU Commission'])} initiates review`,
      ],
      crypto: [
        `${this.pick(['BlackRock','Fidelity','ARK Invest','Vanguard'])} increases crypto allocation`,
        `Network upgrade scheduled—${this.pick(['scalability improvements','fee reduction','security patches'])}`,
        `Major exchange ${this.pick(['lists','suspends','reviews'])} ${symbol} trading pairs`,
        `${this.pick(['El Salvador','UAE','Singapore','UK'])} advances ${this.pick(['regulation','adoption','framework'])}`,
        `Whale alert: ${this.rng(100,10000)} ${symbol.split('USD')[0]} moved to ${this.pick(['cold storage','exchange','unknown wallet'])}`,
      ],
      forex: [
        `Central bank ${this.pick(['raises','holds','cuts'])} rates by ${this.rngf(0.25, 0.75)}bps—${this.pick(['hawkish','dovish','neutral'])} tone`,
        `CPI data surprises ${this.pick(['to the upside','to the downside'])}—currency reacts ${this.pick(['sharply','modestly'])}`,
        `Geopolitical tensions impact ${symbol} safe-haven flows`,
        `NFP data ${this.pick(['beats','misses','meets'])} expectations—dollar ${this.pick(['strengthens','weakens'])}`,
        `${this.pick(['G7','G20','IMF','World Bank'])} statement on FX intervention risks`,
      ],
      commodity: [
        `OPEC+ ${this.pick(['cuts','maintains','expands'])} production quota by ${this.rng(500,2000)}K bpd`,
        `Supply disruption in ${this.pick(['Middle East','South America','Russia','West Africa'])}`,
        `Inventory data shows ${this.pick(['surprise draw','unexpected build','in-line result'])}`,
        `Seasonal demand ${this.pick(['picking up','weakening','exceeding forecasts'])} in key markets`,
        `Dollar strength ${this.pick(['pressures','supports'])} commodity prices broadly`,
      ],
    };
    const headlines = (newsItems[assetType] || newsItems.equity).slice(0, this.rng(2, 4));
    const summary = `${impactLabel} news flow detected for ${symbol}. ${headlines[0]}. Market participants are monitoring ${this.pick(['macro developments','central bank rhetoric','geopolitical events','earnings season','regulatory landscape'])} closely. Risk assessment: ${riskLevel}.`;
    return { impact, impactLabel, riskLevel, headlines, summary, analyst: 'News Analyst', status: 'complete' };
  },

  async runBullishResearch(symbol, analystData) {
    await this.delay(this.rng(1000, 2000));
    const confidence = this.rng(45, 92);
    const upside = this.rngf(8, 65, 1);
    const reasons = [
      `Strong fundamental backdrop with ${analystData.fundamentals.bullScore > 65 ? 'superior' : 'improving'} financial metrics`,
      `Technical momentum supports ${analystData.technical.trend.toLowerCase()} continuation`,
      `${analystData.sentiment.positive}% positive sentiment creating favorable crowd psychology`,
      `News catalyst pipeline offers near-term re-rating potential`,
      `${this.pick(['Institutional accumulation','Smart money positioning','Options flow','Dark pool activity'])} signals underlying demand`,
      `${this.pick(['Macro tailwinds','Sector rotation inflows','Relative strength','Undervaluation gap','Breakout setup'])} provides additional support`,
    ];
    const selectedReasons = reasons.slice(0, this.rng(3, 5));
    return { confidence, upside, reasons: selectedReasons, thesis: `The bullish case for ${symbol} rests on convergence of fundamental strength, technical momentum, and favorable sentiment dynamics. With ${confidence}% conviction, we see ${upside}% potential upside from current levels. ${this.pick(['The risk/reward favors buyers','Asymmetric upside exists','Accumulation on dips is advised','The setup is compelling for patient bulls'])}.`, role: 'Bullish Research', status: 'complete' };
  },

  async runBearishResearch(symbol, analystData) {
    await this.delay(this.rng(1000, 2000));
    const confidence = this.rng(35, 88);
    const downside = this.rngf(5, 45, 1);
    const reasons = [
      `${analystData.fundamentals.bearScore > 50 ? 'Concerning' : 'Elevated'} valuation metrics limit upside`,
      `${analystData.sentiment.negative}% negative sentiment suggests caution warranted`,
      `Technical resistance at key levels may cap rallies`,
      `Macro risks—${this.pick(['recession fears','rate trajectory','currency headwinds','liquidity tightening'])}—remain underappreciated`,
      `${this.pick(['Competitive disruption','Regulatory overhang','Management uncertainty','Execution risks'])} present downside scenarios`,
      `${this.pick(['Crowded long positioning','Momentum reversal signals','Distribution patterns','Rising short interest'])} warrant defensive posture`,
    ];
    const selectedReasons = reasons.slice(0, this.rng(3, 5));
    return { confidence, downside, reasons: selectedReasons, thesis: `Bears argue ${symbol} faces significant headwinds that the market has not fully priced. With ${confidence}% conviction in the bearish thesis, a ${downside}% drawdown is plausible under adverse scenarios. ${this.pick(['Caution is warranted','Risk management is paramount','Hedging is advisable','Patience is a virtue here'])}.`, role: 'Bearish Research', status: 'complete' };
  },

  async runTraderAgent(symbol, basePrice, bullData, bearData, techData) {
    await this.delay(this.rng(1200, 2200));
    const bullStrength = bullData.confidence * 0.6 + bearData.confidence * 0.1;
    const rand = this.rng(0, 100);
    let action;
    if (bullStrength > 55 && rand > 35) action = 'BUY';
    else if (bullStrength < 40 || rand < 25) action = 'SELL';
    else action = 'HOLD';

    const priceMulti = action === 'BUY' ? 1 : action === 'SELL' ? 0.99 : 1;
    const entry  = parseFloat((basePrice * priceMulti).toFixed(4));
    const target = action === 'BUY'  ? parseFloat((entry * (1 + this.rngf(0.05, 0.35))).toFixed(4))
                 : action === 'SELL' ? parseFloat((entry * (1 - this.rngf(0.05, 0.30))).toFixed(4))
                 : entry;
    const stop   = action === 'BUY'  ? parseFloat((entry * (1 - this.rngf(0.03, 0.12))).toFixed(4))
                 : action === 'SELL' ? parseFloat((entry * (1 + this.rngf(0.03, 0.12))).toFixed(4))
                 : entry;
    const confidence = this.rng(50, 92);
    const timeframe = this.pick(['Intraday','Swing (1-5 days)','Short-term (1-4 weeks)','Medium-term (1-3 months)']);
    const rationale = `Trader synthesizes all reports. ${action === 'BUY' ? 'Bullish convergence across signals warrants long entry.' : action === 'SELL' ? 'Bearish signals dominate—short or exit positions.' : 'Conflicting signals advise patience. Waiting for confirmation.'} Timeframe: ${timeframe}. ${this.pick(['Staged entry recommended','All-in at market','Limit orders preferred','Scale into position'])}.`;
    return { action, entry, target, stop, confidence, timeframe, rationale, role: 'Trader Agent', status: 'complete' };
  },

  async runRiskManager(traderData, basePrice) {
    await this.delay(this.rng(800, 1500));
    const riskAmt  = Math.abs(traderData.entry - traderData.stop);
    const rewardAmt= Math.abs(traderData.target - traderData.entry);
    const rrRatio  = riskAmt > 0 ? parseFloat((rewardAmt / riskAmt).toFixed(2)) : 0;
    const positionSize = this.rngf(0.5, 8, 1);
    const maxDrawdown  = this.rngf(2, 18, 1);
    const exposure     = this.pick(['Low','Moderate','Medium','Elevated','High']);
    let approval;
    if (rrRatio >= 2 && positionSize <= 5) approval = 'APPROVED';
    else if (rrRatio >= 1.5 || (rrRatio < 1 && positionSize > 6)) approval = 'REVIEW NEEDED';
    else if (rrRatio < 1) approval = 'REJECTED';
    else approval = 'APPROVED';
    const notes = approval === 'APPROVED' ? `Risk parameters within acceptable thresholds. R/R of ${rrRatio} meets minimum requirements.`
                : approval === 'REVIEW NEEDED' ? `Marginal risk parameters. ${rrRatio < 1.5 ? 'R/R ratio below preferred threshold.' : 'Position sizing requires adjustment.'} Recommend reducing size by 30%.`
                : `Trade rejected. Risk/reward of ${rrRatio} is unfavorable. ${this.pick(['Revisit entry level','Wait for better setup','Adjust stop placement','Target recalibration needed'])}.`;
    return { rrRatio, positionSize, maxDrawdown, exposure, approval, notes, role: 'Risk Manager', status: 'complete' };
  },

  async runPortfolioManager(symbol, traderData, riskData, bullData, bearData) {
    await this.delay(this.rng(1000, 1800));
    let finalDecision = traderData.action;
    if (riskData.approval === 'REJECTED') finalDecision = 'HOLD';
    const allocation = riskData.approval === 'APPROVED' ? this.rngf(1, 8, 1) : this.rngf(0.5, 3, 1);
    const overallConfidence = Math.round((traderData.confidence * 0.4 + bullData.confidence * 0.3 + (100 - bearData.confidence) * 0.3));
    const summaries = {
      BUY:  `Portfolio Manager endorses the BUY signal for ${symbol}. ${overallConfidence}% overall conviction. Allocating ${allocation}% of portfolio. Risk-adjusted thesis is compelling. ${riskData.approval === 'APPROVED' ? 'Full size approved by risk desk.' : 'Reduced size per risk review.'}`,
      SELL: `Portfolio Manager concurs with SELL recommendation on ${symbol}. ${overallConfidence}% conviction. ${allocation}% allocation reduced/shorted. Defensive positioning appropriate given current risk landscape.`,
      HOLD: `Portfolio Manager advises HOLD on ${symbol}. ${overallConfidence}% confidence in wait-and-see approach. ${riskData.approval === 'REJECTED' ? 'Risk desk rejection overrides trader signal.' : 'Insufficient conviction for directional bet at this time.'} Revisit on next signal confirmation.`,
    };
    return { finalDecision, allocation, overallConfidence, summary: summaries[finalDecision], role: 'Portfolio Manager', status: 'complete' };
  },

  // ── AI Provider Call ────────────────────────────────────────────────────────
  async callAIProvider(prompt, settings) {
    const cfg = SettingsManager.getProviderConfig(settings.provider);
    const baseUrl = settings.baseUrl || cfg.baseUrl;
    const model   = settings.model   || cfg.model;
    const apiKey  = settings.apiKey;
    if (!apiKey || settings.provider === 'simulation') throw new Error('simulation');

    const headers = { 'Content-Type': 'application/json' };
    if (settings.provider === 'claude') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = settings.provider === 'gemini'
      ? JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 500 } })
      : JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.7 });

    const endpoint = settings.provider === 'gemini'
      ? `${baseUrl}/models/${model}:generateContent?key=${apiKey}`
      : `${baseUrl}/chat/completions`;

    const response = await fetch(endpoint, { method: 'POST', headers, body });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    if (settings.provider === 'claude') return data.content[0].text;
    if (settings.provider === 'gemini') return data.candidates[0].content.parts[0].text;
    return data.choices[0].message.content;
  }
};

// ─── UI Controller ────────────────────────────────────────────────────────────

const UI = {
  elements: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    this.initClock();
    this.renderWatchlist();
    this.renderHistory();
    this.applyTheme();
    this.registerPWA();
  },

  cacheElements() {
    const ids = ['assetInput','analyzeBtn','loadingOverlay','progressBar','progressText','phaseLabel',
      'settingsBtn','settingsModal','saveSettingsBtn','closeSettingsBtn','themeToggleBtn',
      'exportJsonBtn','exportPdfBtn','clearHistoryBtn','installPwaBtn',
      'providerSelect','apiKeyInput','modelInput','baseUrlInput',
      'watchlistContainer','historyContainer','notificationContainer',
      'fundamentalsCard','sentimentCard','technicalCard','newsCard',
      'bullishPanel','bearishPanel','traderPanel','riskPanel','portfolioPanel',
      'clockEl','statusDot','currentSymbolDisplay'];
    ids.forEach(id => { this.elements[id] = document.getElementById(id); });
  },

  bindEvents() {
    const { analyzeBtn, assetInput, settingsBtn, settingsModal, saveSettingsBtn,
            closeSettingsBtn, themeToggleBtn, exportJsonBtn, exportPdfBtn,
            clearHistoryBtn, providerSelect, installPwaBtn } = this.elements;

    analyzeBtn?.addEventListener('click', () => this.startAnalysis());
    assetInput?.addEventListener('keydown', e => { if (e.key === 'Enter') this.startAnalysis(); });

    settingsBtn?.addEventListener('click', () => { settingsModal.classList.add('active'); this.loadSettingsToForm(); });
    closeSettingsBtn?.addEventListener('click', () => settingsModal.classList.remove('active'));
    settingsModal?.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.remove('active'); });
    saveSettingsBtn?.addEventListener('click', () => this.saveSettings());

    themeToggleBtn?.addEventListener('click', () => this.toggleTheme());
    exportJsonBtn?.addEventListener('click', () => this.exportJSON());
    exportPdfBtn?.addEventListener('click', () => this.exportPDF());
    clearHistoryBtn?.addEventListener('click', () => { HistoryManager.clear(); this.renderHistory(); this.notify('History cleared', 'info'); });
    providerSelect?.addEventListener('change', () => this.updateProviderDefaults());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') { e.preventDefault(); this.startAnalysis(); }
        if (e.key === ',')     { e.preventDefault(); settingsModal.classList.toggle('active'); this.loadSettingsToForm(); }
      }
      if (e.key === 'Escape') settingsModal?.classList.remove('active');
    });

    installPwaBtn?.addEventListener('click', () => this.installPWA());
  },

  applyTheme() {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEYS.THEME, next);
  },

  initClock() {
    const update = () => {
      if (this.elements.clockEl) {
        const now = new Date();
        this.elements.clockEl.textContent = now.toLocaleString('en-US', { weekday:'short', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
      }
    };
    update();
    setInterval(update, 1000);
  },

  loadSettingsToForm() {
    const s = SettingsManager.get();
    const { providerSelect, apiKeyInput, modelInput, baseUrlInput } = this.elements;
    if (providerSelect) providerSelect.value = s.provider || 'simulation';
    if (apiKeyInput)   apiKeyInput.value   = s.apiKey   || '';
    if (modelInput)    modelInput.value    = s.model    || '';
    if (baseUrlInput)  baseUrlInput.value  = s.baseUrl  || '';
  },

  saveSettings() {
    const { providerSelect, apiKeyInput, modelInput, baseUrlInput, settingsModal } = this.elements;
    const settings = {
      provider: providerSelect?.value || 'simulation',
      apiKey:   apiKeyInput?.value.trim() || '',
      model:    modelInput?.value.trim()  || '',
      baseUrl:  baseUrlInput?.value.trim()|| '',
    };
    SettingsManager.save(settings);
    settingsModal?.classList.remove('active');
    this.notify('Settings saved successfully', 'success');
  },

  updateProviderDefaults() {
    const provider = this.elements.providerSelect?.value;
    const cfg = SettingsManager.getProviderConfig(provider);
    if (this.elements.modelInput   && !this.elements.modelInput.value)   this.elements.modelInput.value = cfg.model;
    if (this.elements.baseUrlInput && !this.elements.baseUrlInput.value) this.elements.baseUrlInput.value = cfg.baseUrl;
  },

  notify(message, type = 'info') {
    const container = this.elements.notificationContainer;
    if (!container) return;
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.innerHTML = `<span class="notif-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(n);
    requestAnimationFrame(() => n.classList.add('show'));
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 400); }, 3000);
  },

  setPhase(label, progress) {
    if (this.elements.phaseLabel)   this.elements.phaseLabel.textContent = label;
    if (this.elements.progressBar)  this.elements.progressBar.style.width = `${progress}%`;
    if (this.elements.progressText) this.elements.progressText.textContent = `${progress}%`;
  },

  setCardStatus(card, status) {
    if (!card) return;
    const statusEl = card.querySelector('.card-status');
    const loaderEl = card.querySelector('.card-loader');
    card.classList.remove('pending','running','complete','error');
    card.classList.add(status);
    if (statusEl) {
      statusEl.textContent = status === 'running' ? 'Analyzing...' : status === 'complete' ? 'Complete' : status === 'error' ? 'Error' : 'Pending';
    }
    if (loaderEl) loaderEl.style.display = status === 'running' ? 'block' : 'none';
  },

  updateFundamentalsCard(data) {
    const card = this.elements.fundamentalsCard;
    if (!card) return;
    this.setCardStatus(card, 'complete');
    const metricsHtml = Object.entries(data.metrics).map(([k, v]) =>
      `<div class="metric-row"><span class="metric-label">${k}</span><span class="metric-value">${v}</span></div>`
    ).join('');
    card.querySelector('.card-body').innerHTML = `
      <div class="score-row">
        <div class="score-item bullish"><span class="score-num">${data.bullScore}</span><span class="score-lbl">Bullish</span></div>
        <div class="score-divider"></div>
        <div class="score-item bearish"><span class="score-num">${data.bearScore}</span><span class="score-lbl">Bearish</span></div>
      </div>
      <div class="score-bar-wrap"><div class="score-bar-inner" style="width:${data.bullScore}%"></div></div>
      <div class="metrics-grid">${metricsHtml}</div>
      <p class="card-summary">${data.summary}</p>
    `;
  },

  updateSentimentCard(data) {
    const card = this.elements.sentimentCard;
    if (!card) return;
    this.setCardStatus(card, 'complete');
    const fgColor = data.fearGreed > 60 ? '#ff6b6b' : data.fearGreed < 40 ? '#00d4aa' : '#f0b429';
    card.querySelector('.card-body').innerHTML = `
      <div class="score-row">
        <div class="score-item bullish"><span class="score-num">${data.positive}%</span><span class="score-lbl">Positive</span></div>
        <div class="score-divider"></div>
        <div class="score-item bearish"><span class="score-num">${data.negative}%</span><span class="score-lbl">Negative</span></div>
      </div>
      <div class="fg-meter">
        <div class="fg-label">Fear &amp; Greed Index</div>
        <div class="fg-bar-wrap"><div class="fg-bar-inner" style="width:${data.fearGreed}%; background:${fgColor}"></div></div>
        <div class="fg-value" style="color:${fgColor}">${data.fearGreed} — ${data.fgLabel}</div>
      </div>
      <div class="tag-row"><span class="tag">Social Volume: ${data.socialVolume}</span></div>
      <p class="card-summary">${data.summary}</p>
    `;
  },

  updateTechnicalCard(data) {
    const card = this.elements.technicalCard;
    if (!card) return;
    this.setCardStatus(card, 'complete');
    const rsiColor = data.rsi > 70 ? '#ff6b6b' : data.rsi < 30 ? '#00d4aa' : '#f0b429';
    const biasColor = data.bias === 'Bullish' ? '#00d4aa' : data.bias === 'Bearish' ? '#ff6b6b' : '#f0b429';
    card.querySelector('.card-body').innerHTML = `
      <div class="score-row">
        <div class="score-item" style="color:${biasColor}"><span class="score-num">${data.bias}</span><span class="score-lbl">Bias</span></div>
        <div class="score-divider"></div>
        <div class="score-item"><span class="score-num">${data.strength}%</span><span class="score-lbl">Strength</span></div>
      </div>
      <div class="metrics-grid">
        <div class="metric-row"><span class="metric-label">Trend</span><span class="metric-value">${data.trend}</span></div>
        <div class="metric-row"><span class="metric-label">RSI</span><span class="metric-value" style="color:${rsiColor}">${data.rsi}</span></div>
        <div class="metric-row"><span class="metric-label">MACD</span><span class="metric-value" style="color:${data.macd>=0?'#00d4aa':'#ff6b6b'}">${data.macd>=0?'+':''}${data.macd}</span></div>
        <div class="metric-row"><span class="metric-label">MA 50</span><span class="metric-value">$${data.ma50}</span></div>
        <div class="metric-row"><span class="metric-label">Support</span><span class="metric-value">$${data.support1}</span></div>
        <div class="metric-row"><span class="metric-label">Resistance</span><span class="metric-value">$${data.resist1}</span></div>
      </div>
      <p class="card-summary">${data.summary}</p>
    `;
  },

  updateNewsCard(data) {
    const card = this.elements.newsCard;
    if (!card) return;
    this.setCardStatus(card, 'complete');
    const impactColor = data.impact > 70 ? '#ff6b6b' : data.impact > 45 ? '#f0b429' : '#00d4aa';
    const headlinesHtml = data.headlines.map(h => `<li class="news-item">▸ ${h}</li>`).join('');
    card.querySelector('.card-body').innerHTML = `
      <div class="score-row">
        <div class="score-item"><span class="score-num" style="color:${impactColor}">${data.impact}</span><span class="score-lbl">${data.impactLabel}</span></div>
        <div class="score-divider"></div>
        <div class="score-item"><span class="score-num" style="color:#f0b429">${data.riskLevel}</span><span class="score-lbl">Risk Level</span></div>
      </div>
      <ul class="news-list">${headlinesHtml}</ul>
      <p class="card-summary">${data.summary}</p>
    `;
  },

  updateBullishPanel(data) {
    const panel = this.elements.bullishPanel;
    if (!panel) return;
    const reasonsHtml = data.reasons.map(r => `<li>✓ ${r}</li>`).join('');
    panel.innerHTML = `
      <div class="debate-header bullish-header">
        <span class="debate-icon">📈</span>
        <span>BULLISH CASE</span>
        <span class="confidence-badge bullish-badge">${data.confidence}% Confidence</span>
      </div>
      <div class="upside-display">Potential Upside: <strong>+${data.upside}%</strong></div>
      <ul class="reason-list bullish-list">${reasonsHtml}</ul>
      <p class="thesis-text">${data.thesis}</p>
    `;
  },

  updateBearishPanel(data) {
    const panel = this.elements.bearishPanel;
    if (!panel) return;
    const reasonsHtml = data.reasons.map(r => `<li>✗ ${r}</li>`).join('');
    panel.innerHTML = `
      <div class="debate-header bearish-header">
        <span class="debate-icon">📉</span>
        <span>BEARISH CASE</span>
        <span class="confidence-badge bearish-badge">${data.confidence}% Confidence</span>
      </div>
      <div class="downside-display">Potential Downside: <strong>-${data.downside}%</strong></div>
      <ul class="reason-list bearish-list">${reasonsHtml}</ul>
      <p class="thesis-text">${data.thesis}</p>
    `;
  },

  updateTraderPanel(data) {
    const panel = this.elements.traderPanel;
    if (!panel) return;
    const actionClass = data.action === 'BUY' ? 'action-buy' : data.action === 'SELL' ? 'action-sell' : 'action-hold';
    const bars = Math.round(data.confidence / 10);
    const meterHtml = Array.from({length:10}, (_,i) => `<div class="meter-bar ${i < bars ? 'meter-active' : ''}"></div>`).join('');
    panel.innerHTML = `
      <div class="trader-action ${actionClass}">${data.action}</div>
      <div class="trade-levels">
        <div class="level-item"><span class="level-label">ENTRY</span><span class="level-value">$${data.entry}</span></div>
        <div class="level-item"><span class="level-label">TARGET</span><span class="level-value target-val">$${data.target}</span></div>
        <div class="level-item"><span class="level-label">STOP LOSS</span><span class="level-value stop-val">$${data.stop}</span></div>
      </div>
      <div class="confidence-section">
        <div class="conf-label">Trade Confidence: ${data.confidence}%</div>
        <div class="conf-meter">${meterHtml}</div>
      </div>
      <div class="timeframe-tag">⏱ ${data.timeframe}</div>
      <p class="card-summary">${data.rationale}</p>
    `;
  },

  updateRiskPanel(data) {
    const panel = this.elements.riskPanel;
    if (!panel) return;
    const approvalClass = data.approval === 'APPROVED' ? 'approved' : data.approval === 'REJECTED' ? 'rejected' : 'review';
    const approvalIcon  = data.approval === 'APPROVED' ? '✓' : data.approval === 'REJECTED' ? '✕' : '⚠';
    panel.innerHTML = `
      <div class="approval-badge ${approvalClass}">${approvalIcon} ${data.approval}</div>
      <div class="risk-metrics">
        <div class="risk-metric"><span class="rm-label">Risk/Reward</span><span class="rm-value">${data.rrRatio}:1</span></div>
        <div class="risk-metric"><span class="rm-label">Position Size</span><span class="rm-value">${data.positionSize}%</span></div>
        <div class="risk-metric"><span class="rm-label">Max Drawdown</span><span class="rm-value risk-val">-${data.maxDrawdown}%</span></div>
        <div class="risk-metric"><span class="rm-label">Exposure Level</span><span class="rm-value">${data.exposure}</span></div>
      </div>
      <p class="card-summary">${data.notes}</p>
    `;
  },

  updatePortfolioPanel(data) {
    const panel = this.elements.portfolioPanel;
    if (!panel) return;
    const finalClass = data.finalDecision === 'BUY' ? 'final-buy' : data.finalDecision === 'SELL' ? 'final-sell' : 'final-hold';
    const emoji = data.finalDecision === 'BUY' ? '🚀' : data.finalDecision === 'SELL' ? '🔻' : '⏸';
    const confColor = data.overallConfidence > 65 ? '#00d4aa' : data.overallConfidence > 45 ? '#f0b429' : '#ff6b6b';
    panel.innerHTML = `
      <div class="final-verdict ${finalClass}">
        <span class="verdict-emoji">${emoji}</span>
        <span class="verdict-text">${data.finalDecision}</span>
      </div>
      <div class="portfolio-stats">
        <div class="ps-item">
          <span class="ps-label">Overall Confidence</span>
          <span class="ps-value" style="color:${confColor}">${data.overallConfidence}%</span>
        </div>
        <div class="ps-item">
          <span class="ps-label">Portfolio Allocation</span>
          <span class="ps-value">${data.allocation}%</span>
        </div>
      </div>
      <div class="alloc-bar-wrap"><div class="alloc-bar-inner" style="width:${Math.min(data.allocation*10, 100)}%"></div></div>
      <p class="pm-summary">${data.summary}</p>
    `;
  },

  renderWatchlist() {
    const container = this.elements.watchlistContainer;
    if (!container) return;
    const list = WatchlistManager.getAll();
    if (!list.length) { container.innerHTML = '<p class="empty-state">No symbols saved</p>'; return; }
    container.innerHTML = list.map(s => `
      <div class="watchlist-item">
        <button class="wl-symbol" onclick="App.analyzeSymbol('${s}')">${s}</button>
        <button class="wl-remove" onclick="WatchlistManager.remove('${s}'); UI.renderWatchlist();">✕</button>
      </div>
    `).join('');
  },

  renderHistory() {
    const container = this.elements.historyContainer;
    if (!container) return;
    const history = HistoryManager.getAll();
    if (!history.length) { container.innerHTML = '<p class="empty-state">No analysis history</p>'; return; }
    container.innerHTML = history.slice(0, 10).map(h => `
      <div class="history-item" onclick="App.analyzeSymbol('${h.symbol}')">
        <span class="hi-symbol">${h.symbol}</span>
        <span class="hi-action ${h.decision === 'BUY' ? 'action-buy-sm' : h.decision === 'SELL' ? 'action-sell-sm' : 'action-hold-sm'}">${h.decision}</span>
        <span class="hi-date">${new Date(h.date).toLocaleDateString()}</span>
      </div>
    `).join('');
  },

  showLoading(show) {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    if (this.elements.analyzeBtn) {
      this.elements.analyzeBtn.disabled = show;
      this.elements.analyzeBtn.textContent = show ? 'Analyzing...' : 'Analyze';
    }
  },

  resetAllCards() {
    ['fundamentalsCard','sentimentCard','technicalCard','newsCard'].forEach(id => {
      const card = this.elements[id];
      if (card) {
        this.setCardStatus(card, 'pending');
        const body = card.querySelector('.card-body');
        if (body) body.innerHTML = '<div class="pending-placeholder">Awaiting analysis...</div>';
      }
    });
    ['bullishPanel','bearishPanel','traderPanel','riskPanel','portfolioPanel'].forEach(id => {
      const el = this.elements[id];
      if (el) el.innerHTML = '<div class="pending-placeholder">Awaiting data...</div>';
    });
  },

  exportJSON() {
    if (!App.lastAnalysis) { this.notify('Run an analysis first', 'error'); return; }
    const blob = new Blob([JSON.stringify(App.lastAnalysis, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tradefirm-${App.lastAnalysis.symbol}-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    this.notify('Analysis exported as JSON', 'success');
  },

  exportPDF() {
    if (!App.lastAnalysis) { this.notify('Run an analysis first', 'error'); return; }
    const d = App.lastAnalysis;
    const html = `<!DOCTYPE html><html><head><title>Kamote Trading AI – ${d.symbol}</title>
    <style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#111}
    h1{color:#0a0e1a}h2{border-bottom:2px solid #00d4aa;padding-bottom:4px;color:#0a0e1a}
    .verdict{font-size:2em;font-weight:bold;color:${d.portfolio.finalDecision==='BUY'?'green':d.portfolio.finalDecision==='SELL'?'red':'orange'}}
    table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f0f0f0}
    </style></head><body>
    <h1>Kamote Trading AI – Analysis Report</h1>
    <p><strong>Symbol:</strong> ${d.symbol} | <strong>Date:</strong> ${new Date(d.date).toLocaleString()}</p>
    <h2>Final Decision</h2><div class="verdict">${d.portfolio.finalDecision}</div>
    <p><strong>Confidence:</strong> ${d.portfolio.overallConfidence}% | <strong>Allocation:</strong> ${d.portfolio.allocation}%</p>
    <p>${d.portfolio.summary}</p>
    <h2>Analyst Scores</h2>
    <table><tr><th>Analyst</th><th>Key Metric</th><th>Score</th></tr>
    <tr><td>Fundamentals</td><td>Bullish Score</td><td>${d.fundamentals.bullScore}</td></tr>
    <tr><td>Sentiment</td><td>Positive %</td><td>${d.sentiment.positive}%</td></tr>
    <tr><td>Technical</td><td>Bias</td><td>${d.technical.bias} (${d.technical.strength}%)</td></tr>
    <tr><td>News</td><td>Impact</td><td>${d.news.impact} – ${d.news.impactLabel}</td></tr>
    </table>
    <h2>Trade Parameters</h2>
    <table><tr><th>Entry</th><th>Target</th><th>Stop Loss</th><th>Confidence</th></tr>
    <tr><td>$${d.trader.entry}</td><td>$${d.trader.target}</td><td>$${d.trader.stop}</td><td>${d.trader.confidence}%</td></tr>
    </table>
    <h2>Risk Assessment</h2>
    <p><strong>Approval:</strong> ${d.risk.approval} | <strong>R/R Ratio:</strong> ${d.risk.rrRatio}:1 | <strong>Position Size:</strong> ${d.risk.positionSize}%</p>
    <p>${d.risk.notes}</p>
    <h2>Research</h2>
    <p><strong>Bullish Thesis:</strong> ${d.bullish.thesis}</p>
    <p><strong>Bearish Thesis:</strong> ${d.bearish.thesis}</p>
    <hr><p style="font-size:0.8em;color:#888">Generated by Kamote Trading AI v${APP_VERSION}. This is a simulation for educational purposes only. Not financial advice.</p>
    </body></html>`;
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tradefirm-${d.symbol}-${Date.now()}.html`;
    a.click(); URL.revokeObjectURL(url);
    this.notify('Report exported (open in browser to print as PDF)', 'success');
  },

  registerPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('[App] SW registered', reg.scope);
      }).catch(err => console.warn('[App] SW registration failed', err));
    }
    // Install prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      if (this.elements.installPwaBtn) this.elements.installPwaBtn.style.display = 'flex';
    });
    window._deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => { window._deferredPrompt = e; });
  },

  installPWA() {
    const prompt = window._deferredPrompt;
    if (prompt) { prompt.prompt(); prompt.userChoice.then(() => { window._deferredPrompt = null; }); }
    else this.notify('Install: use browser menu → "Add to Home Screen"', 'info');
  },

  async startAnalysis() {
    await App.runAnalysis();
  }
};

// ─── Main App ─────────────────────────────────────────────────────────────────

const App = {
  lastAnalysis: null,

  async analyzeSymbol(symbol) {
    if (UI.elements.assetInput) UI.elements.assetInput.value = symbol;
    await this.runAnalysis();
  },

  async runAnalysis() {
    const input = UI.elements.assetInput?.value.trim().toUpperCase();
    if (!input) { UI.notify('Please enter a symbol', 'error'); return; }

    const symbol = input;
    const assetType = SimulationEngine.classifyAsset(symbol);
    const settings  = SettingsManager.get();
    const basePrice = SimulationEngine.generatePrice(symbol, assetType);

    if (UI.elements.currentSymbolDisplay) UI.elements.currentSymbolDisplay.textContent = symbol;

    UI.showLoading(true);
    UI.resetAllCards();

    // Scroll to results
    document.getElementById('resultsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      // ── PHASE 1: Analyst Team ────────────────────────────────────────────
      UI.setPhase('Phase 1 — Analyst Team', 5);

      UI.setCardStatus(UI.elements.fundamentalsCard, 'running');
      UI.setCardStatus(UI.elements.sentimentCard, 'running');
      UI.setCardStatus(UI.elements.technicalCard, 'running');
      UI.setCardStatus(UI.elements.newsCard, 'running');

      const [fundamentals, sentiment, technical, news] = await Promise.all([
        SimulationEngine.runFundamentalsAnalyst(symbol, assetType),
        SimulationEngine.runSentimentAnalyst(symbol, assetType),
        SimulationEngine.runTechnicalAnalyst(symbol, basePrice),
        SimulationEngine.runNewsAnalyst(symbol, assetType),
      ]);

      UI.updateFundamentalsCard(fundamentals);
      UI.updateSentimentCard(sentiment);
      UI.updateTechnicalCard(technical);
      UI.updateNewsCard(news);
      UI.setPhase('Phase 1 — Complete', 25);
      UI.notify('Analyst team reports ready', 'success');

      // ── PHASE 2: Research Debate ─────────────────────────────────────────
      UI.setPhase('Phase 2 — Research Debate', 30);
      const analystData = { fundamentals, sentiment, technical, news };
      const [bullish, bearish] = await Promise.all([
        SimulationEngine.runBullishResearch(symbol, analystData),
        SimulationEngine.runBearishResearch(symbol, analystData),
      ]);
      UI.updateBullishPanel(bullish);
      UI.updateBearishPanel(bearish);
      UI.setPhase('Phase 2 — Complete', 50);
      UI.notify('Research debate concluded', 'success');

      // ── PHASE 3: Trader ──────────────────────────────────────────────────
      UI.setPhase('Phase 3 — Trader Decision', 55);
      const trader = await SimulationEngine.runTraderAgent(symbol, basePrice, bullish, bearish, technical);
      UI.updateTraderPanel(trader);
      UI.setPhase('Phase 3 — Complete', 68);
      UI.notify(`Trader signal: ${trader.action}`, trader.action === 'BUY' ? 'success' : trader.action === 'SELL' ? 'error' : 'info');

      // ── PHASE 4: Risk Manager ─────────────────────────────────────────────
      UI.setPhase('Phase 4 — Risk Review', 72);
      const risk = await SimulationEngine.runRiskManager(trader, basePrice);
      UI.updateRiskPanel(risk);
      UI.setPhase('Phase 4 — Complete', 85);
      UI.notify(`Risk assessment: ${risk.approval}`, risk.approval === 'APPROVED' ? 'success' : risk.approval === 'REJECTED' ? 'error' : 'info');

      // ── PHASE 5: Portfolio Manager ────────────────────────────────────────
      UI.setPhase('Phase 5 — Portfolio Decision', 90);
      const portfolio = await SimulationEngine.runPortfolioManager(symbol, trader, risk, bullish, bearish);
      UI.updatePortfolioPanel(portfolio);
      UI.setPhase('Analysis Complete', 100);
      UI.notify(`Final decision: ${portfolio.finalDecision}`, 'success');

      // ── Save ──────────────────────────────────────────────────────────────
      const analysis = { symbol, assetType, basePrice, date: new Date().toISOString(), fundamentals, sentiment, technical, news, bullish, bearish, trader, risk, portfolio, decision: portfolio.finalDecision };
      this.lastAnalysis = analysis;
      HistoryManager.add({ symbol, decision: portfolio.finalDecision, confidence: portfolio.overallConfidence });
      UI.renderHistory();

      // Auto-add to watchlist
      WatchlistManager.add(symbol);
      UI.renderWatchlist();

    } catch (err) {
      console.error('[App] Analysis error:', err);
      UI.notify('Analysis encountered an error. Running simulation fallback.', 'error');
    } finally {
      setTimeout(() => UI.showLoading(false), 500);
    }
  }
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  UI.init();
  console.log(`[Kamote Trading AI] v${APP_VERSION} initialized`);
});

// Expose for inline handlers
window.App = App;
window.WatchlistManager = WatchlistManager;
window.UI = UI;
