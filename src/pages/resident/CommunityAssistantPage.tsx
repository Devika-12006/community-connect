import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { communityAssistantService, type AssistantMessage } from '../../services/communityAssistantService';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Clock,
  ShieldAlert,
  HelpCircle,
  Droplet,
  Trash2,
  Phone,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SUGGESTED_QUESTIONS = [
  { text: 'When is domestic water supply available today?', icon: Droplet, category: 'Water' },
  { text: 'What is the door-to-door garbage collection schedule?', icon: Trash2, category: 'Sanitation' },
  { text: 'Who should I contact for a lift problem or entrapment?', icon: Phone, category: 'Lift Emergency' },
  { text: 'What is the current status of my complaint?', icon: FileText, category: 'My Complaints' },
  { text: 'What are the society quiet hours and noise rules?', icon: ShieldAlert, category: 'Rules' },
  { text: 'How do I reopen an unresolved complaint?', icon: HelpCircle, category: 'Help' },
];

export const CommunityAssistantPage: React.FC = () => {
  const { activeResident } = useApp();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Hello ${activeResident?.displayName || 'Resident'}! 👋\n\nI am your **Community Connect AI Assistant**. You can ask me factual questions about domestic water timings, waste disposal schedules, emergency contacts, society rules, or track your personal complaints in real time.\n\nHow can I help you today?`,
      timestamp: new Date().toISOString(),
      sources: ['Verified Community Knowledge Base'],
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q) return;

    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    try {
      // Simulate natural thinking delay (350ms)
      await new Promise((r) => setTimeout(r, 350));
      const response = await communityAssistantService.processQuery(q, activeResident, messages);
      setMessages((prev) => [...prev, response]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: 'I encountered an error retrieving community records. Please try again or contact the community manager.',
          timestamp: new Date().toISOString(),
          needsEscalation: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'msg-welcome-reset',
        sender: 'assistant',
        text: `Conversation cleared. What community information or complaint update would you like to check?`,
        timestamp: new Date().toISOString(),
        sources: ['Verified Community Knowledge Base'],
      },
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>AI Community Assistant</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live & Verified
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Query schedules, contacts, rules, and track your complaints with zero hallucinations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearHistory}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          title="Restart conversation"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">Reset Chat</span>
        </button>
      </div>

      {/* Suggested Questions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SUGGESTED_QUESTIONS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(item.text)}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 text-left transition-all shadow-xs cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 group-hover:text-blue-600 mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span>{item.category}</span>
              </div>
              <div className="text-xs font-semibold text-slate-700 group-hover:text-blue-950 line-clamp-2">
                {item.text}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chat Messages Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 min-h-[420px] max-h-[560px] overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>

                {/* Sources & Metadata for Assistant Messages */}
                {!isUser && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.sources && msg.sources.length > 0 && (
                        <>
                          <span className="mx-1">•</span>
                          <span>Source: {msg.sources.join(', ')}</span>
                        </>
                      )}
                    </div>

                    {msg.lastUpdated && (
                      <span className="text-slate-400">Verified: {new Date(msg.lastUpdated).toLocaleDateString()}</span>
                    )}
                  </div>
                )}

                {/* Quick Actions if returned */}
                {!isUser && msg.suggestedQuickActions && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                    {msg.suggestedQuickActions.map((action, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (action === 'Report Issue' || action === 'Report New Issue') {
                            window.location.href = '/resident/report';
                          } else if (action === 'View My Complaints' || action === 'View Complaint Details') {
                            window.location.href = '/resident/complaints';
                          } else {
                            handleSend(action);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-[11px] font-semibold text-blue-700 transition-colors cursor-pointer"
                      >
                        {action} &rarr;
                      </button>
                    ))}
                  </div>
                )}

                {/* Escalation Button if required */}
                {!isUser && msg.needsEscalation && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-[11px] text-amber-900">
                    <span>Need personal assistance from the Community Manager?</span>
                    <Link
                      to="/resident/complaints"
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold shrink-0"
                    >
                      Alert Manager
                    </Link>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3 items-center text-xs text-slate-400">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] text-slate-500 ml-1">Consulting verified records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask a question (e.g. When is water supply? How do I report a broken lift?)..."
          className="flex-1 px-3 py-2 text-xs rounded-lg border-0 focus:outline-hidden focus:ring-0 text-slate-800 placeholder-slate-400"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isTyping}
          className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
