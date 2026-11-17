/**
 * Webhook ingestion & verification service for external event listeners.
 */
export const webhookService = {
  /**
   * Verify Webhook challenge handshake (hub.mode / hub.verify_token)
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    configuredToken: string
  ): { valid: boolean; challenge?: string } {
    if (mode === 'subscribe' && token === configuredToken) {
      return { valid: true, challenge };
    }
    return { valid: false };
  },

  /**
   * Verify HMAC-SHA256 signature from webhook request
   */
  async verifySignature(
    rawPayload: string,
    signatureHeader: string | null,
    appSecret: string
  ): Promise<boolean> {
    if (!signatureHeader || !appSecret) return false;
    try {
      const parts = signatureHeader.split('=');
      if (parts.length !== 2 || parts[0] !== 'sha256') return false;
      const expectedHash = parts[1];

      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(appSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawPayload));
        const hashArray = Array.from(new Uint8Array(signatureBytes));
        const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return computedHash === expectedHash;
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Parse incoming structured webhook payload
   */
  parseWebhookPayload(payload: any): {
    messageText: string;
    fromPhone: string;
    fromName?: string;
    messageId?: string;
    timestamp?: string;
  } | null {
    try {
      // Standard webhook payload format
      if (payload?.text || payload?.messageText) {
        return {
          messageText: payload.text || payload.messageText,
          fromPhone: payload.phone || payload.fromPhone || 'anonymous',
          fromName: payload.name || payload.fromName || 'Inbound User',
          messageId: payload.id || payload.messageId,
          timestamp: payload.timestamp || new Date().toISOString(),
        };
      }

      // Nested envelope format
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      const contact = value?.contacts?.[0];

      if (!message) return null;

      const messageText = message.text?.body || message.body || '';
      const fromPhone = message.from || contact?.wa_id || '';
      const fromName = contact?.profile?.name;
      const messageId = message.id;
      const timestamp = message.timestamp
        ? new Date(parseInt(message.timestamp, 10) * 1000).toISOString()
        : new Date().toISOString();

      return {
        messageText,
        fromPhone,
        fromName,
        messageId,
        timestamp,
      };
    } catch {
      return null;
    }
  },
};

export const whatsappService = webhookService;
