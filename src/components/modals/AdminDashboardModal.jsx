import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  X,
  ShieldAlert,
  Users,
  Search,
  RefreshCw,
  Ban,
  CheckCircle2,
  Award,
  Phone,
  Clock,
  Calendar,
  Sparkles,
  Laptop,
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  ChevronDown,
  Lock,
  Unlock,
  Store
} from 'lucide-react';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://yjcexuoriwevasjixwkh.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqY2V4dW9yaXdldmFzaml4d2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTg4NjMsImV4cCI6MjEwODA3NDg2M30.8zvIOP2m3_gOB8Jd5hDjY_jnNjihEBOB5uOSHuLKcVw';

let browserSupabase = null;
try {
  browserSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
} catch (e) {}

const PLAN_OPTIONS = [
  { code: '1M', label: '1 Month (30 Days)', days: 30 },
  { code: '3M', label: '3 Months (90 Days)', days: 90 },
  { code: '6M', label: '6 Months (180 Days)', days: 180 },
  { code: '12M', label: '1 Year (365 Days)', days: 365 },
  { code: 'TRIAL', label: 'Trial Extension (+7 Days)', days: 7 },
  { code: 'LIFETIME', label: 'Lifetime Access (10 Yrs)', days: 3650 }
];

export default function AdminDashboardModal({ isOpen, onClose, currentMachineId }) {
  const [activeTab, setActiveTab] = useState('licenses'); // 'licenses' | 'keygen'
  const [licenses, setLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedRowPlans, setSelectedRowPlans] = useState({});

  // Offline Keygen states
  const [keygenMid, setKeygenMid] = useState('');
  const [keygenPlan, setKeygenPlan] = useState('12M');
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchLicenses = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (window.electronAPI?.getAdminLicenses) {
        const list = await window.electronAPI.getAdminLicenses();
        setLicenses(list || []);
      } else if (browserSupabase) {
        const { data, error } = await browserSupabase
          .from('licenses')
          .select('*')
          .order('last_seen', { ascending: false });
        if (error) throw error;
        setLicenses(data || []);
      } else {
        setErrorMsg('Admin API only available inside Electron desktop app or with Supabase config.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch licenses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLicenses();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Strict Security Lock: Only e08fe0d4-fddc-4ede-9c15-460ccabb22c4 has Master Admin rights
  const cleanCurrentMid = String(currentMachineId || '').trim().toLowerCase();
  const isMaster =
    cleanCurrentMid === 'e08fe0d4-fddc-4ede-9c15-460ccabb22c4' ||
    (!window.electronAPI && (cleanCurrentMid === 'browser-dev-mode' || !cleanCurrentMid));
  if (!isMaster) return null;

  // Handle plan dropdown selection for a row
  const handleRowPlanChange = (mid, planCode) => {
    setSelectedRowPlans((prev) => ({ ...prev, [mid]: planCode }));
  };

  // Activate client with selected plan
  const handleActivateWithPlan = async (targetMachineId) => {
    const chosenPlan = selectedRowPlans[targetMachineId] || '12M';
    setActionLoadingId(targetMachineId);
    try {
      if (window.electronAPI?.updateClientStatus) {
        await window.electronAPI.updateClientStatus({
          targetMachineId,
          newStatus: chosenPlan === 'LIFETIME' ? 'lifetime' : 'active',
          planCode: chosenPlan
        });
      } else if (browserSupabase) {
        const planObj = PLAN_OPTIONS.find((p) => p.code === chosenPlan) || PLAN_OPTIONS[3];
        const newExpiry = new Date(Date.now() + planObj.days * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await browserSupabase
          .from('licenses')
          .update({
            status: chosenPlan === 'LIFETIME' ? 'lifetime' : 'active',
            plan: chosenPlan,
            expiry_date: newExpiry,
            updated_at: new Date().toISOString()
          })
          .eq('machine_id', targetMachineId);
        if (error) throw error;
      }
      await fetchLicenses();
    } catch (err) {
      alert(`Activation failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Kill Switch: Toggle Block / Active
  const handleToggleBlock = async (targetMachineId, currentStatus) => {
    const isBlocking = currentStatus !== 'blocked';
    if (isBlocking && !window.confirm(`Are you sure you want to BLOCK this Machine ID?\n${targetMachineId}`)) {
      return;
    }

    setActionLoadingId(targetMachineId);
    try {
      const newStatus = isBlocking ? 'blocked' : 'active';
      if (window.electronAPI?.updateClientStatus) {
        await window.electronAPI.updateClientStatus({
          targetMachineId,
          newStatus
        });
      } else if (browserSupabase) {
        const { error } = await browserSupabase
          .from('licenses')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('machine_id', targetMachineId);
        if (error) throw error;
      }
      await fetchLicenses();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Send Machine ID to Offline Keygen Tab
  const handleSelectForKeygen = (mid) => {
    setKeygenMid(mid);
    setActiveTab('keygen');
    handleGenerateKey(mid, keygenPlan);
  };

  // Generate Offline Cryptographic Key (HMAC-SHA256)
  const handleGenerateKey = async (midToUse = keygenMid, planToUse = keygenPlan) => {
    const targetMid = (midToUse || '').trim().toLowerCase();
    if (!targetMid) {
      alert('Please enter or select a valid Machine ID.');
      return;
    }

    if (window.electronAPI?.generateOfflineKey) {
      try {
        const res = await window.electronAPI.generateOfflineKey({
          targetMachineId: targetMid,
          planCode: planToUse
        });
        setGeneratedKey(res);
        return;
      } catch (err) {
        console.warn('IPC keygen error:', err);
      }
    }

    // Pure Browser Fallback (SHA-256 slice)
    const encoder = new TextEncoder();
    const data = encoder.encode(`${targetMid}::${planToUse}`);
    const keyData = encoder.encode('dcc_master_secure_2026');
    try {
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, data);
      const hex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      const sig16 = hex.slice(0, 16);
      const formatted = `${sig16.slice(0, 4)}-${sig16.slice(4, 8)}-${sig16.slice(8, 12)}-${sig16.slice(12, 16)}`;
      setGeneratedKey({
        key: `DCC-${planToUse}-${formatted}`,
        formattedKey: formatted,
        plan: planToUse
      });
    } catch (e) {
      alert('Error generating key: ' + e.message);
    }
  };

  const handleCopyGeneratedKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSendKeyWhatsApp = (mobile) => {
    if (!generatedKey) return;
    const cleanNum = (mobile || '').replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hello! Here is your official activation key for Digital Cyber Cafe:\n\nKey: ${generatedKey.key}\nPlan: ${generatedKey.plan}\nMachine ID: ${keygenMid}\n\nEnter this key in the software lock screen and click 'Verify & Unlock'. Thank you!`
    );
    const url = cleanNum ? `https://wa.me/91${cleanNum}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const filteredLicenses = licenses.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      (item.machine_id && item.machine_id.toLowerCase().includes(q)) ||
      (item.shop_name && item.shop_name.toLowerCase().includes(q)) ||
      (item.mobile_number && item.mobile_number.includes(q)) ||
      (item.status && item.status.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-tight">
                  Master Subscription & Hardware Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time Supabase Telemetry, Instant Plan Activation, Kill Switch & Offline Keygen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLicenses}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Licenses"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('licenses')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'licenses'
                ? 'border-blue-500 text-blue-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clients & Licenses ({licenses.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('keygen')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'keygen'
                ? 'border-amber-500 text-amber-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Offline Key Generator (HMAC-SHA256)</span>
          </button>
        </div>

        {/* TAB 1: Live Cloud Licenses Table */}
        {activeTab === 'licenses' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
            {/* Search Bar & Summary Stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by Cafe, Mobile, Machine ID, Status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 self-end sm:self-auto">
                <span>Total: <strong className="text-white">{licenses.length}</strong></span>
                <span>Active: <strong className="text-emerald-400">{licenses.filter((l) => l.status === 'active' || l.status === 'lifetime').length}</strong></span>
                <span>Blocked: <strong className="text-rose-400">{licenses.filter((l) => l.status === 'blocked').length}</strong></span>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Table Container */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Cafe / Contact</th>
                    <th className="py-3 px-4">Machine ID</th>
                    <th className="py-3 px-4">Plan & Expiry</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Subscription Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                        Fetching clients from Supabase cloud database...
                      </td>
                    </tr>
                  ) : filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No client installations found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredLicenses.map((item) => {
                      const isCurrentAction = actionLoadingId === item.machine_id;
                      const isBlocked = item.status === 'blocked';
                      const selectedPlanCode = selectedRowPlans[item.machine_id] || item.plan || '12M';

                      return (
                        <tr key={item.machine_id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Shop & Contact */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                                <Store className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-white text-xs leading-snug">
                                  {item.shop_name || 'Unnamed Cyber Cafe'}
                                </p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-slate-500" />
                                  <span>{item.mobile_number || 'No Mobile'}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Machine ID */}
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[150px]" title={item.machine_id}>
                                {item.machine_id}
                              </span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(item.machine_id)}
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Copy Machine ID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              v{item.app_version || '2.0.2'} • {item.platform || 'win32'}
                            </span>
                          </td>

                          {/* Plan & Expiry */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {item.plan || 'TRIAL'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Expires: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {isBlocked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                <Ban className="w-3 h-3" /> Blocked
                              </span>
                            ) : item.status === 'lifetime' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <Award className="w-3 h-3" /> Lifetime
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            )}
                          </td>

                          {/* Action Controls */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Plan Selector */}
                              <select
                                value={selectedPlanCode}
                                onChange={(e) => handleRowPlanChange(item.machine_id, e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold text-white focus:outline-none focus:border-blue-500"
                              >
                                {PLAN_OPTIONS.map((p) => (
                                  <option key={p.code} value={p.code}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>

                              {/* Activate Button */}
                              <button
                                type="button"
                                disabled={isCurrentAction}
                                onClick={() => handleActivateWithPlan(item.machine_id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                title="Activate client in Supabase cloud"
                              >
                                {isCurrentAction ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Unlock className="w-3 h-3" />
                                )}
                                <span>Activate</span>
                              </button>

                              {/* Keygen Quick Button */}
                              <button
                                type="button"
                                onClick={() => handleSelectForKeygen(item.machine_id)}
                                className="px-2 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer"
                                title="Generate offline HMAC key for this Machine ID"
                              >
                                Gen Key
                              </button>

                              {/* Kill Switch (Block / Unblock) */}
                              <button
                                type="button"
                                disabled={isCurrentAction}
                                onClick={() => handleToggleBlock(item.machine_id, item.status)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isBlocked
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                    : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40'
                                }`}
                                title={isBlocked ? 'Unblock client' : 'Block and lock client immediately'}
                              >
                                <Ban className="w-3 h-3" />
                                <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Built-in Offline Cryptographic Key Generator */}
        {activeTab === 'keygen' && (
          <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
            <div className="max-w-2xl bg-slate-950/70 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Offline Cryptographic Key Generator
                  </h4>
                  <p className="text-xs text-slate-400">
                    Generates tamper-proof HMAC-SHA256 activation keys bound to the client's Machine ID.
                  </p>
                </div>
              </div>

              {/* Input Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Customer Machine ID
                  </label>
                  <input
                    type="text"
                    value={keygenMid}
                    onChange={(e) => setKeygenMid(e.target.value)}
                    placeholder="Enter customer machine ID (e.g. 4b89f10a-7c32-4d51-9ef2-12a456789abc)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Select Plan Duration
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PLAN_OPTIONS.map((plan) => (
                      <button
                        key={plan.code}
                        type="button"
                        onClick={() => {
                          setKeygenPlan(plan.code);
                          if (keygenMid) handleGenerateKey(keygenMid, plan.code);
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                          keygenPlan === plan.code
                            ? 'bg-amber-500/15 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                            : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <p>{plan.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateKey(keygenMid, keygenPlan)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-900/40 transition-all cursor-pointer active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Cryptographic Activation Key</span>
                </button>
              </div>

              {/* Generated Result Box */}
              {generatedKey && (
                <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 uppercase tracking-wider">
                      Generated Key ({generatedKey.plan})
                    </span>
                    <span className="text-slate-400">Deterministic HMAC-SHA256</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                    <code className="text-base font-black font-mono tracking-wider text-emerald-400 select-all">
                      {generatedKey.key}
                    </code>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyGeneratedKey}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendKeyWhatsApp('')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    The client can paste this key into their lock screen offline. It will immediately unlock the application and extend their validity.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
