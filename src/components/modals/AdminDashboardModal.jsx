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
  Laptop
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yjcexuoriwevasjixwkh.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqY2V4dW9yaXdldmFzaml4d2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTg4NjMsImV4cCI6MjEwODA3NDg2M30.8zvIOP2m3_gOB8Jd5hDjY_jnNjihEBOB5uOSHuLKcVw';

let browserSupabase = null;
try {
  browserSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
} catch (e) {}

export default function AdminDashboardModal({ isOpen, onClose, currentMachineId }) {
  const [licenses, setLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchLicenses = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (window.electronAPI?.getAdminLicenses) {
        const list = await window.electronAPI.getAdminLicenses();
        setLicenses(list || []);
      } else if (browserSupabase) {
        // Direct browser query
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

  const handleToggleBlock = async (targetMachineId, currentStatus) => {
    setActionLoadingId(targetMachineId);
    try {
      const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
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

  const handleGrantLifetime = async (targetMachineId) => {
    if (!window.confirm('Grant Lifetime Pro license to this client?')) return;
    setActionLoadingId(targetMachineId);
    try {
      if (window.electronAPI?.updateClientStatus) {
        await window.electronAPI.updateClientStatus({
          targetMachineId,
          newStatus: 'lifetime'
        });
      } else if (browserSupabase) {
        const { error } = await browserSupabase
          .from('licenses')
          .update({
            status: 'lifetime',
            plan: 'LIFETIME',
            expiry_date: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
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

  const filtered = licenses.filter((lic) => {
    const q = searchQuery.toLowerCase();
    return (
      (lic.shop_name && lic.shop_name.toLowerCase().includes(q)) ||
      (lic.mobile_number && lic.mobile_number.includes(q)) ||
      (lic.machine_id && lic.machine_id.toLowerCase().includes(q)) ||
      (lic.status && lic.status.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none no-print animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-4xl shadow-2xl shadow-amber-500/10 overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20">
              <ShieldAlert className="w-5 h-5 font-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-wide text-white">
                  MASTER HARDWARE ADMIN PANEL
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 border border-emerald-400 text-emerald-300">
                  SECURE &bull; ZERO BYPASS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live Supabase client monitoring &amp; instant hardware blocking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLicenses}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Client List"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-white/10 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Shop Name, WhatsApp, or Machine ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Total Registered: <strong className="text-white">{licenses.length}</strong></span>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-xs gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Querying secure Supabase database...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-12 text-slate-400 text-xs">
              No registered client records found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((item) => {
                const isItemBlocked = item.status === 'blocked';
                const isLifetime = item.status === 'lifetime' || item.plan === 'LIFETIME';
                const isMasterSelf = item.machine_id === currentMachineId;
                const isActionLoading = actionLoadingId === item.machine_id;

                const installStr = item.created_at || item.install_date
                  ? new Date(item.created_at || item.install_date).toLocaleDateString()
                  : 'N/A';
                const expiryStr = item.expiry_date
                  ? new Date(item.expiry_date).toLocaleDateString()
                  : '21 Days';
                const lastSeenStr = item.last_seen
                  ? new Date(item.last_seen).toLocaleString()
                  : 'Active';

                return (
                  <div
                    key={item.machine_id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                      isItemBlocked
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : isMasterSelf
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">
                          {item.shop_name || 'Unnamed Shop'}
                        </span>

                        {isMasterSelf ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                            YOU (MASTER ADMIN)
                          </span>
                        ) : isItemBlocked ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            BLOCKED
                          </span>
                        ) : isLifetime ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            PRO LIFETIME
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ACTIVE TRIAL
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-cyan-300">
                          <Phone className="w-3 h-3" />
                          {item.mobile_number || 'No WhatsApp'}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-slate-300">
                          <Laptop className="w-3 h-3 text-slate-400" />
                          {item.machine_id}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Installed: {installStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Expiry: {expiryStr}
                        </span>
                        <span>Last Active: {lastSeenStr}</span>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {!isMasterSelf && (
                      <div className="flex items-center gap-2 shrink-0">
                        {!isLifetime && (
                          <button
                            onClick={() => handleGrantLifetime(item.machine_id)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="Upgrade client to Lifetime Pro"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Make Pro</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleBlock(item.machine_id, item.status)}
                          disabled={isActionLoading}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isItemBlocked
                              ? 'bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-400 text-emerald-300'
                              : 'bg-rose-600/30 hover:bg-rose-600/50 border-rose-400 text-rose-300'
                          }`}
                        >
                          {isItemBlocked ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Unblock</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Block Client</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950 flex items-center justify-between text-[11px] text-slate-500">
          <span>Target Database: Supabase `licenses` table</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all cursor-pointer"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
