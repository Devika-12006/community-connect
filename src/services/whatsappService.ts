import { repository } from '../db/repository';
import { complaintRoutingService, type RouteComplaintResult } from './complaintRoutingService';
import type { WhatsAppIntegrationConfig, AIComplaintAnalysis } from '../types';

export interface SimulatedChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  complaintReference?: string;
  analysis?: AIComplaintAnalysis;
  matchScore?: number;
  matchReason?: string;
  routingStatus?: string;
  recommendedContact?: {
    name: string;
    role: string;
    phone: string;
  };
}

export const SAMPLE_WHATSAPP_PRESETS = [
  {
    title: 'Streetlight Outage (Block C)',
    category: 'Streetlights',
    text: 'Streetlight not working near Block C children playground for 2 days. The area is completely dark at night and kids cannot play safely.',
  },
  {
    title: 'Water Pipe Burst (Block B)',
    category: 'Water Leakage',
    text: 'Urgent! Heavy water leakage and overhead pipe burst on Block B 3rd floor terrace. Water is seeping into lower flat ceilings.',
  },
  {
    title: 'Overflowing Garbage (Clubhouse)',
    category: 'Garbage',
    text: 'Dry and wet waste bins near the Clubhouse entrance are overflowing with trash and smelling terrible. Stray dogs are scattering waste.',
  },
  {
    title: 'Road Paver Pothole (Block A)',
    category: 'Roads and Potholes',
    text: 'Deep pothole and broken paver blocks near the Block A main driveway entrance. Several two-wheelers almost skidded this morning.',
  },
  {
    title: 'Municipal Drain Overflow (Sector 5)',
    category: 'Drainage',
    text: 'Main storm drainage along Sector 5 perimeter road is completely clogged with silt and overflowing onto the main road.',
  },
  {
    title: 'Vague Issue (Needs Clarification)',
    category: 'Other',
    text: 'Please send someone quickly to repair the broken wire. It is very urgent!',
  },
];

const SIMULATOR_STORAGE_KEY = 'cc_whatsapp_simulator_history';

export const whatsappService = {
  /**
   * Verify Meta WhatsApp Cloud API Webhook handshake
   */
  verifyWebhook(mode: string, token: string, challenge: string, configuredToken: string): { valid: boolean; challenge?: string } {
    if (mode === 'subscribe' && token === configuredToken) {
      return { valid: true, challenge };
    }
    return { valid: false };
  },

  /**
   * Verify HMAC-SHA256 signature from Meta webhook request
   */
  async verifySignature(rawPayload: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
    if (!signatureHeader || !appSecret) return false;
    try {
      // Signature header format: "sha256=abcdef..."
      const parts = signatureHeader.split('=');
      if (parts.length !== 2 || parts[0] !== 'sha256') return false;
      const expectedHash = parts[1];

      // In browser/crypto environment:
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
   * Parse incoming Meta WhatsApp Business webhook payload
   */
  parseWebhookPayload(payload: any): {
    messageText: string;
    fromPhone: string;
    fromName?: string;
    messageId?: string;
    timestamp?: string;
  } | null {
    try {
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      const contact = value?.contacts?.[0];

      if (!message || message.type !== 'text') {
        return null;
      }

      return {
        messageText: message.text?.body || '',
        fromPhone: message.from || '',
        fromName: contact?.profile?.name || undefined,
        messageId: message.id,
        timestamp: message.timestamp ? new Date(parseInt(message.timestamp, 10) * 1000).toISOString() : new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  /**
   * Send real WhatsApp message via Meta Cloud API
   */
  async sendWhatsAppMessage(
    toPhone: string,
    messageText: string,
    customConfig?: WhatsAppIntegrationConfig
  ): Promise<{ success: boolean; response?: any; error?: string }> {
    const config = customConfig || (await repository.getIntegrationConfig());

    if (!config.enabled || !config.phoneNumberId || !config.accessToken) {
      return {
        success: false,
        error: 'WhatsApp Business API is not configured with a valid Phone Number ID and Access Token. Messages are operating in Simulator mode.',
      };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhone.replace(/[^\d]/g, ''),
          type: 'text',
          text: {
            preview_url: false,
            body: messageText,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data?.error?.message || 'Meta Cloud API error', response: data };
      }
      return { success: true, response: data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network request failed' };
    }
  },

  // --- Interactive Simulator Logic ---

  getStoredSimulatedChat(): SimulatedChatMessage[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(SIMULATOR_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveStoredSimulatedChat(messages: SimulatedChatMessage[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SIMULATOR_STORAGE_KEY, JSON.stringify(messages));
      }
    } catch {}
  },

  clearSimulatedChat(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SIMULATOR_STORAGE_KEY);
      }
    } catch {}
  },

  /**
   * Simulate sending a message from a resident to the WhatsApp bot
   */
  async simulateUserMessage(
    text: string,
    options?: {
      reporterPhone?: string;
      reporterName?: string;
      organizationId?: string;
    }
  ): Promise<{
    routeResult: RouteComplaintResult;
    userMsg: SimulatedChatMessage;
    agentReplyMsg: SimulatedChatMessage;
  }> {
    const reporterPhone = options?.reporterPhone || '+919876543290';
    const reporterName = options?.reporterName || 'Resident Simulator';
    const now = new Date().toISOString();

    const userMsg: SimulatedChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      timestamp: now,
    };

    // Route complaint through our end-to-end engine
    const routeResult = await complaintRoutingService.processIncomingMessage({
      messageText: text,
      reporterPhone,
      reporterName,
      organizationId: options?.organizationId,
      source: 'Mock WhatsApp',
    });

    const agentReplyMsg: SimulatedChatMessage = {
      id: crypto.randomUUID(),
      sender: 'agent',
      text: routeResult.outgoingReply.messageText || routeResult.outgoingReply.text || '',
      timestamp: new Date().toISOString(),
      complaintReference: routeResult.complaint.reference,
      matchScore: routeResult.complaint.matchScore,
      matchReason: routeResult.complaint.matchReason,
      routingStatus: routeResult.complaint.routingStatus,
      recommendedContact: routeResult.assignment
        ? {
            name: (routeResult.complaint.matchReason || '').split(' ')[0] || 'Technician',
            role: String(routeResult.complaint.routingStatus || 'Assigned'),
            phone: routeResult.complaint.reporterPhone || '',
          }
        : undefined,
    };

    const currentHistory = this.getStoredSimulatedChat();
    const updated = [...currentHistory, userMsg, agentReplyMsg];
    this.saveStoredSimulatedChat(updated);

    return {
      routeResult,
      userMsg,
      agentReplyMsg,
    };
  },
};
