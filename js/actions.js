/**
 * actions.js
 * 取得した一次情報ソースのデータを分析し「次のアクション」を生成する
 *
 * アクション生成ルール:
 *   - Fear & Greed の水準 → 市場心理に基づくポジション見直し提案
 *   - Reddit ホット投稿のキーワード → 注目トピックの一次情報確認を促す
 *   - GitHub の最新コミット → プロトコル変更の精読を促す
 *   - CoinGecko トレンド急上昇 → プロジェクト調査を促す
 */

const Actions = {

  /**
   * すべてのデータを受け取ってアクションリストを生成
   * @param {object} data - { fng, reddit, github, trending }
   * @returns {Array<{priority, title, desc, source}>}
   */
  generate({ fng, reddit, github, trending, onchain }) {
    const actions = [];

    // -- Fear & Greed -------------------------------------------------
    if (fng) {
      const fngActions = this._fromFearAndGreed(fng);
      actions.push(...fngActions);
    }

    // -- GitHub コミット -----------------------------------------------
    if (github && github.length > 0) {
      const ghActions = this._fromGitHub(github);
      actions.push(...ghActions);
    }

    // -- Reddit ホット投稿 ---------------------------------------------
    if (reddit && reddit.length > 0) {
      const redditActions = this._fromReddit(reddit);
      actions.push(...redditActions);
    }

    // -- CoinGecko トレンド -------------------------------------------
    if (trending && trending.length > 0) {
      const trendActions = this._fromTrending(trending);
      actions.push(...trendActions);
    }

    // -- オンチェーン（Bitcoin）---------------------------------------
    if (onchain && (onchain.mempool || onchain.fees || onchain.btcStats)) {
      const onchainActions = this._fromOnchain(onchain);
      actions.push(...onchainActions);
    }

    // 優先度順にソート: high → medium → low → info
    const order = { high: 0, medium: 1, low: 2, info: 3 };
    actions.sort((a, b) => order[a.priority] - order[b.priority]);

    return actions;
  },

  /* -------------------------------------------------------
   * Fear & Greed からアクション生成
   */
  _fromFearAndGreed(fng) {
    const actions = [];
    const v = fng.value;
    const diff = v - fng.valueYesterday;
    const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;

    if (v <= 20) {
      actions.push({
        priority: 'high',
        title:    '極度の恐怖 — 過去の底値圏パターンと照合',
        desc:     `Fear & Greed が ${v}（${fng.classification}）と極度の恐怖水準。2022年LUNA崩壊直後（6）・2020年3月ショック（8）など歴史的底値圏と同レンジ。過去の一次情報（GitHub・Reddit）でのネガティブセンチメントと今の投稿内容を比較し、今回の下落の性質を確認する。`,
        source:   '一次情報元: alternative.me Fear & Greed（Twitter/X言及・検索量・出来高集計）',
      });
    } else if (v <= 40) {
      actions.push({
        priority: 'medium',
        title:    '恐怖水準 — Reddit・GitHub での議論を確認',
        desc:     `Fear & Greed が ${v}（${fng.classification}）。恐怖水準では長期保有者の売却や規制報道が一次情報として先行することが多い。Reddit ホット投稿と GitHub の開発活動（止まっていないか）を確認し、ファンダメンタルズの変化がないか判断する。`,
        source:   '一次情報元: alternative.me Fear & Greed',
      });
    } else if (v >= 80) {
      actions.push({
        priority: 'high',
        title:    '極度の強欲 — 利確・ポジション縮小を検討',
        desc:     `Fear & Greed が ${v}（${fng.classification}）と過熱水準。2021年11月ATH時は90+を記録。SNS上での「〇〇はまだ上がる」系の投稿急増が一次情報として観測されている場合、天井圏の可能性が高い。Reddit の具体的な楽観投稿内容を確認し、自身のポジションを見直す。`,
        source:   '一次情報元: alternative.me Fear & Greed（SNSセンチメント集計）',
      });
    } else if (v >= 60) {
      actions.push({
        priority: 'low',
        title:    '強欲水準 — 新規エントリーは慎重に',
        desc:     `Fear & Greed が ${v}（${fng.classification}）。新規エントリーには割高感が生じやすい水準。トレンドのコインについて公式サイト・Whitepaper・GitHub の開発実績（一次情報）を精査してから意思決定する。`,
        source:   '一次情報元: alternative.me Fear & Greed',
      });
    } else {
      actions.push({
        priority: 'info',
        title:    '市場心理は中立 — 一次情報の定期チェックを継続',
        desc:     `Fear & Greed が ${v}（${fng.classification}、前日比${diffStr}）。極端な水準ではなく、各ソースの一次情報を引き続き定期モニタリングする段階。`,
        source:   '一次情報元: alternative.me Fear & Greed',
      });
    }

    // 前日比で急変している場合は追加アクション
    if (Math.abs(diff) >= 10) {
      actions.push({
        priority: 'medium',
        title:    `Fear & Greed が急変（前日比 ${diffStr}）`,
        desc:     `1日で${Math.abs(diff)}ポイントの急変は、SNS上で何らかの一次情報（発表・事件・規制報道）が出ている可能性が高い。Reddit ホット投稿と公式Twitterを最優先で確認する。`,
        source:   '一次情報元: alternative.me Fear & Greed',
      });
    }

    return actions;
  },

  /* -------------------------------------------------------
   * GitHub からアクション生成
   */
  _fromGitHub(github) {
    const actions = [];

    // ETH EIPsに新しいコミットがある場合
    const ethCommits = github.filter(c => c.repoKey === 'eth-eips');
    if (ethCommits.length > 0) {
      const latest = ethCommits[0];
      actions.push({
        priority: 'medium',
        title:    'Ethereum EIPs に新しい活動を検出',
        desc:     `最新コミット: 「${latest.message}」（by ${latest.author}）。EIPはETHの仕様変更の一次情報。過去の大型アップグレード（Merge・Shanghai等）はすべてここから始まった。リンクを開き変更内容を確認し、自身の保有資産への影響を評価する。`,
        source:   '一次情報元: github.com/ethereum/EIPs',
      });
    }

    // Bitcoin Coreに新しいコミットがある場合
    const btcCommits = github.filter(c => c.repoKey === 'btc-core');
    if (btcCommits.length > 0) {
      const latest = btcCommits[0];
      actions.push({
        priority: 'low',
        title:    'Bitcoin Core に開発活動を確認',
        desc:     `最新コミット: 「${latest.message}」（by ${latest.author}）。Bitcoin CoreのGitHubはTaproot・SegWit等の一次情報発信源。大型変更の兆候があればコミュニティ（Reddit r/Bitcoin）での議論と照合する。`,
        source:   '一次情報元: github.com/bitcoin/bitcoin',
      });
    }

    // Solanaに新しいコミットがある場合
    const solCommits = github.filter(c => c.repoKey === 'solana');
    if (solCommits.length > 0) {
      actions.push({
        priority: 'info',
        title:    'Solana プロトコル開発を確認',
        desc:     `Solanaのリポジトリに新しい活動。過去のネットワーク障害・復旧もGitHub IssueとTelegram公式が一次情報源だった。変更内容をリリースノートで確認する。`,
        source:   '一次情報元: github.com/solana-labs/solana',
      });
    }

    return actions;
  },

  /* -------------------------------------------------------
   * Reddit からアクション生成
   */
  _fromReddit(reddit) {
    const actions = [];

    // キーワードパターン: 規制・ハック・取引所系
    const ALERT_KEYWORDS = [
      { words: ['sec', 'regulation', '規制', 'ban', 'lawsuit'],   label: '規制・法律',  priority: 'high'   },
      { words: ['hack', 'exploit', 'drained', 'bridge'],          label: 'ハック・脆弱性', priority: 'high'  },
      { words: ['bankrupt', 'insolvent', 'collapse', 'rug'],      label: '取引所・プロジェクト破綻', priority: 'high' },
      { words: ['halving', 'etf', 'approval', 'listing'],         label: '市場イベント', priority: 'medium' },
      { words: ['upgrade', 'mainnet', 'launch', 'airdrop'],       label: 'プロトコル更新', priority: 'medium' },
    ];

    let foundKeywords = [];

    for (const post of reddit.slice(0, 5)) {
      const text = (post.title + ' ' + (post.flair || '')).toLowerCase();
      for (const pattern of ALERT_KEYWORDS) {
        if (pattern.words.some(w => text.includes(w))) {
          foundKeywords.push({ ...pattern, post });
          break;
        }
      }
    }

    if (foundKeywords.length > 0) {
      // 最も重要なキーワードのアクションを生成
      const top = foundKeywords[0];
      actions.push({
        priority: top.priority,
        title:    `Reddit に「${top.label}」関連の投稿が急上昇`,
        desc:     `スコア ${top.post.score.toLocaleString()} の投稿「${top.post.title.slice(0, 60)}…」が r/${top.post.subreddit} でホット入り。過去（FTX崩壊・LUNA等）でもRedditが一次情報の集積点となった。投稿内のリンク先（公式発表・SEC資料等）を直接確認して一次情報を取得する。`,
        source:   `一次情報元: reddit.com/r/${top.post.subreddit}`,
      });
    }

    // スコアが高い投稿があれば常に「精読」アクションを追加
    const topPost = reddit[0];
    if (topPost && topPost.score > 500) {
      actions.push({
        priority: 'info',
        title:    `注目投稿: 「${topPost.title.slice(0, 45)}…」`,
        desc:     `r/${topPost.subreddit} でスコア ${topPost.score.toLocaleString()}・コメント ${topPost.comments} 件。このスレッド内のリンク・情報を辿り、一次情報（公式発表・ブロックエクスプローラー・SEC資料等）を確認する。`,
        source:   `一次情報元: reddit.com/r/${topPost.subreddit}`,
      });
    }

    return actions;
  },

  /* -------------------------------------------------------
   * CoinGecko トレンドからアクション生成
   */
  _fromTrending(trending) {
    const actions = [];

    const top3 = trending.slice(0, 3);
    const names = top3.map(t => t.symbol).join(' / ');

    actions.push({
      priority: 'medium',
      title:    `SNS急上昇コイン: ${names} — 公式情報を精査`,
      desc:     `CoinGeckoのTrendingはTwitter/X・Telegram・Discordでの検索・言及を集計。トレンド入りは価格変動の24〜72時間前に起きることが多い。各プロジェクトの公式Twitterアカウント・Discord・GitHubで発表内容（一次情報）を確認し、SNSの噂と区別する。`,
      source:   '一次情報元: api.coingecko.com/trending（SNS集計）',
    });

    // 24h変化が大きいコインがあれば追加
    const bigMover = trending.find(t => t.change24h !== null && Math.abs(t.change24h) > 20);
    if (bigMover) {
      const sign = bigMover.change24h > 0 ? '+' : '';
      actions.push({
        priority: 'medium',
        title:    `${bigMover.symbol} が24h ${sign}${bigMover.change24h.toFixed(1)}% と急変動`,
        desc:     `トレンド上位の ${bigMover.name} が急変動中。公式X（@${bigMover.symbol.toLowerCase()}）・公式Telegram・プロジェクトのGitHubで発表・アップグレード・事件の一次情報を確認する。SNS上の「噂」ではなく一次情報源にアクセスすること。`,
        source:   '一次情報元: CoinGecko Trending（SNS集計）',
      });
    }

    return actions;
  },

  /* -------------------------------------------------------
   * オンチェーン（Bitcoin）からアクション生成
   */
  _fromOnchain({ mempool, fees, btcStats }) {
    const actions = [];

    // --- Mempool 混雑アクション ---
    if (mempool) {
      const count = mempool.count;

      if (count > 150_000) {
        actions.push({
          priority: 'high',
          title:    `Bitcoin mempool 極度混雑（未確認TX: ${count.toLocaleString()}件）`,
          desc:     `mempoolが15万件超と極度に混雑。過去の事例（半減期・大型イベント・市場急変）と同様のパターン。取引所への大量入出金の有無をmempool.spaceで直接確認し、異変の一次情報を取得する。`,
          source:   '一次情報元: mempool.space（Bitcoin on-chain）',
        });
      } else if (count > 80_000) {
        actions.push({
          priority: 'medium',
          title:    `Bitcoin mempool 混雑（未確認TX: ${count.toLocaleString()}件）`,
          desc:     `mempoolが8万件超と混雑気味。何らかのオンチェーンイベントが進行している可能性。mempool.spaceでトランザクションの内訳（手数料・送信元）を確認し、大口移動の有無を判断する。`,
          source:   '一次情報元: mempool.space（Bitcoin on-chain）',
        });
      } else {
        actions.push({
          priority: 'info',
          title:    `Bitcoin mempool は平常（未確認TX: ${count.toLocaleString()}件）`,
          desc:     `mempoolに特異な混雑なし。通常の取引フロー。大型イベント前は急激に増加することがあるため、定期的なオンチェーンモニタリングを継続する。`,
          source:   '一次情報元: mempool.space（Bitcoin on-chain）',
        });
      }
    }

    // --- 手数料アクション ---
    if (fees) {
      const fast = fees.fastestFee;

      if (fast > 100) {
        actions.push({
          priority: 'high',
          title:    `Bitcoin手数料急騰（最速: ${fast} sat/vB）`,
          desc:     `最速確認の手数料が100 sat/vBを超える異常水準。過去の急騰は大型ハック・フォーク・ETF承認などのオンチェーンイベントと連動していた。mempool.space / X公式で一次情報を緊急確認する。`,
          source:   '一次情報元: mempool.space fees（Bitcoin on-chain）',
        });
      } else if (fast > 50) {
        actions.push({
          priority: 'medium',
          title:    `Bitcoin手数料上昇中（最速: ${fast} sat/vB）`,
          desc:     `手数料が50 sat/vBを超えている。ネットワークへの需要増加のシグナル。オンチェーン上の大口移動や取引所フローをmempool.spaceで確認する。`,
          source:   '一次情報元: mempool.space fees（Bitcoin on-chain）',
        });
      }
    }

    // --- ブロックチェーン統計アクション ---
    if (btcStats) {
      const blockTime = btcStats.minutes_between_blocks;

      if (blockTime > 15) {
        actions.push({
          priority: 'medium',
          title:    `Bitcoinブロック生成が遅延（平均 ${blockTime.toFixed(1)} 分/ブロック）`,
          desc:     `平均ブロック生成時間が15分超。マイナーの大規模な移動（中国規制時など）や難易度調整直前に起きる現象。blockchain.infoでハッシュレートの推移を確認する。`,
          source:   '一次情報元: blockchain.info stats（Bitcoin on-chain）',
        });
      }
    }

    return actions;
  },
};
