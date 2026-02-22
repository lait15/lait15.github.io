/**
 * notifier.js - 通知システム
 *
 * 対応チャネル:
 * 1. ブラウザ通知 (Notification API)
 * 2. Discord Webhook
 * 3. Telegram Bot
 */

const Notifier = {
  /**
   * ブラウザ通知の許可をリクエスト
   */
  async requestBrowserPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /**
   * ブラウザ通知を送信
   */
  sendBrowserNotification(title, body) {
    if (!CONFIG.notifications.browser) return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, {
      body,
      icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    });
  },

  /**
   * Discord Webhook に通知を送信
   * 注意: Discordは同一オリジンからのWebhookリクエストを許可しています
   */
  async sendDiscordNotification(pair, cexPrice, onchainPrice, gapPercent) {
    const url = CONFIG.notifications.discordWebhook;
    if (!url) return;

    const direction = gapPercent > 0 ? '📈 DEX > CEX' : '📉 CEX > DEX';
    const levelColor = Math.abs(gapPercent) >= CONFIG.alertThreshold * 2 ? 0xff4d6d : 0xffba00;
    const sign = gapPercent >= 0 ? '+' : '';

    const payload = {
      embeds: [
        {
          title: `🚨 ${pair.symbol} 価格乖離アラート`,
          color: levelColor,
          fields: [
            {
              name: `CEX (${pair.cex.name})`,
              value: `$${cexPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
              inline: true,
            },
            {
              name: `オンチェーン (${pair.onchain.name})`,
              value: `$${onchainPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
              inline: true,
            },
            { name: '乖離率', value: `${sign}${gapPercent.toFixed(3)}%`, inline: true },
            { name: '方向', value: direction, inline: true },
            { name: '閾値', value: `${CONFIG.alertThreshold}%`, inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Crypto CEX/DEX Gap Monitor' },
        },
      ],
    };

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('[Notifier] Discord webhook failed:', e.message);
    }
  },

  /**
   * Telegram Bot API に通知を送信
   * CORSを回避できるため静的サイトから利用可能
   */
  async sendTelegramNotification(pair, cexPrice, onchainPrice, gapPercent) {
    const { telegramToken, telegramChatId } = CONFIG.notifications;
    if (!telegramToken || !telegramChatId) return;

    const direction = gapPercent > 0 ? '📈 DEX > CEX' : '📉 CEX > DEX';
    const sign = gapPercent >= 0 ? '+' : '';
    const text =
      `🚨 *${pair.symbol} 乖離アラート*\n\n` +
      `CEX (${pair.cex.name}): \`$${cexPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`\n` +
      `オンチェーン: \`$${onchainPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`\n` +
      `乖離率: *${sign}${gapPercent.toFixed(3)}%*\n` +
      `方向: ${direction}\n` +
      `閾値: ${CONFIG.alertThreshold}%`;

    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) {
      console.error('[Notifier] Telegram notification failed:', e.message);
    }
  },

  /**
   * すべての通知チャネルへ一括送信
   */
  async notify(pair, cexPrice, onchainPrice, gapPercent) {
    const sign = gapPercent >= 0 ? '+' : '';
    const title = `${pair.symbol} 乖離: ${sign}${gapPercent.toFixed(2)}%`;
    const body = `CEX: $${cexPrice.toFixed(2)} / DEX: $${onchainPrice.toFixed(2)}`;

    this.sendBrowserNotification(title, body);

    await Promise.allSettled([
      this.sendDiscordNotification(pair, cexPrice, onchainPrice, gapPercent),
      this.sendTelegramNotification(pair, cexPrice, onchainPrice, gapPercent),
    ]);
  },
};
