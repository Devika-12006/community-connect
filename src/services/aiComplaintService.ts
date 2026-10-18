import type { AIComplaintAnalysis, ComplaintCategory, UrgencyLevel } from '../types';
import { repository } from '../db/repository';

export interface ParseOptions {
  organizationId?: string;
}

export const aiComplaintService = {
  /**
   * Determine urgency based on keywords
   */
  detectUrgency(text: string): UrgencyLevel {
    const lower = text.toLowerCase();
    if (
      lower.includes('emergency') ||
      lower.includes('sparking') ||
      lower.includes('spark') ||
      lower.includes('short circuit') ||
      lower.includes('shock') ||
      lower.includes('burst') ||
      lower.includes('flooding') ||
      lower.includes('fire') ||
      lower.includes('danger') ||
      lower.includes('hazardous')
    ) {
      return 'Emergency';
    }
    if (
      lower.includes('urgent') ||
      lower.includes('overflowing') ||
      lower.includes('asap') ||
      lower.includes('immediately') ||
      lower.includes('blocked') ||
      lower.includes('stink') ||
      lower.includes('severe')
    ) {
      return 'High';
    }
    if (
      lower.includes('since yesterday') ||
      lower.includes('flickering') ||
      lower.includes('not working') ||
      lower.includes('broken') ||
      lower.includes('damaged') ||
      lower.includes('delay')
    ) {
      return 'Medium';
    }
    return 'Low';
  },

  /**
   * Determine category based on keywords
   */
  detectCategory(text: string): { category: ComplaintCategory; confidence: number } {
    const lower = text.toLowerCase();

    // Electrical
    if (
      lower.includes('streetlight') ||
      lower.includes('street light') ||
      lower.includes('lamp post') ||
      lower.includes('pole light')
    ) {
      return { category: 'Streetlights', confidence: 0.95 };
    }
    if (
      lower.includes('electric') ||
      lower.includes('power') ||
      lower.includes('light') ||
      lower.includes('wire') ||
      lower.includes('fuse') ||
      lower.includes('meter') ||
      lower.includes('generator') ||
      lower.includes('spark') ||
      lower.includes('switch')
    ) {
      return { category: 'Common-Area Electrical', confidence: 0.9 };
    }

    // Plumbing / Water
    if (
      lower.includes('leak') ||
      lower.includes('pipe') ||
      lower.includes('water supply') ||
      lower.includes('tap') ||
      lower.includes('tank') ||
      lower.includes('dampness') ||
      lower.includes('seepage')
    ) {
      return { category: 'Water Leakage', confidence: 0.9 };
    }

    // Drainage
    if (
      lower.includes('drain') ||
      lower.includes('sewage') ||
      lower.includes('clog') ||
      lower.includes('manhole') ||
      lower.includes('gutter') ||
      lower.includes('waterlogging')
    ) {
      return { category: 'Drainage', confidence: 0.9 };
    }

    // Garbage / Sanitation
    if (
      lower.includes('garbage') ||
      lower.includes('trash') ||
      lower.includes('waste') ||
      lower.includes('bin') ||
      lower.includes('cleaning') ||
      lower.includes('stink') ||
      lower.includes('smell') ||
      lower.includes('litter')
    ) {
      return { category: 'Garbage', confidence: 0.92 };
    }

    // Roads & Potholes
    if (
      lower.includes('pothole') ||
      lower.includes('road') ||
      lower.includes('paver') ||
      lower.includes('walkway') ||
      lower.includes('asphalt') ||
      lower.includes('driveway') ||
      lower.includes('footpath') ||
      lower.includes('crack')
    ) {
      return { category: 'Roads and Potholes', confidence: 0.92 };
    }

    return { category: 'Other', confidence: 0.5 };
  },

  /**
   * Extract location from text
   */
  extractLocation(text: string): { location: string | null; confidence: number } {
    const patterns = [
      /\b(block\s*[a-z0-9]+)\b/i,
      /\b(flat\s*#?\s*\d+)\b/i,
      /\b(tower\s*[a-z0-9]+)\b/i,
      /\b(clubhouse|club house)\b/i,
      /\b(swimming pool|pool)\b/i,
      /\b(playground|children's park|park)\b/i,
      /\b(basement\s*(?:1|2|parking)?)\b/i,
      /\b(sector\s*\d+(?:\s*[a-z0-9\s]+road)?)\b/i,
      /\b(common grounds|main gate|security gate|entry gate)\b/i,
      /\b(corridor|staircase|lift lobby|lobby)\b/i,
      /\b(driveway|perimeter road|outer perimeter)\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Capitalize nicely
        const loc = match[0]
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return { location: loc, confidence: 0.85 };
      }
    }

    return { location: null, confidence: 0.2 };
  },

  /**
   * Extract keywords for evidence search
   */
  extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'for',
      'to', 'with', 'from', 'by', 'my', 'we', 'our', 'there', 'has', 'have',
      'been', 'please', 'help', 'sir', 'madam', 'complaint', 'issue', 'problem',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    return Array.from(new Set(words)).slice(0, 8);
  },

  /**
   * Generate an appropriate clarification question if information is missing
   */
  generateClarificationQuestion(
    text: string,
    category: ComplaintCategory,
    location: string | null
  ): string | null {
    if (!location) {
      return `Thank you for reaching out. To dispatch our maintenance team promptly, could you please specify the exact location (e.g., Block A, Clubhouse, or Tower number)?`;
    }

    if (text.trim().split(/\s+/).length < 4) {
      return `Could you provide a few more details about the ${category.toLowerCase()} issue so we can send the right technician with appropriate tools?`;
    }

    return null;
  },

  /**
   * Rule-based complaint analyzer (guaranteed fallback and local simulator)
   */
  analyzeLocal(text: string): AIComplaintAnalysis {
    const { category, confidence: catConfidence } = this.detectCategory(text);
    const { location, confidence: locConfidence } = this.extractLocation(text);
    const urgency = this.detectUrgency(text);
    const keywords = this.extractKeywords(text);
    const needsClarification = !location || text.trim().length < 15;
    const clarificationQuestion = needsClarification
      ? this.generateClarificationQuestion(text, category, location)
      : undefined;

    // Build title summary
    const shortText = text.trim().slice(0, 60);
    const summary = location
      ? `${category} reported at ${location}`
      : `${category} issue reported: "${shortText}${shortText.length >= 60 ? '...' : ''}"`;

    const overallConfidence = Math.round(
      ((catConfidence * 0.6 + locConfidence * 0.4) * 100)
    ) / 100;

    return {
      summary,
      description: text.trim(),
      category,
      location: location || 'Location unspecified',
      urgency,
      confidence: overallConfidence,
      extractedKeywords: keywords,
      needsClarification,
      clarificationQuestion: clarificationQuestion || undefined,
      sentiment: urgency === 'Emergency' || urgency === 'High' ? 'urgent' : 'neutral',
      reasoning: `Extracted category "${category}" (${Math.round(catConfidence * 100)}% match) and location "${location || 'unspecified'}" based on complaint message analysis.`,
    };
  },

  /**
   * Main analyzer: calls OpenAI API if configured, otherwise uses local intelligence
   */
  async analyzeComplaint(text: string, _options?: ParseOptions): Promise<AIComplaintAnalysis> {
    const config = await repository.getIntegrationConfig();

    if (config.aiProvider === 'openai' && config.openaiApiKey && config.openaiApiKey.startsWith('sk-')) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: config.aiModel || 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `You are an AI complaint triage assistant for Community Connect.
Extract JSON with fields:
- summary (string: brief title)
- description (string: clean description)
- category (one of: "Water Leakage", "Streetlights", "Garbage", "Roads and Potholes", "Common-Area Electrical", "Drainage", "Other")
- location (string: e.g. "Block B", "Clubhouse", or null if not found)
- urgency (one of: "Low", "Medium", "High", "Emergency")
- confidence (number: 0.0 to 1.0)
- extractedKeywords (array of strings)
- needsClarification (boolean: true if location or crucial detail is missing)
- clarificationQuestion (string or null: polite message asking user for missing info)
- sentiment (one of: "positive", "neutral", "frustrated", "urgent")
- reasoning (string: explanation of your classification)`,
              },
              {
                role: 'user',
                content: `Analyze this complaint message:\n"""${text}"""`,
              },
            ],
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.choices[0].message.content);
          return {
            summary: parsed.summary || 'Complaint',
            description: parsed.description || text,
            category: parsed.category || 'Other',
            location: parsed.location || 'Location unspecified',
            urgency: parsed.urgency || 'Medium',
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
            extractedKeywords: Array.isArray(parsed.extractedKeywords) ? parsed.extractedKeywords : [],
            needsClarification: !!parsed.needsClarification,
            clarificationQuestion: parsed.clarificationQuestion || undefined,
            sentiment: parsed.sentiment || 'neutral',
            reasoning: parsed.reasoning || 'Classified via OpenAI.',
          };
        }
      } catch (err) {
        console.warn('OpenAI API call failed, falling back to local NLP engine:', err);
      }
    }

    // Default to local engine
    return this.analyzeLocal(text);
  },
};
