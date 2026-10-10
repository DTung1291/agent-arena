import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2, Clock, Trophy, Bot, Activity } from 'lucide-react';
import { Challenge, Submission, DEMO_AGENTS, CHALLENGE_TYPE_LABELS } from '@/types/arena';
import { formatUSDC, formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LiveBattleProps {
  challenges: Challenge[];
  submissions: Submission[];
}

// Simulation events for demo battle
type BattleEvent = {
  id: string;
  type: 'submit' | 'verify' | 'settle' | 'claim';
  agentName: string;
  agentColor: string;
  message: string;
  timestamp: number;
  challengeTitle?: string;
};

const AGENT_COLORS = ['#a855f7', '#22d3ee', '#10b981'];
const AGENT_NAMES = ['NEXUS-7', 'CIPHER-X', 'ORACLE-3'];

function generateDemoEvents(challenges: Challenge[], submissions: Submission[]): BattleEvent[] {
  const events: BattleEvent[] = [];

  // Real submissions as events
  submissions.forEach((sub, i) => {
    const challenge = challenges.find(c => c.id === sub.challengeId);
    const agentIdx = i % 3;
    events.push({
      id: `sub-${sub.id}`,
      type: 'submit',
      agentName: AGENT_NAMES[agentIdx],
      agentColor: AGENT_COLORS[agentIdx],
      message: `Submitted solution to "${challenge?.title || 'Unknown'}"`,
      timestamp: Number(sub.submittedAt),
      challengeTitle: challenge?.title,
    });
    if (sub.isPassing) {
      events.push({
        id: `ver-${sub.id}`,
        type: 'verify',
        agentName: AGENT_NAMES[agentIdx],
        agentColor: AGENT_COLORS[agentIdx],
        message: `Submission VERIFIED — "${challenge?.title || 'Unknown'}"`,
        timestamp: Number(challenge?.verifiedAt ?? sub.submittedAt) + 60,
        challengeTitle: challenge?.title,
      });
    }
  });

  // Add simulated demo events
  const now = Math.floor(Date.now() / 1000);
  const demoEvents: BattleEvent[] = [
    { id: 'd1', type: 'submit', agentName: 'NEXUS-7', agentColor: '#a855f7', message: 'Computing SHA-256 hash of payload...', timestamp: now - 240 },
    { id: 'd2', type: 'submit', agentName: 'CIPHER-X', agentColor: '#22d3ee', message: 'Generating cryptographic proof...', timestamp: now - 180 },
    { id: 'd3', type: 'verify', agentName: 'NEXUS-7', agentColor: '#a855f7', message: 'Solution matches success criteria', timestamp: now - 120 },
    { id: 'd4', type: 'settle', agentName: 'NEXUS-7', agentColor: '#a855f7', message: 'Challenge settled — NEXUS-7 wins 50 USDC', timestamp: now - 60 },
    { id: 'd5', type: 'submit', agentName: 'ORACLE-3', agentColor: '#10b981', message: 'Validating structured JSON output...', timestamp: now - 30 },
    { id: 'd6', type: 'submit', agentName: 'CIPHER-X', agentColor: '#22d3ee', message: 'Executing deterministic code task...', timestamp: now - 10 },
  ];

  return [...events, ...demoEvents]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
}

export function LiveBattle({ challenges, submissions }: LiveBattleProps) {
  const [liveEvents, setLiveEvents] = useState<BattleEvent[]>([]);
  const [ticker, setTicker] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const base = generateDemoEvents(challenges, submissions);
    setLiveEvents(base);

    // Simulate live events every few seconds
    intervalRef.current = setInterval(() => {
      const agentIdx = Math.floor(Math.random() * 3);
      const types: BattleEvent['type'][] = ['submit', 'submit', 'submit', 'verify'];
      const msgs = [
        'Analyzing challenge criteria...',
        'Computing deterministic output hash...',
        'Submitting proof to chain...',
        'Validating solution against criteria...',
        'Running code output evaluation...',
        'Parsing structured JSON response...',
      ];
      const newEvent: BattleEvent = {
        id: `live-${Date.now()}`,
        type: types[Math.floor(Math.random() * types.length)],
        agentName: AGENT_NAMES[agentIdx],
        agentColor: AGENT_COLORS[agentIdx],
        message: msgs[Math.floor(Math.random() * msgs.length)],
        timestamp: Math.floor(Date.now() / 1000),
      };
      setLiveEvents(prev => [newEvent, ...prev].slice(0, 20));
      setTicker(t => t + 1);
    }, 3500);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges.length, submissions.length]); // intentionally excludes full arrays to avoid excessive resets

  // Agent activity scores
  const agentScores = AGENT_NAMES.map((name, i) => ({
    name,
    color: AGENT_COLORS[i],
    events: liveEvents.filter(e => e.agentName === name).length,
    verified: liveEvents.filter(e => e.agentName === name && e.type === 'verify').length,
  })).sort((a, b) => b.events - a.events);

  const openChallenges = challenges.filter(c => c.state === 0 || c.state === 1);

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-purple-500/5 border border-purple-500/20">
        <Activity size={15} className="text-purple-400 shrink-0 animate-pulse" />
        <p className="text-sm text-slate-300">
          Live Battle mixes real on-chain events with simulated demo activity.
          <span className="ml-1 text-xs text-slate-500">Simulated events are clearly not from the chain.</span>
        </p>
      </div>

      {/* Arena overview */}
      <div className="grid grid-cols-3 gap-3">
        {agentScores.map((agent, i) => (
          <motion.div
            key={agent.name}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
            animate={{ borderColor: ticker % 3 === i ? `${agent.color}44` : 'rgba(255,255,255,0.1)' }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${agent.color}88, ${agent.color}44)`, border: `1.5px solid ${agent.color}44` }}>
              {agent.name[0]}
            </div>
            <div className="text-sm font-semibold text-white">{agent.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              <span style={{ color: agent.color }} className="font-semibold">{agent.events}</span> events · <span className="text-emerald-400">{agent.verified}</span> verified
            </div>
          </motion.div>
        ))}
      </div>

      {/* Active challenges */}
      {openChallenges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Live Challenges</h3>
          <div className="space-y-2">
            {openChallenges.map(c => (
              <div key={c.id.toString()} className="flex items-center justify-between gap-3 p-3 bg-white/5 border border-white/8 rounded-xl">
                <div>
                  <span className="text-sm text-white font-medium">{c.title}</span>
                  <span className="ml-2 text-xs text-slate-500">{CHALLENGE_TYPE_LABELS[c.challengeType]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm text-purple-300 font-semibold">{formatUSDC(c.reward)} USDC</span>
                  <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                    {c.state === 0 ? 'OPEN' : 'REVIEWING'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live event feed */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-300">Live Feed</h3>
          <span className="text-xs text-slate-600 mono">{liveEvents.length} events</span>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {liveEvents.map(event => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -15, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3 p-2.5 rounded-xl bg-white/3 border border-white/5"
              >
                <EventIcon type={event.type} color={event.agentColor} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold" style={{ color: event.agentColor }}>{event.agentName}</span>
                  <span className="text-xs text-slate-400 ml-1.5">{event.message}</span>
                </div>
                <span className="text-xs text-slate-600 mono shrink-0">
                  {formatTimeAgo(event.timestamp)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function EventIcon({ type, color }: { type: BattleEvent['type']; color: string }) {
  const iconMap = {
    submit: <Zap size={12} />,
    verify: <CheckCircle2 size={12} />,
    settle: <Trophy size={12} />,
    claim: <Bot size={12} />,
  };
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}20`, color }}>
      {iconMap[type]}
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
