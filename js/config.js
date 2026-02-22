/**
 * config.js - 設定ファイル
 * CEX/オンチェーン乖離モニター
 */

const CONFIG = {
  // 更新間隔（秒）
  interval: 30,

  // 乖離アラート閾値（%）
  alertThreshold: 1.0,

  // チャート表示ポイント数
  maxHistoryPoints: 60,

  // アラート履歴の最大件数
  maxAlerts: 100,

  // 監視対象ペア
  pairs: [
    {
      id: 'eth',
      symbol: 'ETH/USDT',
      cex: {
        name: 'Binance',
        symbol: 'ETHUSDT',
      },
      onchain: {
        // DeFiLlamaはオンチェーンのDEXプールから価格を集計
        name: 'DEX (DeFiLlama)',
        // WETH コントラクトアドレス (Ethereum mainnet)
        llamaToken: 'ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      },
    },
    {
      id: 'btc',
      symbol: 'BTC/USDT',
      cex: {
        name: 'Binance',
        symbol: 'BTCUSDT',
      },
      onchain: {
        name: 'DEX (DeFiLlama)',
        // WBTC コントラクトアドレス (Ethereum mainnet)
        llamaToken: 'ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      },
    },
    {
      id: 'sol',
      symbol: 'SOL/USDT',
      cex: {
        name: 'Binance',
        symbol: 'SOLUSDT',
      },
      onchain: {
        name: 'DEX (DeFiLlama)',
        // Wrapped SOL コントラクトアドレス (Solana)
        llamaToken: 'solana:So11111111111111111111111111111111111111112',
      },
    },
  ],

  // 通知設定
  notifications: {
    browser: false,
    discordWebhook: '',
    telegramToken: '',
    telegramChatId: '',
    // 同一ペアへの通知クールダウン（ミリ秒）
    cooldown: 5 * 60 * 1000,
  },
};
