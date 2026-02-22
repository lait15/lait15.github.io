/**
 * api.js - 価格データ取得
 *
 * CEX: Binance Public REST API
 * オンチェーン: DeFiLlama Coins API（Uniswap/Curve等のDEXプールから集計）
 */

const API = {
  BINANCE_BASE: 'https://api.binance.com/api/v3',
  LLAMA_BASE: 'https://coins.llama.fi/prices/current',

  /**
   * CEX（Binance）から単一ペアの価格を取得
   */
  async fetchCexPrice(pair) {
    const url = `${this.BINANCE_BASE}/ticker/price?symbol=${pair.cex.symbol}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance API error [${res.status}]: ${pair.cex.symbol}`);
    const data = await res.json();
    return parseFloat(data.price);
  },

  /**
   * DeFiLlamaからすべてのペアのオンチェーン価格を一括取得
   * DeFiLlamaはUniswap V3, Curve, Raydium等のオンチェーンプールから価格を集計
   */
  async fetchAllOnchainPrices() {
    const tokens = CONFIG.pairs.map((p) => p.onchain.llamaToken).join(',');
    const url = `${this.LLAMA_BASE}/${tokens}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DeFiLlama API error [${res.status}]`);
    const data = await res.json();
    return data.coins;
  },

  /**
   * CEXとオンチェーンのすべての価格を並列取得
   * @returns {Array<{pair, cexPrice, onchainPrice, onchainSource}>}
   */
  async fetchAllPrices() {
    const [onchainData, ...cexResults] = await Promise.allSettled([
      this.fetchAllOnchainPrices(),
      ...CONFIG.pairs.map((pair) => this.fetchCexPrice(pair)),
    ]);

    const onchainCoins = onchainData.status === 'fulfilled' ? onchainData.value : {};

    return CONFIG.pairs.map((pair, i) => {
      const cexResult = cexResults[i];
      const onchainCoin = onchainCoins[pair.onchain.llamaToken];

      return {
        pair,
        cexPrice: cexResult.status === 'fulfilled' ? cexResult.value : null,
        cexError: cexResult.status === 'rejected' ? cexResult.reason.message : null,
        onchainPrice: onchainCoin ? parseFloat(onchainCoin.price) : null,
        onchainSource: onchainCoin ? onchainCoin.symbol : null,
        onchainError: onchainData.status === 'rejected' ? onchainData.reason.message : null,
      };
    });
  },
};
