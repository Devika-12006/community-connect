import React, { useState, useEffect } from 'react';
import { repository } from '../../db/repository';
import { whatsappService } from '../../services/whatsappService';
import type { WhatsAppIntegrationConfig, Organization } from '../../types';
import {
  Sliders,
  Save,
  Phone,
  Bot,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

export const IntegrationSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppIntegrationConfig | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const cfg = await repository.getIntegrationConfig();
    setConfig(cfg);
    const orgs = await repository.getOrganizations();
    setOrganizations(orgs);
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await repository.saveIntegrationConfig(config);

    await repository.addAuditLog({
      id: crypto.randomUUID(),
      organizationId: config.defaultOrganizationId || 'org-rwa-1',
      actorId: 'manager',
      actorName: 'Community Manager',
      action: 'UPDATE_INTEGRATION_SETTINGS',
      recordType: 'INTEGRATION_CONFIG',
      recordId: config.id,
      details: {
        aiProvider: config.aiProvider,
        autoRoutingEnabled: config.autoRoutingEnabled,
        autoRoutingThreshold: config.autoRoutingThreshold,
      },
      createdAt: new Date().toISOString(),
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestWhatsApp = async () => {
    if (!config) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await whatsappService.sendWhatsAppMessage(
        '+919876543210',
        'Test message from Community Connect WhatsApp Integration.',
        config
      );
      if (res.success) {
        setTestResult({ success: true, message: 'Message sent successfully via Meta Cloud API!' });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Failed to dispatch Meta Cloud API message. Simulator mode is active.',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  if (!config) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const webhookUrl = `${currentOrigin}/api/whatsapp/webhook`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" /> AI & WhatsApp Settings
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Integration Configuration</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Meta Cloud API credentials, AI intelligence providers, and automatic dispatch thresholds.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Integration settings have been saved and applied immediately!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: AI Provider */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">AI Intelligence Provider</h2>
              <p className="text-xs text-slate-500">
                Choose between offline rule-based NLP extraction or external OpenAI model.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label
              className={`p-3.5 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                config.aiProvider === 'local'
                  ? 'border-teal-600 bg-teal-50/50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="aiProvider"
                checked={config.aiProvider === 'local'}
                onChange={() => setConfig({ ...config, aiProvider: 'local' })}
                className="mt-0.5 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Local NLP Engine (Zero Setup / Offline)
                </div>
                <p className="text-slate-500 text-[11px] mt-1 leading-snug">
                  Fast, deterministic keyword and regex categorization. Requires no API keys and runs instantly in browser and server memory.
                </p>
              </div>
            </label>

            <label
              className={`p-3.5 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                config.aiProvider === 'openai'
                  ? 'border-teal-600 bg-teal-50/50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="aiProvider"
                checked={config.aiProvider === 'openai'}
                onChange={() => setConfig({ ...config, aiProvider: 'openai' })}
                className="mt-0.5 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  OpenAI API (GPT-4o-mini / GPT-4o)
                </div>
                <p className="text-slate-500 text-[11px] mt-1 leading-snug">
                  Advanced reasoning, conversational understanding, and nuanced multilingual classification using OpenAI.
                </p>
              </div>
            </label>
          </div>

          {config.aiProvider === 'openai' && (
            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  value={config.openaiApiKey || ''}
                  onChange={(e) => setConfig({ ...config, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Model</label>
                <select
                  value={config.aiModel || 'gpt-4o-mini'}
                  onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Recommended - Fast & Cost-Effective)</option>
                  <option value="gpt-4o">gpt-4o (High Accuracy)</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Contact Matching & Auto-Routing Thresholds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Scoring & Dispatch Thresholds</h2>
              <p className="text-xs text-slate-500">
                Control the explainable matching algorithm (Category 40%, Location 30%, Role 20%, Group Evidence 10%).
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.autoRoutingEnabled}
                onChange={(e) => setConfig({ ...config, autoRoutingEnabled: e.target.checked })}
                className="rounded text-teal-600"
              />
              <span className="font-semibold text-slate-800">
                Enable Automatic Dispatch for High-Confidence Tickets
              </span>
            </label>

            <div>
              <div className="flex justify-between items-center mb-1 text-slate-700 font-medium">
                <span>Auto-Routing Threshold ({config.autoRoutingThreshold}%)</span>
                <span className="font-bold text-emerald-700">&ge; {config.autoRoutingThreshold}% match</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={config.autoRoutingThreshold}
                onChange={(e) =>
                  setConfig({ ...config, autoRoutingThreshold: parseInt(e.target.value, 10) })
                }
                className="w-full accent-teal-600"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Complaints scoring at or above this threshold will be automatically marked as Auto-Routed and assigned to the top verified technician.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 text-slate-700 font-medium">
                <span>Minimum Confidence Threshold ({config.minimumConfidenceThreshold}%)</span>
                <span className="font-bold text-amber-700">&lt; {config.minimumConfidenceThreshold}% triggers review</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                step="5"
                value={config.minimumConfidenceThreshold}
                onChange={(e) =>
                  setConfig({ ...config, minimumConfidenceThreshold: parseInt(e.target.value, 10) })
                }
                className="w-full accent-teal-600"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Complaints scoring below this threshold will be flagged as "Requires Review" and held in the manager review queue.
              </p>
            </div>

            <div className="pt-2">
              <label className="block text-slate-700 font-medium mb-1">Default Organization Scope</label>
              <select
                value={config.defaultOrganizationId}
                onChange={(e) => setConfig({ ...config, defaultOrganizationId: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 text-xs"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.organizationType})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: WhatsApp Cloud API Settings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 text-green-800 flex items-center justify-center font-bold">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Meta WhatsApp Business Cloud API</h2>
                <p className="text-xs text-slate-500">
                  Official WhatsApp Cloud API credentials for production phone numbers.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="rounded text-teal-600"
              />
              <span>Enable Real WhatsApp API</span>
            </label>
          </div>

          <div className="space-y-3 text-xs">
            {/* Webhook endpoint URL display */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Your Meta Cloud API Webhook URL (Callback URL)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-slate-100 border border-slate-300 rounded-lg p-2 font-mono text-[11px] text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(webhookUrl, 'webhook')}
                  className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedField === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'webhook' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Configure this URL in your Meta App Dashboard under WhatsApp &rarr; Configuration &rarr; Webhook.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Webhook Verify Token</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.whatsappVerifyToken || 'community_connect_verify_token'}
                  onChange={(e) => setConfig({ ...config, whatsappVerifyToken: e.target.value })}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px] focus:outline-teal-600 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(config.whatsappVerifyToken || 'community_connect_verify_token', 'token')}
                  className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedField === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'token' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={config.phoneNumberId || ''}
                  onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                  placeholder="e.g. 109876543210987"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px] focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">WhatsApp Business Account ID</label>
                <input
                  type="text"
                  value={config.businessAccountId || ''}
                  onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
                  placeholder="e.g. 209876543210987"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px] focus:outline-teal-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Permanent Meta Access Token</label>
              <input
                type="password"
                value={config.accessToken || ''}
                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                placeholder="EAA..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px] focus:outline-teal-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Meta App Secret (for HMAC verification)</label>
              <input
                type="password"
                value={config.appSecret || ''}
                onChange={(e) => setConfig({ ...config, appSecret: e.target.value })}
                placeholder="e.g. 98a7b6c5d4e3..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px] focus:outline-teal-600 focus:bg-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                disabled={isTesting}
                onClick={handleTestWhatsApp}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isTesting ? 'Testing...' : 'Test WhatsApp Connection'}</span>
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Save Settings
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}
              >
                <div className="font-bold">{testResult.success ? 'Success' : 'Notice'}</div>
                <div className="text-[11px] mt-0.5">{testResult.message}</div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
