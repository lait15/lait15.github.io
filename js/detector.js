/**
 * detector.js - 乖離検出ロジック
 */

const Detector = {
  // 通知クールダウン管理 { pairId: lastNotifyTimestamp }
  _lastNotifyTime: {},

  /**
   * 乖離率を計算（%）
   * 正: オンチェーンがCEXより高い（DEX > CEX → CEXで買い、DEXで売り）
   * 負: CEXがオンチェーンより高い（CEX > DEX → DEXで買い、CEXで売り）
   */
  calculateGap(cexPrice, onchainPrice) {
    return ((onchainPrice - cexPrice) / cexPrice) * 100;
  },

  /**
   * アラートレベルを取得
   * low    : 閾値未満（正常）
   * medium : 閾値以上かつ閾値×2未満
   * high   : 閾値×2以上
   */
  getAlertLevel(gapPercent, threshold) {
    const abs = Math.abs(gapPercent);
    if (abs >= threshold * 2) return 'high';
    if (abs >= threshold) return 'medium';
    return 'low';
  },

  /**
   * アラート対象かどうか
   */
  isAlert(gapPercent, threshold) {
    return Math.abs(gapPercent) >= threshold;
  },

  /**
   * 通知クールダウンを考慮して通知すべきか判定
   * 同じペアへの通知は CONFIG.notifications.cooldown ミリ秒に1回に制限
   */
  shouldNotify(pairId) {
    const now = Date.now();
    const last = this._lastNotifyTime[pairId] || 0;
    if (now - last >= CONFIG.notifications.cooldown) {
      this._lastNotifyTime[pairId] = now;
      return true;
    }
    return false;
  },

  /**
   * 乖離の方向ラベルを返す
   */
  getDirection(gapPercent) {
    if (gapPercent > 0) return 'DEX > CEX';
    if (gapPercent < 0) return 'CEX > DEX';
    return '均衡';
  },

  /**
   * 乖離率に基づくカラーコードを返す
   */
  getColor(level) {
    return { low: '#00d97e', medium: '#ffba00', high: '#ff4d6d' }[level];
  },
};
