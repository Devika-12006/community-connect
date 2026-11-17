import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/authService';
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
  LogOut,
  AlertCircle,
  X,
  Lock,
  UserPlus,
  Check,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { validateResidentName, validateFlatNumber } from '../../lib/validationUtils';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    logout,
    isAuthenticated,
    currentRole,
    createResident,
    settings,
  } = useApp();

  const [dismissBanner, setDismissBanner] = useState(false);
  const flashMessage = location.state?.message;
  const isLoggedOut = location.state?.loggedOut;
  const isUnauthorized = location.state?.unauthorized;

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showResidentSetup, setShowResidentSetup] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const [resName, setResName] = useState('');
  const [resBlock, setResBlock] = useState(settings.blocks[0] || 'Block A');
  const [resFlat, setResFlat] = useState('');
  const [resType, setResType] = useState<'Owner' | 'Tenant' | 'Family Member'>('Owner');
  const [setupError, setSetupError] = useState('');
  const [resNameError, setResNameError] = useState<string | null>(null);
  const [resFlatError, setResFlatError] = useState<string | null>(null);

  // Enhanced Authentication System
  const [authTab, setAuthTab] = useState<'credentials' | 'register' | 'demo'>('credentials');

  // Credentials Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Resident Registration State
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regBlock, setRegBlock] = useState(settings.blocks[0] || 'Block A');
  const [regFlat, setRegFlat] = useState('');
  const [regResidentType, setRegResidentType] = useState<'Owner' | 'Tenant' | 'Family Member'>('Owner');
  const [regPhone, setRegPhone] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regNameError, setRegNameError] = useState<string | null>(null);
  const [regFlatError, setRegFlatError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Password Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const passwordStrength = useMemo(() => {
    return {
      length: regPassword.length >= 8,
      upper: /[A-Z]/.test(regPassword),
      number: /[0-9]/.test(regPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(regPassword),
    };
  }, [regPassword]);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await authService.login(loginIdentifier, loginPassword);
      if (!res.success) {
        setLoginError(res.error || 'Invalid credentials.');
        return;
      }
      login(res.role || 'Resident', res.residentId, res.workerId);
      setShowRoleModal(false);
      if (res.role === 'Manager') navigate('/manager/overview');
      else if (res.role === 'Worker') navigate('/worker/tasks');
      else navigate(targetRoute || '/resident/home');
    } catch (err: any) {
      setLoginError(err.message || 'Authentication error.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRegName(val);

    if (val.length === 0) {
      setRegNameError(null);
      return;
    }

    if (val.length > 30) {
      setRegNameError('Name cannot exceed 30 characters.');
      return;
    }

    if (!/^[A-Za-z ]+$/.test(val)) {
      setRegNameError('Name must contain only English alphabets (A–Z, a–z) and spaces. Numbers and special characters are not allowed.');
      return;
    }

    setRegNameError(null);
  };

  const handleRegNameBlur = () => {
    const trimmed = regName.trim();
    if (trimmed.length === 0) {
      setRegNameError('Name is mandatory.');
    } else {
      const check = validateResidentName(regName);
      if (!check.valid) {
        setRegNameError(check.error || 'Name must contain only English alphabets and spaces.');
      } else {
        setRegNameError(null);
      }
    }
  };

  const handleRegFlatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRegFlat(val);

    if (val.length === 0) {
      setRegFlatError(null);
      return;
    }

    if (val.length > 10) {
      setRegFlatError('Flat number cannot exceed 10 characters.');
      return;
    }

    if (/\s/.test(val)) {
      setRegFlatError('Spaces are not allowed. Only letters, numbers, hyphens (-), and forward slashes (/) are accepted. Examples: A-203, B/102, 1204.');
      return;
    }

    if (!/^[A-Za-z0-9/-]+$/.test(val)) {
      setRegFlatError('Flat number can only contain letters, numbers, hyphens (-), and forward slashes (/). Examples: A-203, B/102, 1204.');
      return;
    }

    setRegFlatError(null);
  };

  const handleRegFlatBlur = () => {
    const trimmed = regFlat.trim();
    if (trimmed.length === 0) {
      setRegFlatError('Flat number is mandatory.');
    } else {
      const check = validateFlatNumber(regFlat);
      if (!check.valid) {
        setRegFlatError(check.error || 'Flat number can only contain letters, numbers, hyphens (-), and forward slashes (/).');
      } else {
        setRegFlatError(null);
      }
    }
  };

  const handleResidentRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const nameCheck = validateResidentName(regName);
    const flatCheck = validateFlatNumber(regFlat);

    let hasValidationError = false;
    if (!nameCheck.valid) {
      setRegNameError(nameCheck.error || 'Name is mandatory and must contain only English alphabets and spaces (max 30 characters).');
      hasValidationError = true;
    } else {
      setRegNameError(null);
    }

    if (!flatCheck.valid) {
      setRegFlatError(flatCheck.error || 'Flat number is mandatory and can only contain letters, numbers, hyphens (-), and forward slashes (/) without spaces (max 10 characters).');
      hasValidationError = true;
    } else {
      setRegFlatError(null);
    }

    if (hasValidationError) {
      return;
    }

    if (!regUsername.trim() || !regEmail.trim()) {
      setRegError('Please complete all required fields.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }
    setIsRegistering(true);
    try {
      const res = await authService.registerResident({
        fullName: nameCheck.cleanValue!,
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
        block: regBlock,
        flatNumber: flatCheck.cleanValue!,
        residentType: regResidentType,
        phone: regPhone.trim() || undefined,
      });
      if (!res.success) {
        setRegError(res.error || 'Registration failed.');
        return;
      }
      login('Resident', res.residentId);
      setShowRoleModal(false);
      navigate(targetRoute || '/resident/home');
    } catch (err: any) {
      setRegError(err.message || 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);
    if (!resetIdentifier.trim()) {
      setResetError('Please enter your username.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setIsResetting(true);
    try {
      const res = await authService.resetPassword(resetIdentifier.trim(), resetNewPassword);
      if (!res.success) {
        setResetError(res.error || 'Password reset failed.');
        return;
      }
      setResetSuccess('Password has been successfully updated! You can now log in.');
    } catch (err: any) {
      setResetError(err.message || 'Reset error.');
    } finally {
      setIsResetting(false);
    }
  };

  const handle1ClickLogin = async (username: string, pass: string) => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await authService.login(username, pass);
      if (!res.success) {
        setLoginError(res.error || 'Login failed.');
        return;
      }
      login(res.role || 'Resident', res.residentId, res.workerId);
      setShowRoleModal(false);
      if (res.role === 'Manager') navigate('/manager/overview');
      else if (res.role === 'Worker') navigate('/worker/tasks');
      else navigate(targetRoute || '/resident/home');
    } catch {
      setLoginError('Error during 1-click login.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStartReport = () => {
    if (isAuthenticated) {
      navigate('/resident/report');
    } else {
      setTargetRoute('/resident/report');
      setShowRoleModal(true);
    }
  };

  const handleTrackComplaints = () => {
    if (isAuthenticated) {
      navigate('/resident/complaints');
    } else {
      setTargetRoute('/resident/complaints');
      setShowRoleModal(true);
    }
  };

  const handleResNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setResName(val);

    if (val.length === 0) {
      setResNameError(null);
      return;
    }

    if (val.length > 30) {
      setResNameError('Name cannot exceed 30 characters.');
      return;
    }

    if (!/^[A-Za-z ]+$/.test(val)) {
      setResNameError('Name must contain only English alphabets (A–Z, a–z) and spaces. Numbers and special characters are not allowed.');
      return;
    }

    setResNameError(null);
  };

  const handleResNameBlur = () => {
    const trimmed = resName.trim();
    if (trimmed.length === 0) {
      setResNameError('Name is mandatory.');
    } else {
      const check = validateResidentName(resName);
      if (!check.valid) {
        setResNameError(check.error || 'Name must contain only English alphabets and spaces.');
      } else {
        setResNameError(null);
      }
    }
  };

  const handleResFlatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setResFlat(val);

    if (val.length === 0) {
      setResFlatError(null);
      return;
    }

    if (val.length > 10) {
      setResFlatError('Flat number cannot exceed 10 characters.');
      return;
    }

    if (/\s/.test(val)) {
      setResFlatError('Spaces are not allowed. Only letters, numbers, hyphens (-), and forward slashes (/) are accepted. Examples: A-203, B/102, 1204.');
      return;
    }

    if (!/^[A-Za-z0-9/-]+$/.test(val)) {
      setResFlatError('Flat number can only contain letters, numbers, hyphens (-), and forward slashes (/). Examples: A-203, B/102, 1204.');
      return;
    }

    setResFlatError(null);
  };

  const handleResFlatBlur = () => {
    const trimmed = resFlat.trim();
    if (trimmed.length === 0) {
      setResFlatError('Flat number is mandatory.');
    } else {
      const check = validateFlatNumber(resFlat);
      if (!check.valid) {
        setResFlatError(check.error || 'Flat number can only contain letters, numbers, hyphens (-), and forward slashes (/).');
      } else {
        setResFlatError(null);
      }
    }
  };

  const handleResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    const nameCheck = validateResidentName(resName);
    const flatCheck = validateFlatNumber(resFlat);

    let hasError = false;
    if (!nameCheck.valid) {
      setResNameError(nameCheck.error || 'Name is mandatory and must contain only English alphabets and spaces (max 30 characters).');
      hasError = true;
    } else {
      setResNameError(null);
    }

    if (!flatCheck.valid) {
      setResFlatError(flatCheck.error || 'Flat number is mandatory and can only contain letters, numbers, hyphens (-), and forward slashes (/) without spaces (max 10 characters).');
      hasError = true;
    } else {
      setResFlatError(null);
    }

    if (hasError) {
      return;
    }

    try {
      const created = await createResident(nameCheck.cleanValue!, resBlock, flatCheck.cleanValue!, resType);
      login('Resident', created.id);
      setShowResidentSetup(false);
      navigate(targetRoute || '/resident/home');
    } catch {
      setSetupError('Unable to save profile in local storage.');
    }
  };

  const handleLogout = () => {
    logout();
    setDismissBanner(false);
    navigate('/', {
      replace: true,
      state: { loggedOut: true, message: 'You have been logged out successfully.' },
    });
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
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (currentRole === 'Manager') navigate('/manager/overview');
                    else if (currentRole === 'Worker') navigate('/worker/tasks');
                    else navigate('/resident/home');
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-800 hover:bg-teal-700 text-white text-sm font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Go to {currentRole} Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-700 text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  aria-label="Log out of current session"
                  title="Sign out of prototype session"
                >
                  <LogOut className="w-4 h-4 text-slate-500 hover:text-red-600" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTargetRoute(null);
                  setShowRoleModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-teal-800 hover:bg-teal-700 text-white text-sm font-semibold transition-all shadow-xs cursor-pointer"
              >
                Sign In / Select Role
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Post-Logout / Status Banner */}
      {flashMessage && !dismissBanner && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 w-full pt-4 animate-in fade-in duration-300">
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs ${
              isLoggedOut
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : isUnauthorized
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              {isLoggedOut ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <span className="text-sm font-semibold">{flashMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setDismissBanner(true)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-xl mx-auto">
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
              onClick={() => {
                if (isAuthenticated) navigate('/resident/assistant');
                else {
                  setTargetRoute('/resident/assistant');
                  setShowRoleModal(true);
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-teal-700" />
              <span>Resident AI Assistant</span>
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

      {/* Account & Role Selection Modal with Full Auth Capabilities */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false);
          setTargetRoute(null);
          setLoginError(null);
          setRegError(null);
        }}
        title="Community Connect Authentication"
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Auth Mode Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setAuthTab('credentials')}
              className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                authTab === 'credentials'
                  ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthTab('register')}
              className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                authTab === 'register'
                  ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Resident</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthTab('demo')}
              className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                authTab === 'demo'
                  ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Demo</span>
            </button>
          </div>

          {/* TAB 1: Credentials Login */}
          {authTab === 'credentials' && (
            <form onSubmit={handleCredentialsLogin} className="space-y-3.5 text-xs">
              <p className="text-slate-600 text-xs">
                Enter your username or email address and password to access your role portal.
              </p>

              {loginError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username or Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="e.g. manager or resident_devika"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
                  autoFocus
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs"
              >
                {isLoggingIn ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-slate-500 text-[11px]">
                Testing? Use the <button type="button" onClick={() => setAuthTab('demo')} className="text-teal-800 font-bold hover:underline">Quick Demo tab</button> for 1-click evaluator login.
              </div>
            </form>
          )}

          {/* TAB 2: Resident Registration */}
          {authTab === 'register' && (
            <form noValidate onSubmit={handleResidentRegistration} className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
              <p className="text-slate-600 text-xs">
                Register as a new community resident. Password hashing (SHA-256 with salt) and complexity rules are enforced.
              </p>

              {regError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regName}
                    maxLength={30}
                    onChange={handleRegNameChange}
                    onBlur={handleRegNameBlur}
                    placeholder="e.g. Priya Sharma"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:outline-none ${
                      regNameError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                        : 'border-slate-300 focus:ring-teal-700 focus:border-teal-700'
                    }`}
                    required
                  />
                  {regNameError && (
                    <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{regNameError}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. priya_s"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. priya@society.org"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Block / Wing <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={regBlock}
                    onChange={(e) => setRegBlock(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                  >
                    {settings.blocks.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Flat / Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regFlat}
                    maxLength={10}
                    onChange={handleRegFlatChange}
                    onBlur={handleRegFlatBlur}
                    placeholder="e.g. A-203, B/102, 1204"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:outline-none ${
                      regFlatError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                        : 'border-slate-300 focus:ring-teal-700 focus:border-teal-700'
                    }`}
                    required
                  />
                  {regFlatError && (
                    <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{regFlatError}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Resident Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={regResidentType}
                    onChange={(e) => setRegResidentType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Tenant">Tenant</option>
                    <option value="Family Member">Family Member</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 8 chars, mixed case"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Live Password Complexity Checklist */}
              {regPassword.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-[10px] text-slate-600 block uppercase tracking-wider">
                    Password Security Requirements:
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className={`flex items-center gap-1 ${passwordStrength.length ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {passwordStrength.length ? '✓' : '○'} At least 8 characters
                    </span>
                    <span className={`flex items-center gap-1 ${passwordStrength.upper ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {passwordStrength.upper ? '✓' : '○'} Uppercase letter
                    </span>
                    <span className={`flex items-center gap-1 ${passwordStrength.number ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {passwordStrength.number ? '✓' : '○'} Number (0-9)
                    </span>
                    <span className={`flex items-center gap-1 ${passwordStrength.special ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {passwordStrength.special ? '✓' : '○'} Special character (!@#$)
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs"
              >
                {isRegistering ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Resident Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Complete Resident Registration</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: 1-Click Evaluator Demo Accounts */}
          {authTab === 'demo' && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-950 text-xs">
                <strong>Evaluator Quick Sign-In:</strong> Click any card below to log in immediately with pre-configured credentials and inspect that role's experience.
              </div>

              {/* Manager Demo */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 hover:border-teal-700 transition-all flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Community Manager</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      User: <strong>manager</strong> • Pass: <strong>Manager@123</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handle1ClickLogin('manager', 'Manager@123')}
                  className="px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                >
                  Log In &rarr;
                </button>
              </div>

              {/* Worker Demo: Plumber */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-600 transition-all flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Senior Plumber (Rajesh Kumar)</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      User: <strong>worker_plumber</strong> • Pass: <strong>Worker@123</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handle1ClickLogin('worker_plumber', 'Worker@123')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                >
                  Log In &rarr;
                </button>
              </div>

              {/* Worker Demo: Electrician */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-600 transition-all flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Chief Electrician (Sunil Rao)</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      User: <strong>worker_electrician</strong> • Pass: <strong>Worker@123</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handle1ClickLogin('worker_electrician', 'Worker@123')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                >
                  Log In &rarr;
                </button>
              </div>

              {/* Resident Demo: Devika */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-600 transition-all flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Resident (Devika S - Block A, Flat 302)</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      User: <strong>resident_devika</strong> • Pass: <strong>Resident@123</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handle1ClickLogin('resident_devika', 'Resident@123')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                >
                  Log In &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetError(null);
          setResetSuccess(null);
        }}
        title="Reset Account Password"
        maxWidth="sm"
      >
        <form onSubmit={handlePasswordResetSubmit} className="space-y-3.5 text-xs">
          <p className="text-slate-600 text-xs">
            Enter your username to securely update your password with complexity verification.
          </p>

          {resetSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resetSuccess}</span>
            </div>
          )}

          {resetError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{resetError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={resetIdentifier}
              onChange={(e) => setResetIdentifier(e.target.value)}
              placeholder="e.g. manager or resident_devika"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Password (Min 8 chars, 1 uppercase, 1 number, 1 special) <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
              placeholder="Enter new strong password"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={resetConfirmPassword}
              onChange={(e) => setResetConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isResetting}
              className="px-4 py-1.5 text-xs bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-lg disabled:opacity-50"
            >
              Update Password
            </button>
          </div>
        </form>
      </Modal>

      {/* Resident Quick Setup Modal */}
      <Modal
        isOpen={showResidentSetup}
        onClose={() => setShowResidentSetup(false)}
        title="Setup Resident Profile"
        maxWidth="sm"
      >
        <form noValidate onSubmit={handleResidentSubmit} className="space-y-3.5">
          <p className="text-xs text-slate-600">
            Create a quick local resident profile to submit and track complaints.
          </p>

          {setupError && (
            <div className="text-xs text-red-600 font-medium p-2 bg-red-50 rounded border border-red-200">
              {setupError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={resName}
              maxLength={30}
              onChange={handleResNameChange}
              onBlur={handleResNameBlur}
              placeholder="e.g. John Doe"
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:outline-none ${
                resNameError
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-teal-700 focus:border-teal-700'
              }`}
              required
              autoFocus
            />
            {resNameError && (
              <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{resNameError}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Flat / Unit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={resFlat}
                maxLength={10}
                onChange={handleResFlatChange}
                onBlur={handleResFlatBlur}
                placeholder="e.g. A-203, B/102, 1204"
                className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:outline-none ${
                  resFlatError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-teal-700 focus:border-teal-700'
                }`}
                required
              />
              {resFlatError && (
                <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{resFlatError}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={resType}
                onChange={(e) => setResType(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              >
                <option value="Owner">Owner</option>
                <option value="Tenant">Tenant</option>
                <option value="Family Member">Family Member</option>
              </select>
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
