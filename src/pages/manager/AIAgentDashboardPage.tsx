import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../db/repository';
import { aiComplaintService } from '../../services/aiComplaintService';
import { contactMatchingEngine, type MatchingResult } from '../../services/contactMatchingEngine';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import type {
  Complaint,
  Contact,
  AuthorizedGroupMessage,
  Organization,
  AIComplaintAnalysis,
} from '../../types';
import {
  Bot,
  Sparkles,
  PhoneCall,
  Users,
  ShieldCheck,
  ArrowRight,
  Send,
  Sliders,
  CheckCircle2,
  HelpCircle,
  FileText,
  Layers,
  AlertCircle,
} from 'lucide-react';

export const AIAgentDashboardPage: React.FC = () => {
  const { complaints } = useApp();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('org-rwa-1');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groupMessages, setGroupMessages] = useState<AuthorizedGroupMessage[]>([]);

  // Quick test bench state
  const [testText, setTestText] = useState('Urgent: Water tank overflow in Block B terrace causing dampness in top floor ceiling.');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testAnalysis, setTestAnalysis] = useState<AIComplaintAnalysis | null>(null);
  const [testMatch, setTestMatch] = useState<MatchingResult | null>(null);
  const [selectedInspectionComplaint, setSelectedInspectionComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedOrgId]);

  const loadData = async () => {
    const orgs = await repository.getOrganizations();
    setOrganizations(orgs);
    if (orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
    const conts = await repository.getContacts(selectedOrgId);
    setContacts(conts);
    const msgs = await repository.getGroupMessages(selectedOrgId);
    setGroupMessages(msgs);
  };

  // Run quick test analysis
  const handleRunTestBench = async () => {
    if (!testText.trim()) return;
    setIsAnalyzing(true);
    try {
      const analysis = await aiComplaintService.analyzeComplaint(testText);
      setTestAnalysis(analysis);
      const match = await contactMatchingEngine.matchContact(selectedOrgId, analysis);
      setTestMatch(match);
    } catch (err) {
      console.error('Error running test bench:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Evaluated complaints
  const aiEvaluatedComplaints = complaints;
  const autoRoutedCount = aiEvaluatedComplaints.filter((c) => (c.matchScore || 0) >= 70).length;
  const reviewRequiredCount = aiEvaluatedComplaints.filter(
    (c) => c.routingStatus === 'Requires Review' || c.needsClarification || c.status === 'Under Review'
  ).length;
  const verifiedContactsCount = contacts.filter((c) => c.verified && c.active).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5" /> AI Triage & Routing Engine Active
            </span>
            <span className="text-xs text-teal-300">v2.0 Architecture</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">AI Complaint Routing Agent</h1>
          <p className="text-xs sm:text-sm text-teal-100/90 mt-1 max-w-2xl">
            Automatically analyzes issue text, extracts severity and category, matches verified contacts from directory & community records, and provides explainable triage recommendations.
          </p>
        </div>
      </div>

      {/* Feature Limitation Notice */}
      <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">AI Advisory Notice:</span> AI categorization and worker matching suggestions are advisory. Community managers retain full authority to review, reassign, and override priority scoring.
        </div>
      </div>

      {/* Organization Switcher Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-700" />
          <span className="font-semibold text-slate-700">Active Organization Scope:</span>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:outline-teal-600"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.organizationType})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-slate-500">
          <Link
            to="/manager/contacts"
            className="hover:text-teal-700 font-medium flex items-center gap-1"
          >
            <Users className="w-3.5 h-3.5" /> Contacts Directory &rarr;
          </Link>
          <span>•</span>
          <Link
            to="/manager/group-messages"
            className="hover:text-teal-700 font-medium flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" /> Authorized Notices &rarr;
          </Link>
          <span>•</span>
          <Link
            to="/manager/integrations"
            className="hover:text-teal-700 font-medium flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" /> AI Settings &rarr;
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Evaluated</span>
            <PhoneCall className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-800">{aiEvaluatedComplaints.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Processed community issues</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">High Match (&ge;70%)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{autoRoutedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Directly matched contacts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Needs Attention</span>
            <HelpCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{reviewRequiredCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Review or clarification</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Verified Contacts</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-800">{verifiedContactsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Eligible for AI routing</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Group Notices</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">{groupMessages.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Authorized evidence records</div>
        </div>
      </div>

      {/* Interactive AI Routing Test Bench */}
      <div className="bg-white rounded-2xl border border-teal-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Live AI Routing Test Bench</h2>
              <p className="text-xs text-slate-500">
                Test how the AI categorizes, parses locations, and scores verified contacts for any message.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunTestBench}
            disabled={isAnalyzing}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isAnalyzing ? 'Analyzing...' : 'Test AI Match'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={2}
            placeholder="Type any community problem message..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-800 focus:outline-teal-600 focus:bg-white"
          />
        </div>

        {/* Test Result Display */}
        {testAnalysis && testMatch && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-3 border-b border-slate-200">
              <div>
                <span className="text-slate-400 font-medium">Extracted Category:</span>
                <div className="font-bold text-slate-800">{testAnalysis.category}</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Detected Location:</span>
                <div className="font-bold text-slate-800">{testAnalysis.location}</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Assessed Urgency:</span>
                <div>
                  <PriorityBadge priority={testAnalysis.urgency === 'Emergency' ? 'Urgent' : (testAnalysis.urgency as any)} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Routing Verdict:</span>
                <div
                  className={`font-bold ${
                    testMatch.routingStatus === 'Auto-Routed'
                      ? 'text-emerald-700'
                      : testMatch.routingStatus === 'Recommended'
                      ? 'text-teal-700'
                      : 'text-amber-700'
                  }`}
                >
                  {testMatch.routingStatus} ({testMatch.matchScore}%)
                </div>
              </div>
            </div>

            {testMatch.recommendedContact && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Top Match: {testMatch.recommendedContact.name} ({testMatch.recommendedContact.role})
                  </div>
                  <div className="text-emerald-800 text-xs mt-0.5">
                    {testMatch.matchReason}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-emerald-900 bg-white px-2 py-1 rounded border border-emerald-300">
                    {testMatch.recommendedContact.phoneNumber}
                  </span>
                </div>
              </div>
            )}

            {/* Candidates Score Table */}
            <div>
              <div className="font-semibold text-slate-700 mb-1.5">Scored Candidates Breakdown:</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 bg-white rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="p-2">Contact</th>
                      <th className="p-2">Department</th>
                      <th className="p-2">Category (40%)</th>
                      <th className="p-2">Location (30%)</th>
                      <th className="p-2">Role (20%)</th>
                      <th className="p-2">Notice (10%)</th>
                      <th className="p-2">Total Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {testMatch.candidates.map((cand) => (
                      <tr key={cand.contactId} className="hover:bg-slate-50">
                        <td className="p-2 font-medium text-slate-800">
                          {cand.contactName} ({cand.contactRole})
                        </td>
                        <td className="p-2 text-slate-500">{cand.department}</td>
                        <td className="p-2 font-mono">{cand.breakdown.categoryScore}/40</td>
                        <td className="p-2 font-mono">{cand.breakdown.locationScore}/30</td>
                        <td className="p-2 font-mono">{cand.breakdown.roleScore}/20</td>
                        <td className="p-2 font-mono">{cand.breakdown.evidenceScore}/10</td>
                        <td className="p-2 font-bold text-teal-800 font-mono">
                          {cand.totalScore}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ingested AI Complaints Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Recent AI-Classified Complaints</h2>
            <p className="text-xs text-slate-500">Live community complaints evaluated and triaged by the AI routing engine</p>
          </div>
          <Link
            to="/manager/complaints"
            className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
          >
            <span>All Complaints Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {aiEvaluatedComplaints.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Bot className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No complaints in database</p>
            <p className="mt-1">New resident reports will automatically appear here with AI categorization.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:px-4">Reference</th>
                  <th className="p-3 sm:px-4">Issue Summary</th>
                  <th className="p-3 sm:px-4">Location</th>
                  <th className="p-3 sm:px-4">Category</th>
                  <th className="p-3 sm:px-4">Match Score</th>
                  <th className="p-3 sm:px-4">Status</th>
                  <th className="p-3 sm:px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aiEvaluatedComplaints.slice(0, 10).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 sm:px-4 font-mono font-bold text-teal-800">
                      {c.reference}
                    </td>
                    <td className="p-3 sm:px-4">
                      <div className="font-medium text-slate-800 line-clamp-1">{c.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{c.description}</div>
                    </td>
                    <td className="p-3 sm:px-4 text-slate-600">{c.specificLocation || c.block || c.location}</td>
                    <td className="p-3 sm:px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {c.category}
                      </span>
                    </td>
                    <td className="p-3 sm:px-4">
                      {c.matchScore !== undefined ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.matchScore >= 70
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.matchScore >= 40
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.matchScore}%
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 sm:px-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="p-3 sm:px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedInspectionComplaint(c)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 font-medium transition-colors cursor-pointer"
                      >
                        Inspect AI Match
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complaint Inspection Modal */}
      {selectedInspectionComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-teal-800">
                  {selectedInspectionComplaint.reference}
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {selectedInspectionComplaint.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInspectionComplaint(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-700">Raw Description:</div>
                <div className="text-slate-800 leading-relaxed">
                  {selectedInspectionComplaint.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400">Reporter Phone:</span>
                  <div className="font-bold text-slate-800 font-mono">
                    {selectedInspectionComplaint.reporterPhone}
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400">Ingestion Source:</span>
                  <div className="font-bold text-slate-800">
                    {selectedInspectionComplaint.source}
                  </div>
                </div>
              </div>

              {selectedInspectionComplaint.matchReason && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    AI Explainable Match Reason:
                  </div>
                  <div className="text-emerald-800 leading-snug">
                    {selectedInspectionComplaint.matchReason}
                  </div>
                </div>
              )}

              {selectedInspectionComplaint.supportingMessageEvidence && (
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg space-y-1">
                  <div className="font-bold text-indigo-900 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-700" />
                    Cited Authorized Notices:
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-indigo-800">
                    {(Array.isArray(selectedInspectionComplaint.supportingMessageEvidence)
                      ? selectedInspectionComplaint.supportingMessageEvidence
                      : [selectedInspectionComplaint.supportingMessageEvidence]
                    ).map((ev: string, idx: number) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedInspectionComplaint(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
              >
                Close
              </button>
              <Link
                to={`/manager/complaints`}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs cursor-pointer"
              >
                Manage in Complaints Queue
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
