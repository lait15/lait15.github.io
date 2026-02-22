/**
 * app.js - メインアプリケーション
 * CEX/オンチェーン価格乖離モニター
 */

const App = {
  chart: null,
  priceHistory: {}, // { pairId: [{ time, cexPrice, onchainPrice, gap }] }
  alerts: [],
  intervalHandle: null,

  // ---------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------
  init() {
    this.loadSettings();
    this.renderPriceCards();
    this.initChart();
    this.bindEvents();
    this.startMonitoring();
  },

  // ---------------------------------------------------------------
  // 設定の保存・ロード
  // ---------------------------------------------------------------
  loadSettings() {
    try {
      const raw = localStorage.getItem('cryptoMonitorSettings');
      if (!raw) return;
      const s = JSON.parse(raw);
      CONFIG.alertThreshold = s.threshold ?? CONFIG.alertThreshold;
      CONFIG.interval = s.interval ?? CONFIG.interval;
      if (s.notifications) Object.assign(CONFIG.notifications, s.notifications);
    } catch (_) {}

    document.getElementById('threshold').value = CONFIG.alertThreshold;
    document.getElementById('interval').value = CONFIG.interval;
    document.getElementById('discord-webhook').value = CONFIG.notifications.discordWebhook;
    document.getElementById('telegram-token').value = CONFIG.notifications.telegramToken;
    document.getElementById('telegram-chatid').value = CONFIG.notifications.telegramChatId;

    if (CONFIG.notifications.browser && Notification.permission === 'granted') {
      this._setBrowserBtnActive();
    }
  },

  saveSettings() {
    CONFIG.alertThreshold = parseFloat(document.getElementById('threshold').value) || 1.0;
    CONFIG.interval = parseInt(document.getElementById('interval').value, 10) || 30;
    CONFIG.notifications.discordWebhook = document.getElementById('discord-webhook').value.trim();
    CONFIG.notifications.telegramToken = document.getElementById('telegram-token').value.trim();
    CONFIG.notifications.telegramChatId = document.getElementById('telegram-chatid').value.trim();

    localStorage.setItem(
      'cryptoMonitorSettings',
      JSON.stringify({
        threshold: CONFIG.alertThreshold,
        interval: CONFIG.interval,
        notifications: CONFIG.notifications,
      })
    );

    // 閾値ラインをチャートに反映
    this.updateChartThresholdLines();

    // 更新間隔を再起動
    this.stopMonitoring();
    this.startMonitoring();

    this.showToast('設定を保存しました');
  },

  // ---------------------------------------------------------------
  // 価格カードのレンダリング
  // ---------------------------------------------------------------
  renderPriceCards() {
    CONFIG.pairs.forEach((pair) => {
      this.priceHistory[pair.id] = [];
    });

    const container = document.getElementById('price-cards');
    container.innerHTML = CONFIG.pairs
      .map(
        (pair) => `
      <div class="price-card loading" id="card-${pair.id}">
        <div class="price-card-header">
          <span class="pair-symbol">${pair.symbol}</span>
          <span class="gap-badge low" id="badge-${pair.id}">読込中</span>
        </div>
        <div class="price-row">
          <span class="price-label">CEX — ${pair.cex.name}</span>
          <span class="price-value" id="cex-${pair.id}">—</span>
        </div>
        <div class="price-row">
          <span class="price-label">オンチェーン — ${pair.onchain.name}</span>
          <span class="price-value" id="dex-${pair.id}">—</span>
        </div>
        <div class="price-row">
          <span class="price-label">乖離率</span>
          <span class="price-value gap-value" id="gap-${pair.id}">—</span>
        </div>
        <div class="gap-bar-container">
          <div class="gap-bar">
            <div class="gap-bar-fill" id="bar-${pair.id}"></div>
          </div>
          <div class="gap-bar-labels">
            <span>0%</span>
            <span id="threshold-label-${pair.id}">閾値 ${CONFIG.alertThreshold}%</span>
          </div>
        </div>
        <div class="direction-row" id="dir-${pair.id}"></div>
      </div>`
      )
      .join('');
  },

  updateCard(pair, cexPrice, onchainPrice, gapPercent) {
    const level = Detector.getAlertLevel(gapPercent, CONFIG.alertThreshold);
    const color = Detector.getColor(level);
    const sign = gapPercent >= 0 ? '+' : '';
    const barWidth = Math.min((Math.abs(gapPercent) / (CONFIG.alertThreshold * 3)) * 100, 100);

    const card = document.getElementById(`card-${pair.id}`);
    card.classList.remove('loading', 'alert-pulse');
    if (level !== 'low') card.classList.add('alert-pulse');

    const badge = document.getElementById(`badge-${pair.id}`);
    badge.className = `gap-badge ${level}`;
    badge.textContent = `${sign}${gapPercent.toFixed(3)}%`;

    const fmt = (v) =>
      v == null
        ? 'エラー'
        : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

    document.getElementById(`cex-${pair.id}`).textContent = fmt(cexPrice);
    document.getElementById(`dex-${pair.id}`).textContent = fmt(onchainPrice);

    const gapEl = document.getElementById(`gap-${pair.id}`);
    gapEl.textContent = `${sign}${gapPercent.toFixed(4)}%`;
    gapEl.style.color = color;

    const bar = document.getElementById(`bar-${pair.id}`);
    bar.style.width = `${barWidth}%`;
    bar.style.background = color;

    document.getElementById(`threshold-label-${pair.id}`).textContent =
      `閾値 ${CONFIG.alertThreshold}%`;

    const dirEl = document.getElementById(`dir-${pair.id}`);
    if (level !== 'low') {
      const arrow = gapPercent > 0 ? '▲ DEX &gt; CEX' : '▼ CEX &gt; DEX';
      const tip =
        gapPercent > 0
          ? '裁定機会: CEXで買い → DEXで売り'
          : '裁定機会: DEXで買い → CEXで売り';
      dirEl.innerHTML = `<span style="color:${color}">${arrow}</span><span class="dir-tip">${tip}</span>`;
    } else {
      dirEl.innerHTML = '';
    }
  },

  updateCardError(pair, errorMsg) {
    ['cex', 'dex', 'gap'].forEach((prefix) => {
      const el = document.getElementById(`${prefix}-${pair.id}`);
      if (el) el.textContent = 'エラー';
    });
    const badge = document.getElementById(`badge-${pair.id}`);
    if (badge) { badge.className = 'gap-badge high'; badge.textContent = 'ERR'; }
    console.warn(`[${pair.symbol}] ${errorMsg}`);
  },

  // ---------------------------------------------------------------
  // Chart.js 乖離率チャート
  // ---------------------------------------------------------------
  initChart() {
    const select = document.getElementById('chart-pair-select');
    select.innerHTML = CONFIG.pairs
      .map((p) => `<option value="${p.id}">${p.symbol}</option>`)
      .join('');

    const ctx = document.getElementById('gap-chart').getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: '乖離率 (%)',
            data: [],
            borderColor: '#7c6eff',
            backgroundColor: 'rgba(124,110,255,0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
          {
            label: `+閾値 (${CONFIG.alertThreshold}%)`,
            data: [],
            borderColor: 'rgba(255,77,109,0.6)',
            borderWidth: 1,
            borderDash: [6, 4],
            fill: false,
            pointRadius: 0,
          },
          {
            label: `-閾値 (-${CONFIG.alertThreshold}%)`,
            data: [],
            borderColor: 'rgba(255,77,109,0.6)',
            borderWidth: 1,
            borderDash: [6, 4],
            fill: false,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ticks: { color: '#888', maxTicksLimit: 10, maxRotation: 0 },
            grid: { color: '#2a2a3a' },
          },
          y: {
            ticks: {
              color: '#888',
              callback: (v) => v.toFixed(2) + '%',
            },
            grid: { color: '#2a2a3a' },
          },
        },
        plugins: {
          legend: {
            labels: { color: '#aaa', font: { size: 11 }, boxWidth: 16 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)}%`,
            },
          },
        },
      },
    });

    select.addEventListener('change', () => this.refreshChart());
  },

  refreshChart() {
    const pairId = document.getElementById('chart-pair-select').value;
    const history = this.priceHistory[pairId] || [];

    this.chart.data.labels = history.map((h) => h.time);
    this.chart.data.datasets[0].data = history.map((h) => h.gap);
    this.chart.data.datasets[1].data = history.map(() => CONFIG.alertThreshold);
    this.chart.data.datasets[2].data = history.map(() => -CONFIG.alertThreshold);
    this.chart.update();
  },

  updateChartThresholdLines() {
    const pairId = document.getElementById('chart-pair-select').value;
    const history = this.priceHistory[pairId] || [];
    this.chart.data.datasets[1].label = `+閾値 (${CONFIG.alertThreshold}%)`;
    this.chart.data.datasets[2].label = `-閾値 (-${CONFIG.alertThreshold}%)`;
    this.chart.data.datasets[1].data = history.map(() => CONFIG.alertThreshold);
    this.chart.data.datasets[2].data = history.map(() => -CONFIG.alertThreshold);
    this.chart.update();
  },

  // ---------------------------------------------------------------
  // アラート履歴
  // ---------------------------------------------------------------
  addAlert(pair, cexPrice, onchainPrice, gapPercent) {
    const sign = gapPercent >= 0 ? '+' : '';
    this.alerts.unshift({
      time: new Date().toLocaleTimeString('ja-JP'),
      symbol: pair.symbol,
      cexPrice,
      onchainPrice,
      gapPercent,
      sign,
    });
    if (this.alerts.length > CONFIG.maxAlerts) this.alerts.length = CONFIG.maxAlerts;
    this.renderAlerts();
  },

  renderAlerts() {
    const container = document.getElementById('alert-list');
    if (this.alerts.length === 0) {
      container.innerHTML = '<p class="no-alerts">アラートはまだありません</p>';
      return;
    }
    container.innerHTML = this.alerts
      .map(
        (a) => `
      <div class="alert-item">
        <span class="alert-time">${a.time}</span>
        <span class="alert-symbol">${a.symbol}</span>
        <span class="alert-prices">
          CEX $${a.cexPrice.toFixed(2)} / DEX $${a.onchainPrice.toFixed(2)}
        </span>
        <span class="alert-gap" style="color:${a.gapPercent >= 0 ? '#ff4d6d' : '#ffba00'}">
          ${a.sign}${a.gapPercent.toFixed(3)}%
        </span>
      </div>`
      )
      .join('');
  },

  // ---------------------------------------------------------------
  // メイン更新ループ
  // ---------------------------------------------------------------
  async fetchAndUpdate() {
    const statusEl = document.getElementById('status-text');
    const lastEl = document.getElementById('last-update');
    statusEl.innerHTML = '<span class="spinner"></span> 更新中…';

    let anyError = false;

    const results = await API.fetchAllPrices();

    for (const result of results) {
      const { pair, cexPrice, onchainPrice, cexError, onchainError } = result;

      if (cexPrice == null || onchainPrice == null) {
        this.updateCardError(pair, cexError || onchainError || '取得失敗');
        anyError = true;
        continue;
      }

      const gapPercent = Detector.calculateGap(cexPrice, onchainPrice);
      this.updateCard(pair, cexPrice, onchainPrice, gapPercent);

      // 履歴に追加
      const hist = this.priceHistory[pair.id];
      hist.push({
        time: new Date().toLocaleTimeString('ja-JP'),
        cexPrice,
        onchainPrice,
        gap: gapPercent,
      });
      if (hist.length > CONFIG.maxHistoryPoints) hist.shift();

      // アラート判定
      if (Detector.isAlert(gapPercent, CONFIG.alertThreshold)) {
        this.addAlert(pair, cexPrice, onchainPrice, gapPercent);
        // クールダウン内ならプッシュ通知は送らない
        if (Detector.shouldNotify(pair.id)) {
          await Notifier.notify(pair, cexPrice, onchainPrice, gapPercent);
        }
      }
    }

    this.refreshChart();

    statusEl.textContent = anyError ? '⚠ 一部データ取得エラー' : '● 監視中';
    lastEl.textContent = `最終更新: ${new Date().toLocaleTimeString('ja-JP')}`;
  },

  startMonitoring() {
    this.fetchAndUpdate();
    this.intervalHandle = setInterval(() => this.fetchAndUpdate(), CONFIG.interval * 1000);
  },

  stopMonitoring() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  },

  // ---------------------------------------------------------------
  // UI イベント
  // ---------------------------------------------------------------
  bindEvents() {
    document.getElementById('save-btn').addEventListener('click', () => this.saveSettings());
    document.getElementById('refresh-btn').addEventListener('click', () => this.fetchAndUpdate());
    document.getElementById('clear-alerts-btn').addEventListener('click', () => {
      this.alerts = [];
      this.renderAlerts();
    });

    document.getElementById('notif-btn').addEventListener('click', async () => {
      const granted = await Notifier.requestBrowserPermission();
      CONFIG.notifications.browser = granted;
      if (granted) this._setBrowserBtnActive();
      else this.showToast('ブラウザ通知が拒否されました');
    });
  },

  _setBrowserBtnActive() {
    const btn = document.getElementById('notif-btn');
    btn.textContent = '通知: ON ✓';
    btn.style.background = '#00d97e';
  },

  // ---------------------------------------------------------------
  // トースト
  // ---------------------------------------------------------------
  showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
