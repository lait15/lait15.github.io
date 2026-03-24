/**
 * app.js
 * メインアプリケーション
 * 各ソースからデータを取得 → UI描画 → アクション生成
 */

const App = {

  data: {
    fng:      null,
    reddit:   [],
    github:   [],
    trending: [],
    onchain:  null,
  },

  async init() {
    document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
    await this.refresh();
  },

  async refresh() {
    this._setStatus('loading');

    // 全ソースを並列取得
    const [fng, reddit, github, trending, onchain] = await Promise.all([
      this._fetch('fng',      () => Sources.fetchFearAndGreed()),
      this._fetch('reddit',   () => Sources.fetchReddit()),
      this._fetch('github',   () => Sources.fetchGitHub()),
      this._fetch('trending', () => Sources.fetchTrending()),
      this._fetch('onchain',  () => Sources.fetchOnchain()),
    ]);

    this.data = { fng, reddit, github, trending, onchain };

    // UI描画
    this._renderFng(fng);
    this._renderReddit(reddit);
    this._renderGitHub(github);
    this._renderTrending(trending);
    this._renderOnchain(onchain);
    this._renderOfficialLinks();
    this._renderActions();

    this._setStatus('ok');
    document.getElementById('last-update').textContent =
      `最終更新: ${new Date().toLocaleTimeString('ja-JP')}`;
  },

  /* -------------------------------------------------------
   * 汎用フェッチ + ステータス更新
   */
  async _fetch(key, fn) {
    this._setSourceStatus(key, 'loading');
    try {
      const result = await fn();
      this._setSourceStatus(key, 'ok');
      return result;
    } catch (e) {
      console.error(`[App] ${key} fetch error:`, e);
      this._setSourceStatus(key, 'error');
      return (key === 'fng' || key === 'onchain') ? null : [];
    }
  },

  _setSourceStatus(key, state) {
    const el = document.getElementById(`${key}-fetch-status`);
    if (!el) return;
    const labels = { loading: '取得中…', ok: '取得完了', error: '取得失敗' };
    el.innerHTML = `<span class="dot dot-${state}"></span><span>${labels[state]}</span>`;
  },

  _setStatus(state) {
    const el = document.getElementById('status-text');
    if (state === 'loading') {
      el.innerHTML = '<span class="spinner"></span>更新中…';
    } else if (state === 'ok') {
      el.textContent = '● 監視中';
    } else {
      el.textContent = '⚠ 一部エラー';
    }
  },

  /* -------------------------------------------------------
   * Fear & Greed 描画
   */
  _renderFng(fng) {
    const container = document.getElementById('fng-feed');
    if (!fng) {
      container.innerHTML = '<p class="error-msg">取得失敗。alternative.me API を後ほど再試行してください。</p>';
      return;
    }

    const v = fng.value;
    const diff = v - fng.valueYesterday;
    const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;

    // 色決定
    let color, textColor;
    if (v <= 25)       { color = '#ff4d6d'; textColor = '#ff4d6d'; }
    else if (v <= 45)  { color = '#ff8c42'; textColor = '#ff8c42'; }
    else if (v <= 55)  { color = '#ffba00'; textColor = '#ffba00'; }
    else if (v <= 75)  { color = '#7bc67e'; textColor = '#7bc67e'; }
    else               { color = '#00d97e'; textColor = '#00d97e'; }

    // 弧の長さ計算（全周 ~251px）
    const arcLen = (v / 100) * 251;

    const arc = document.getElementById('fng-arc');
    if (arc) {
      arc.setAttribute('stroke-dasharray', `${arcLen} 251`);
      arc.setAttribute('stroke', color);
    }
    const numEl = document.getElementById('fng-num');
    if (numEl) { numEl.textContent = v; numEl.setAttribute('fill', textColor); }
    const tagEl = document.getElementById('fng-tag');
    if (tagEl) tagEl.textContent = fng.classification;

    // テキスト詳細
    const desc = this._fngDescription(v);
    container.innerHTML = `
      <div class="fng-display">
        <div class="fng-gauge">
          <svg viewBox="0 0 200 110">
            <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="#2a2a3e" stroke-width="16" stroke-linecap="round"/>
            <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round"
              stroke-dasharray="${arcLen} 251"/>
            <text x="100" y="88" text-anchor="middle" font-size="30" font-weight="700" fill="${textColor}">${v}</text>
            <text x="100" y="106" text-anchor="middle" font-size="11" fill="#6e7191">${fng.classification}</text>
          </svg>
          <div class="fng-legend">
            <span style="color:#ff4d6d">0 恐怖</span>
            <span style="color:#ffba00">50 中立</span>
            <span style="color:#00d97e">100 強欲</span>
          </div>
        </div>
        <div class="fng-detail">
          <div class="fng-value-large" style="color:${textColor}">${v}</div>
          <div class="fng-classification" style="color:${textColor}">${fng.classification}</div>
          <div class="fng-desc">前日比: <strong style="color:${diff >= 0 ? '#00d97e' : '#ff4d6d'}">${diffStr}</strong> ポイント<br>${desc}</div>
        </div>
      </div>
    `;
  },

  _fngDescription(v) {
    if (v <= 20) return '過去の底値圏（LUNA崩壊直後=6、2020年3月=8）と同レンジ。長期的な買い場の可能性と下落継続リスクが混在。';
    if (v <= 40) return '恐怖水準。ネガティブなSNS・ニュースが多い状態。本当の一次情報を見極めることが重要な局面。';
    if (v <= 60) return '中立水準。特定の方向感なし。各ソースの一次情報を継続モニタリング。';
    if (v <= 80) return '強欲水準。SNS上での強気発言が増加している状態。新規エントリーには一次情報確認が必須。';
    return '極度の強欲。過去のATH周辺（2021年11月=90+）と同レンジ。利確・ポジション調整を検討。';
  },

  /* -------------------------------------------------------
   * Reddit 描画
   */
  _renderReddit(posts) {
    const el = document.getElementById('reddit-feed');
    if (!posts || posts.length === 0) {
      el.innerHTML = '<p class="error-msg">取得失敗。Reddit APIは一時的にCORSを制限する場合があります。</p>';
      return;
    }

    el.innerHTML = posts.map(p => {
      const score = p.score >= 1000
        ? `${(p.score / 1000).toFixed(1)}k`
        : p.score.toLocaleString();
      const age = this._relativeTime(p.created * 1000);
      return `
        <div class="feed-item">
          <div class="feed-score" title="スコア">▲${score}</div>
          <div class="feed-body">
            <a class="feed-title" href="${p.url}" target="_blank" rel="noopener">${this._esc(p.title)}</a>
            <div class="feed-meta">
              <span class="feed-sub">r/${p.subreddit}</span>
              &nbsp;·&nbsp;${p.comments} コメント
              &nbsp;·&nbsp;${age}
              ${p.flair ? `&nbsp;·&nbsp;<em>${this._esc(p.flair)}</em>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  },

  /* -------------------------------------------------------
   * GitHub 描画
   */
  _renderGitHub(commits) {
    const el = document.getElementById('github-feed');
    if (!commits || commits.length === 0) {
      el.innerHTML = '<p class="error-msg">取得失敗。GitHub API は60req/hの制限があります。</p>';
      return;
    }

    el.innerHTML = commits.map(c => {
      const age = this._relativeTime(new Date(c.date).getTime());
      return `
        <div class="github-item">
          <span class="github-repo-tag">${this._esc(c.repo)}</span>
          <div class="github-body">
            <a class="github-msg" href="${c.url}" target="_blank" rel="noopener">${this._esc(c.message)}</a>
            <div class="github-meta">${this._esc(c.author)} &nbsp;·&nbsp; ${age}</div>
          </div>
        </div>`;
    }).join('');
  },

  /* -------------------------------------------------------
   * CoinGecko Trending 描画
   */
  _renderTrending(coins) {
    const el = document.getElementById('trending-feed');
    if (!coins || coins.length === 0) {
      el.innerHTML = '<p class="error-msg">取得失敗。CoinGecko APIのレートリミットを超えた可能性があります。</p>';
      return;
    }

    el.innerHTML = coins.map(c => {
      const changeHtml = c.change24h !== null
        ? `<span class="trend-change ${c.change24h >= 0 ? 'pos' : 'neg'}">${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(1)}%</span>`
        : `<span class="trend-change" style="color:var(--muted)">—</span>`;
      const priceHtml = c.priceUsd
        ? `<span class="trend-price">$${parseFloat(c.priceUsd).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:4})}</span>`
        : '';
      return `
        <div class="trend-item">
          <span class="trend-rank">#${c.rank}</span>
          <img class="trend-thumb" src="${c.thumb}" alt="${this._esc(c.name)}" loading="lazy"/>
          <span class="trend-name">${this._esc(c.name)}<span class="trend-sym">${this._esc(c.symbol)}</span></span>
          ${priceHtml}
          ${changeHtml}
        </div>`;
    }).join('');
  },

  /* -------------------------------------------------------
   * オンチェーン（Bitcoin）描画
   */
  _renderOnchain(data) {
    const el = document.getElementById('onchain-feed');
    if (!data || (!data.mempool && !data.fees && !data.btcStats)) {
      el.innerHTML = '<p class="error-msg">取得失敗。mempool.space / blockchain.info に接続できませんでした。</p>';
      return;
    }

    const { mempool, fees, btcStats } = data;

    // mempool混雑レベル判定
    let congestionLevel = 'low', congestionColor = 'var(--green)', congestionLabel = '平常';
    if (mempool) {
      if (mempool.count > 150_000) {
        congestionLevel = 'high'; congestionColor = 'var(--red)'; congestionLabel = '極度混雑';
      } else if (mempool.count > 80_000) {
        congestionLevel = 'medium'; congestionColor = 'var(--yellow)'; congestionLabel = '混雑';
      }
    }

    const mempoolHtml = mempool ? `
      <div class="onchain-card">
        <div class="onchain-card-title">Bitcoin Mempool（mempool.space）</div>
        <div class="mempool-stat">
          <span class="mempool-label">未確認TX数</span>
          <span class="mempool-value" style="color:${congestionColor}">${mempool.count.toLocaleString()} 件</span>
        </div>
        <div class="mempool-stat">
          <span class="mempool-label">仮想サイズ</span>
          <span class="mempool-value">${(mempool.vsize / 1_000_000).toFixed(1)} MvB</span>
        </div>
        <div class="mempool-stat">
          <span class="mempool-label">合計手数料</span>
          <span class="mempool-value">${(mempool.total_fee / 1e8).toFixed(4)} BTC</span>
        </div>
        <div class="congestion-bar-wrap">
          <div class="congestion-label">
            <span>混雑度: <strong style="color:${congestionColor}">${congestionLabel}</strong></span>
            <span>基準: 15万件</span>
          </div>
          <div class="congestion-bar">
            <div class="congestion-bar-fill" style="width:${Math.min((mempool.count/150_000)*100,100).toFixed(1)}%;background:${congestionColor}"></div>
          </div>
        </div>
      </div>` : '';

    const feeFmt = (v) => {
      const cls = v > 100 ? 'fee-high' : v > 50 ? 'fee-medium' : 'fee-low';
      return `<span class="${cls}">${v} sat/vB</span>`;
    };

    const feesHtml = fees ? `
      <div class="onchain-card">
        <div class="onchain-card-title">推奨手数料（mempool.space）</div>
        <table class="fee-table">
          <tr><td>最速確認（~10分）</td><td>${feeFmt(fees.fastestFee)}</td></tr>
          <tr><td>30分確認</td><td>${feeFmt(fees.halfHourFee)}</td></tr>
          <tr><td>1時間確認</td><td>${feeFmt(fees.hourFee)}</td></tr>
          <tr><td>エコノミー</td><td>${feeFmt(fees.economyFee)}</td></tr>
          <tr><td>最小</td><td>${feeFmt(fees.minimumFee)}</td></tr>
        </table>
      </div>` : '';

    const statsHtml = btcStats ? `
      <div class="onchain-card">
        <div class="onchain-card-title">24h統計（blockchain.info）</div>
        <div class="mempool-stat">
          <span class="mempool-label">ブロック時間（平均）</span>
          <span class="mempool-value" style="color:${btcStats.minutes_between_blocks > 15 ? 'var(--red)' : 'var(--text)'}">${btcStats.minutes_between_blocks?.toFixed(1) ?? '—'} 分</span>
        </div>
        <div class="mempool-stat">
          <span class="mempool-label">採掘ブロック数 (24h)</span>
          <span class="mempool-value">${btcStats.n_blocks_mined ?? '—'} ブロック</span>
        </div>
        <div class="mempool-stat">
          <span class="mempool-label">TX数 (24h)</span>
          <span class="mempool-value">${btcStats.n_tx?.toLocaleString() ?? '—'}</span>
        </div>
        <div class="mempool-stat">
          <span class="mempool-label">手数料合計 (24h)</span>
          <span class="mempool-value">${btcStats.total_fees_btc?.toFixed(4) ?? '—'} BTC</span>
        </div>
      </div>` : '';

    const explorerHtml = `
      <div class="onchain-card">
        <div class="onchain-card-title">一次情報へのダイレクトリンク</div>
        <div class="mempool-stat">
          <span class="mempool-label">mempool.space</span>
          <a href="https://mempool.space" target="_blank" rel="noopener" style="font-size:12px;color:var(--onchain)">mempool →</a>
        </div>
        <div class="mempool-stat">
          <span class="mempool-label">blockchain.info</span>
          <a href="https://blockchain.info" target="_blank" rel="noopener" style="font-size:12px;color:var(--onchain)">stats →</a>
        </div>
        <div class="mempool-stat">
          <span class="mempool-label">Etherscan（ETH）</span>
          <a href="https://etherscan.io" target="_blank" rel="noopener" style="font-size:12px;color:var(--github)">explorer →</a>
        </div>
        <div class="mempool-stat" style="border:none">
          <span class="mempool-label">Solscan（SOL）</span>
          <a href="https://solscan.io" target="_blank" rel="noopener" style="font-size:12px;color:var(--coingecko)">explorer →</a>
        </div>
      </div>`;

    el.innerHTML = `<div class="onchain-grid">${mempoolHtml}${feesHtml}${statsHtml}${explorerHtml}</div>`;
  },

  /* -------------------------------------------------------
   * 公式SNSリンク集 描画
   */
  _renderOfficialLinks() {
    const el = document.getElementById('official-links');
    const typeLabel = { x: 'X', telegram: 'TG', discord: 'DC' };
    const typeClass = { x: 'type-x', telegram: 'type-telegram', discord: 'type-discord' };

    el.innerHTML = Sources.officialLinks.map(link => `
      <a class="link-card" href="${link.url}" target="_blank" rel="noopener">
        <span class="link-icon">${link.icon}</span>
        <div class="link-body">
          <div class="link-name">${this._esc(link.name)}</div>
          <div class="link-handle">${this._esc(link.handle)}</div>
        </div>
        <span class="link-type ${typeClass[link.type]}">${typeLabel[link.type]}</span>
      </a>`
    ).join('');
  },

  /* -------------------------------------------------------
   * アクション一覧 描画
   */
  _renderActions() {
    const actionList = Actions.generate(this.data);
    const el = document.getElementById('action-list');
    const badge = document.getElementById('action-count');

    badge.textContent = actionList.length;

    if (actionList.length === 0) {
      el.innerHTML = '<p class="placeholder">各ソースのデータをもとにアクションを生成します。</p>';
      return;
    }

    el.innerHTML = actionList.map(a => `
      <div class="action-item">
        <span class="action-priority priority-${a.priority}">${this._priorityLabel(a.priority)}</span>
        <div class="action-body">
          <div class="action-title">${this._esc(a.title)}</div>
          <div class="action-desc">${this._esc(a.desc)}</div>
          <div class="action-source">${this._esc(a.source)}</div>
        </div>
      </div>`
    ).join('');
  },

  /* -------------------------------------------------------
   * ユーティリティ
   */
  _priorityLabel(p) {
    return { high: '要対応', medium: '確認推奨', low: '参考', info: '情報' }[p] || p;
  },

  _relativeTime(ms) {
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec < 60)   return `${sec}秒前`;
    if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
    if (sec < 86400)return `${Math.floor(sec / 3600)}時間前`;
    return `${Math.floor(sec / 86400)}日前`;
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
