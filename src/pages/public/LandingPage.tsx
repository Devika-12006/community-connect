import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Camera,
  MapPin,
  Clock,
  UserCheck,
  CheckCircle,
  Star,
  ArrowRight,
  ShieldCheck,
  Users,
  Wrench,
  Building,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { residents, workers, setRole, createResident, settings } = useApp();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showResidentSetup, setShowResidentSetup] = useState(false);
  const [resName, setResName] = useState('');
  const [resBlock, setResBlock] = useState(settings.blocks[0] || 'Block A');
  const [resFlat, setResFlat] = useState('');
  const [setupError, setSetupError] = useState('');

  const handleStartReport = () => {
    if (residents.length > 0) {
      setRole('Resident', residents[0].id);
      navigate('/resident/report');
    } else {
      setShowResidentSetup(true);
    }
  };

  const handleTrackComplaints = () => {
    if (residents.length > 0) {
      setRole('Resident', residents[0].id);
      navigate('/resident/complaints');
    } else {
      setShowResidentSetup(true);
    }
  };

  const handleResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resName.trim()) {
      setSetupError('Please enter your full or display name.');
      return;
    }
    if (!resFlat.trim()) {
      setSetupError('Please enter your flat or house number.');
      return;
    }

    try {
      const created = await createResident(resName.trim(), resBlock, resFlat.trim());
      setRole('Resident', created.id);
      setShowResidentSetup(false);
      navigate('/resident/home');
    } catch {
      setSetupError('Unable to save profile in local storage.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center font-black shadow-xs">
              CC
            </div>
            <span className="font-extrabold text-lg text-teal-950 tracking-tight">Community Connect</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-teal-800 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-teal-800 transition-colors">Features</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRoleModal(true)}
              className="px-4 py-2 rounded-lg bg-teal-800 hover:bg-teal-700 text-white text-sm font-semibold transition-all shadow-xs cursor-pointer"
            >
              Enter Prototype
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 bg-gradient-to-b from-teal-50/50 via-white to-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100/80 text-teal-800 text-xs font-semibold uppercase tracking-wider mb-6 border border-teal-200">
            <Building className="w-3.5 h-3.5" />
            <span>Gated Community Maintenance Prototype</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight sm:leading-tight mb-6">
            A better community starts with one report.
          </h1>

          <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Report maintenance issues, follow updates, and help your community resolve problems faster.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              type="button"
              onClick={handleStartReport}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Report an Issue</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleTrackComplaints}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-sm font-bold border border-slate-300 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Track My Complaints</span>
            </button>
          </div>

          <div className="mt-8 text-xs text-slate-500">
            Notice: No login credentials needed. All demo records persist locally in your browser.
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">How It Works</h2>
            <p className="text-sm sm:text-base text-slate-600">
              Four streamlined steps ensure clear accountability from resident report to final manager verification.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '1',
                title: 'Report an issue',
                desc: 'Upload clear photos, tag the specific location, and describe what needs fixing.',
                icon: Camera,
              },
              {
                step: '2',
                title: 'Management assigns a worker',
                desc: 'Community managers triage priority and dispatch the qualified maintenance worker.',
                icon: UserCheck,
              },
              {
                step: '3',
                title: 'Track the progress',
                desc: 'Watch real-time status changes and progress notes as work gets underway.',
                icon: Clock,
              },
              {
                step: '4',
                title: 'Review the resolution',
                desc: 'Inspect worker completion photos, rate the quality, and confirm resolution.',
                icon: CheckCircle,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.step} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative">
                  <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-base mb-4 shadow-xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-1">
                    Step {card.step}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{card.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section id="features" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Designed for Community Living</h2>
            <p className="text-sm sm:text-base text-slate-600">
              Clear actions, honest status updates, and transparent accountability for residents, managers, and workers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Photo-based complaints',
                desc: 'Upload up to 3 high-resolution images stored locally in IndexedDB to show exactly where maintenance is needed.',
                icon: Camera,
              },
              {
                title: 'Location details',
                desc: 'Easily select building blocks, landmarks, or browser GPS coordinates for precise on-site identification.',
                icon: MapPin,
              },
              {
                title: 'Progress tracking',
                desc: 'Follow complete timestamped history through every phase: Submitted, Assigned, In Progress, and Resolved.',
                icon: Clock,
              },
              {
                title: 'Worker assignment',
                desc: 'Managers balance team workloads by matching reports with active worker specialties like Plumbing or Electrical.',
                icon: UserCheck,
              },
              {
                title: 'Completion evidence',
                desc: 'Workers must upload completion photos and notes before work can be marked resolved, ensuring verifiable repairs.',
                icon: CheckCircle,
              },
              {
                title: 'Resident feedback',
                desc: 'Residents review completion evidence, rate resolutions from 1 to 5 stars, or request reopening if defects remain.',
                icon: Star,
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center mb-4 border border-teal-100">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-10 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <div className="font-semibold text-slate-700">Community Connect Prototype</div>
            <div>Designed for gated residential communities to coordinate maintenance resolution.</div>
          </div>
          <div className="text-right text-slate-500">
            <div>Operates entirely within this browser session using local IndexedDB storage.</div>
            <div>Not affiliated with any municipal or government agency.</div>
          </div>
        </div>
      </footer>

      {/* Role Selection Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Enter Prototype"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Select a role to explore the prototype. You can switch roles at any time using the prototype switcher in the top bar.
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setShowRoleModal(false);
                if (residents.length > 0) {
                  setRole('Resident', residents[0].id);
                  navigate('/resident/home');
                } else {
                  setShowResidentSetup(true);
                }
              }}
              className="w-full p-4 rounded-xl border border-slate-200 hover:border-teal-600 bg-white hover:bg-teal-50/40 text-left transition-all flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">Resident Portal</div>
                <div className="text-xs text-slate-500">Report issues, track progress, rate service</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowRoleModal(false);
                setRole('Manager');
                navigate('/manager/overview');
              }}
              className="w-full p-4 rounded-xl border border-slate-200 hover:border-teal-600 bg-white hover:bg-teal-50/40 text-left transition-all flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">Community Manager Workspace</div>
                <div className="text-xs text-slate-500">Triage reports, assign workers, reports & settings</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowRoleModal(false);
                if (workers.length > 0) {
                  setRole('Worker', undefined, workers[0].id);
                  navigate('/worker/tasks');
                } else {
                  setRole('Manager');
                  navigate('/manager/workers');
                }
              }}
              className="w-full p-4 rounded-xl border border-slate-200 hover:border-teal-600 bg-white hover:bg-teal-50/40 text-left transition-all flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">Maintenance Worker Portal</div>
                <div className="text-xs text-slate-500">
                  {workers.length > 0 ? 'Execute assigned tasks & upload proof' : 'Requires worker creation from Manager portal first'}
                </div>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Resident Quick Setup Modal */}
      <Modal
        isOpen={showResidentSetup}
        onClose={() => setShowResidentSetup(false)}
        title="Setup Resident Profile"
        maxWidth="sm"
      >
        <form onSubmit={handleResidentSubmit} className="space-y-3.5">
          <p className="text-xs text-slate-600">
            Create a quick local resident profile to submit and track complaints.
          </p>

          {setupError && (
            <div className="text-xs text-red-600 font-medium p-2 bg-red-50 rounded border border-red-200">
              {setupError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
            <input
              type="text"
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Block / Building</label>
              <select
                value={resBlock}
                onChange={(e) => setResBlock(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              >
                {settings.blocks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Flat Number</label>
              <input
                type="text"
                value={resFlat}
                onChange={(e) => setResFlat(e.target.value)}
                placeholder="e.g. 302"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowResidentSetup(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-lg"
            >
              Continue to Portal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
