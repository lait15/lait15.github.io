/**
 * sources.js
 * 各SNS一次情報ソースの定義と、APIからのデータ取得処理
 *
 * 取得可能ソース（静的サイト / CORS対応）:
 *   - Reddit 公開JSON API
 *   - GitHub REST API（非認証・60req/h）
 *   - CoinGecko Trending API
 *   - Fear & Greed Index (alternative.me)
 */

const Sources = {

  /* -------------------------------------------------------
   * Reddit
   * -------------------------------------------------------
   * 公開JSONエンドポイント。認証不要。
   * 過去実績: FTX崩壊・LUNA崩壊の兆候がr/CCで最初に集積
   */
  async fetchReddit() {
    const subs = ['CryptoCurrency', 'Bitcoin', 'ethereum'];
    const results = [];

    for (const sub of subs) {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=3&raw_json=1`,
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const posts = json.data.children.map(c => ({
          subreddit: c.data.subreddit,
          title:     c.data.title,
          score:     c.data.score,
          comments:  c.data.num_comments,
          url:       `https://www.reddit.com${c.data.permalink}`,
          flair:     c.data.link_flair_text || '',
          created:   c.data.created_utc,
        }));
        results.push(...posts);
      } catch (e) {
        console.warn(`[Reddit] r/${sub} 取得失敗:`, e.message);
      }
    }

    // スコア降順でソートし上位8件
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 8);
  },

  /* -------------------------------------------------------
   * GitHub
   * -------------------------------------------------------
   * 主要プロトコルリポジトリの最新コミット・リリースを取得
   * 過去実績: ETH Merge / Bitcoin Taproot / ERC-4337 はすべてここから
   */
  async fetchGitHub() {
    const repos = [
      { key: 'eth-eips',   owner: 'ethereum', repo: 'EIPs',    label: 'Ethereum EIPs' },
      { key: 'btc-core',   owner: 'bitcoin',  repo: 'bitcoin',  label: 'Bitcoin Core' },
      { key: 'solana',     owner: 'solana-labs', repo: 'solana', label: 'Solana' },
    ];

    const results = [];

    for (const r of repos) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${r.owner}/${r.repo}/commits?per_page=2`,
          { headers: { Accept: 'application/vnd.github+json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const commits = await res.json();
        for (const c of commits) {
          results.push({
            repo:    r.label,
            repoKey: r.key,
            message: c.commit.message.split('\n')[0].slice(0, 80),
            author:  c.commit.author.name,
            date:    c.commit.author.date,
            url:     c.html_url,
          });
        }
      } catch (e) {
        console.warn(`[GitHub] ${r.repo} 取得失敗:`, e.message);
      }
    }

    return results;
  },

  /* -------------------------------------------------------
   * CoinGecko Trending
   * -------------------------------------------------------
   * Twitter/X・Telegram・Discordでの検索急増を集計したもの
   * 過去実績: SNS上で話題になる直前（24〜72h前）に検出可能
   */
  async fetchTrending() {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      return json.coins.slice(0, 7).map((item, i) => ({
        rank:      i + 1,
        id:        item.item.id,
        name:      item.item.name,
        symbol:    item.item.symbol,
        thumb:     item.item.thumb,
        priceBtc:  item.item.price_btc,
        change24h: item.item.data?.price_change_percentage_24h?.usd ?? null,
        priceUsd:  item.item.data?.price ?? null,
      }));
    } catch (e) {
      console.warn('[CoinGecko] Trending 取得失敗:', e.message);
      return [];
    }
  },

  /* -------------------------------------------------------
   * Fear & Greed Index
   * -------------------------------------------------------
   * alternative.me 集計: Twitter言及・検索量・出来高・ボラ・BTC Dom
   * 過去実績: 底値（LUNA崩壊直後=6）・天井（2021年11月=90+）と高相関
   */
  async fetchFearAndGreed() {
    try {
      const res = await fetch('https://api.alternative.me/fng/?limit=2');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const [today, yesterday] = json.data;
      return {
        value:          parseInt(today.value, 10),
        classification: today.value_classification,
        valueYesterday: parseInt(yesterday?.value ?? today.value, 10),
        timestamp:      today.timestamp,
      };
    } catch (e) {
      console.warn('[F&G] 取得失敗:', e.message);
      return null;
    }
  },

  /* -------------------------------------------------------
   * オンチェーン（Bitcoin）
   * -------------------------------------------------------
   * mempool.space: Bitcoinmempool・手数料 (CORS対応・認証不要)
   * blockchain.info: Bitcoin 24h統計 (CORS対応・認証不要)
   * 過去実績: FTX崩壊・BTC半減期前に異常が先行観測された
   */
  async fetchOnchain() {
    const [mempoolRes, feesRes, statsRes] = await Promise.allSettled([
      fetch('https://mempool.space/api/mempool').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch('https://mempool.space/api/v1/fees/recommended').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch('https://blockchain.info/stats?format=json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ]);

    return {
      mempool:  mempoolRes.status  === 'fulfilled' ? mempoolRes.value  : null,
      fees:     feesRes.status     === 'fulfilled' ? feesRes.value     : null,
      btcStats: statsRes.status    === 'fulfilled' ? statsRes.value    : null,
      errors: [
        mempoolRes.status  === 'rejected' ? `mempool: ${mempoolRes.reason.message}`   : null,
        feesRes.status     === 'rejected' ? `fees: ${feesRes.reason.message}`         : null,
        statsRes.status    === 'rejected' ? `stats: ${statsRes.reason.message}`       : null,
      ].filter(Boolean),
    };
  },

  /* -------------------------------------------------------
   * 公式SNSリンク集（静的定義）
   * -------------------------------------------------------
   * Twitter APIは静的サイトから認証なし取得不可のためリンク集として提供
   */
  officialLinks: [
    { name: 'Bitcoin',            handle: '@bitcoin',         url: 'https://x.com/bitcoin',            type: 'x',        icon: '₿' },
    { name: 'Ethereum Foundation',handle: '@ethereum',        url: 'https://x.com/ethereum',           type: 'x',        icon: '⟠' },
    { name: 'Vitalik Buterin',    handle: '@VitalikButerin',  url: 'https://x.com/VitalikButerin',     type: 'x',        icon: '👤' },
    { name: 'Solana',             handle: '@solana',          url: 'https://x.com/solana',             type: 'x',        icon: '◎' },
    { name: 'Binance',            handle: '@binance',         url: 'https://x.com/binance',            type: 'x',        icon: '🔶' },
    { name: 'Coinbase',           handle: '@coinbase',        url: 'https://x.com/coinbase',           type: 'x',        icon: '🔵' },
    { name: 'Ethereum (TG)',      handle: 'EthereumDev',      url: 'https://t.me/ethereum',            type: 'telegram', icon: '⟠' },
    { name: 'Bitcoin TG',         handle: 'BitcoinOrg',       url: 'https://t.me/bitcoincore_dev',     type: 'telegram', icon: '₿' },
    { name: 'Solana TG',          handle: 'solanacommunity',  url: 'https://t.me/solanacommunity',     type: 'telegram', icon: '◎' },
    { name: 'Crypto Discord',     handle: 'r/CC Discord',     url: 'https://discord.gg/cryptocurrencyofficial', type: 'discord', icon: '💬' },
  ],
};
