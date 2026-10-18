import React, { useState, useEffect, useRef } from 'react';
import {
  whatsappService,
  SAMPLE_WHATSAPP_PRESETS,
  type SimulatedChatMessage,
} from '../../services/whatsappService';
import {
  Send,
  X,
  Bot,
  Sparkles,
  Info,
  CheckCheck,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface WhatsAppSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOrganizationId?: string;
}

export const WhatsAppSimulatorModal: React.FC<WhatsAppSimulatorModalProps> = ({
  isOpen,
  onClose,
  defaultOrganizationId = 'org-rwa-1',
}) => {
  const [messages, setMessages] = useState<SimulatedChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [senderPhone, setSenderPhone] = useState('+91 98765 43290');
  const [senderName, setSenderName] = useState('Resident Priya');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const history = whatsappService.getStoredSimulatedChat();
      if (history.length === 0) {
        // Add welcome message from bot
        const welcome: SimulatedChatMessage = {
          id: 'welcome-1',
          sender: 'agent',
          text: 'Hello! I am the Community Connect WhatsApp AI Agent.\n\nYou can report any community issues (water leaks, broken streetlights, potholes, garbage, drainage) directly in this chat. Our AI will analyze the problem, cross-reference verified maintenance contacts & official notices, and route your ticket immediately!',
          timestamp: new Date().toISOString(),
        };
        whatsappService.saveStoredSimulatedChat([welcome]);
        setMessages([welcome]);
      } else {
        setMessages(history);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    setInputText('');
    setIsProcessing(true);

    try {
      const result = await whatsappService.simulateUserMessage(text, {
        reporterPhone: senderPhone,
        reporterName: senderName,
        organizationId: defaultOrganizationId,
      });

      setMessages(whatsappService.getStoredSimulatedChat());
      // Auto expand trace on latest reply
      setExpandedTraceId(result.agentReplyMsg.id);
    } catch (err) {
      console.error('Failed to simulate WhatsApp message:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearHistory = () => {
    whatsappService.clearSimulatedChat();
    const welcome: SimulatedChatMessage = {
      id: 'welcome-reset',
      sender: 'agent',
      text: 'Chat history cleared. How can I assist you with your community today?',
      timestamp: new Date().toISOString(),
    };
    whatsappService.saveStoredSimulatedChat([welcome]);
    setMessages([welcome]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      {/* Phone container */}
      <div className="relative w-full max-w-md sm:max-w-lg h-[92vh] max-h-[780px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border-4 border-slate-800">
        {/* WhatsApp App Bar */}
        <header className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-white border-2 border-emerald-400">
                <Bot className="w-5 h-5 text-emerald-200" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-emerald-700 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-sm leading-tight">
                <span>Community Connect AI</span>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="text-[11px] text-emerald-200">Official Complaint Hotline • Online</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear chat history"
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-full transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Sender details bar for testing */}
        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-emerald-800">Simulating as:</span>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="bg-white border border-emerald-200 rounded px-1.5 py-0.5 text-xs font-semibold text-emerald-950 w-28 focus:outline-emerald-500"
              title="Sender name"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              className="bg-white border border-emerald-200 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-950 w-32 focus:outline-emerald-500"
              title="Sender phone"
            />
          </div>
        </div>

        {/* Quick Scenario Preset Chips */}
        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 overflow-x-auto whitespace-nowrap flex gap-1.5 text-xs shrink-0 scrollbar-none">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 py-1 pl-1">
            <Zap className="w-3 h-3 text-amber-500" /> Test:
          </span>
          {SAMPLE_WHATSAPP_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isProcessing}
              onClick={() => handleSend(p.text)}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 font-medium transition-colors shrink-0 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50">
          {/* Privacy badge */}
          <div className="flex justify-center">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-[11px] max-w-xs text-center shadow-2xs flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Simulated WhatsApp Cloud API environment. All routing and data are live.</span>
            </div>
          </div>

          {messages.map((m) => {
            const isUser = m.sender === 'user';
            const isTraceExpanded = expandedTraceId === m.id;

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                <div
                  className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-xs ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  {/* Sender label */}
                  {!isUser && (
                    <div className="text-[10px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Community Connect AI
                    </div>
                  )}

                  {/* Message body */}
                  <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

                  {/* Bottom info: Ticket reference & timestamp */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1.5 text-[10px] ${
                      isUser ? 'text-emerald-200' : 'text-slate-400'
                    }`}
                  >
                    <span>
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isUser && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
                  </div>
                </div>

                {/* AI Explainability & Ticket Card for Agent message */}
                {!isUser && m.complaintReference && (
                  <div className="w-full max-w-[88%] mt-1.5 ml-1">
                    <div className="bg-white border border-emerald-200 rounded-xl p-2.5 shadow-2xs text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-emerald-800">
                            Ticket #{m.complaintReference}
                          </span>
                          {m.matchScore !== undefined && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {m.matchScore}% match
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedTraceId(isTraceExpanded ? null : m.id)}
                          className="text-[11px] text-teal-700 hover:text-teal-900 font-medium flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isTraceExpanded ? 'Hide' : 'Explain'} Trace</span>
                          {isTraceExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Expanded Decision Explanation Trace */}
                      {isTraceExpanded && (
                        <div className="pt-1 text-[11px] space-y-1.5 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-teal-600" />
                            AI Scoring & Decision Trace:
                          </div>
                          <div className="text-slate-700 leading-snug">{m.matchReason}</div>
                          <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400">Category (40%):</span> Verified
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400">Location (30%):</span> Serviced
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400">Role (20%):</span> Qualified
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400">Notices (10%):</span> Cited
                            </div>
                          </div>
                          <div className="pt-1 flex justify-end">
                            <Link
                              to="/manager/complaints"
                              onClick={onClose}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 underline"
                            >
                              <span>View in Manager Dashboard</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-2xl rounded-tl-xs border border-slate-200 shadow-xs max-w-[65%] text-xs text-slate-500">
              <Bot className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>AI analyzing message & matching contacts...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <footer className="bg-white p-3 border-t border-slate-200 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Type a complaint message in WhatsApp..."
            disabled={isProcessing}
            className="flex-1 bg-slate-100 border border-slate-300 rounded-full px-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-emerald-600 focus:bg-white transition-colors"
          />
          <button
            type="button"
            disabled={!inputText.trim() || isProcessing}
            onClick={() => handleSend()}
            className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </footer>
      </div>
    </div>
  );
};
