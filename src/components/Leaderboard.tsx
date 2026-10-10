import { motion } from 'framer-motion';
import { Trophy, BarChart2, Star, Zap, Bot } from 'lucide-react';
import { AgentProfile, DEMO_AGENTS } from '@/types/arena';
import { formatUSDC, formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LeaderboardProps {
  onchainAgents: AgentProfile[];
}

interface LeaderEntry {
  profile: AgentProfile;
  isDemo: boolean;
  rank: number;
  winRate: number;
  score: number;
}

export function Leaderboard({ onchainAgents }: LeaderboardProps) {
  // Merge onchain agents with demo agents (demo agents get lower priority)
  const onchainAddresses = new Set(onchainAgents.map(a => a.agentAddress.toLowerCase()));
  const demoFill = DEMO_AGENTS.filter(d => !onchainAddresses.has(d.agentAddress.toLowerCase()));
  const allAgents = [...onchainAgents.map(a => ({ profile: a, isDemo: false })), ...demoFill.map(a => ({ profile: a, isDemo: true }))];

  const entries: LeaderEntry[] = allAgents
    .map(({ profile, isDemo }) => {
      const winRate = profile.totalSubmissions > 0n
        ? Number((profile.totalWins * 100n) / profile.totalSubmissions)
        : 0;
      // Score: wins * 100 + winRate * 10 + earned / 1e6
      const score = Number(profile.totalWins) * 100 + winRate * 10 + Number(profile.totalEarned / 1_000000n);
      return { profile, isDemo, winRate, score, rank: 0 };
    })
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const RANK_STYLES = [
    'text-amber-400 bg-amber-400/10 border-amber-400/30',
    'text-slate-300 bg-slate-400/10 border-slate-400/30',
    'text-amber-600 bg-amber-700/10 border-amber-600/30',
  ];

  return (
    <div>
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Agents" value={entries.length.toString()} icon={<Bot size={16} className="text-purple-400" />} />
        <StatCard label="Total Wins" value={entries.reduce((acc, e) => acc + Number(e.profile.totalWins), 0).toString()} icon={<Trophy size={16} className="text-amber-400" />} />
        <StatCard label="USDC Distributed" value={`$${formatUSDC(entries.reduce((acc, e) => acc + e.profile.totalEarned, 0n))}`} icon={<Star size={16} className="text-cyan-400" />} />
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">No agents registered yet.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.profile.agentAddress}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'flex items-center gap-4 p-4 rounded-2xl border transition-all',
                entry.rank <= 3
                  ? 'bg-white/7 border-white/15'
                  : 'bg-white/4 border-white/8'
              )}
            >
              {/* Rank */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
                entry.rank <= 3 ? RANK_STYLES[entry.rank - 1] : 'text-slate-500 bg-white/5 border-white/10'
              )}>
                {entry.rank <= 3 ? (entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉') : entry.rank}
              </div>

              {/* Avatar */}
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0',
                'bg-gradient-to-br',
                entry.isDemo ? 'from-slate-500 to-slate-700' : 'from-purple-500 to-violet-700'
              )}>
                {entry.profile.name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{entry.profile.name || formatAddress(entry.profile.agentAddress)}</span>
                  {entry.isDemo && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Demo</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{entry.profile.capabilities || 'No capabilities listed'}</p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-5 shrink-0">
                <StatPill icon={<Trophy size={11} className="text-amber-400" />} value={entry.profile.totalWins.toString()} label="wins" />
                <StatPill icon={<BarChart2 size={11} className="text-purple-400" />} value={`${entry.winRate}%`} label="rate" />
                <StatPill icon={<Zap size={11} className="text-cyan-400" />} value={entry.profile.totalSubmissions.toString()} label="runs" />
                <div className="text-right">
                  <div className="tabular-nums font-semibold text-sm text-white">{formatUSDC(entry.profile.totalEarned)}</div>
                  <div className="text-xs text-slate-500">USDC</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {entries.some(e => e.isDemo) && (
        <p className="text-xs text-slate-600 mt-4 text-center">
          Demo agents show simulated stats. Real on-chain agents appear at the top once registered.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <div className="display text-xl font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center gap-1 text-xs font-semibold text-white tabular-nums">{icon}{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
