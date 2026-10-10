import { motion } from 'framer-motion';
import { Clock, Users, Trophy, ArrowRight, Zap, Code2, Database } from 'lucide-react';
import { Challenge, ChallengeType, CHALLENGE_TYPE_LABELS, CHALLENGE_STATE_LABELS, CHALLENGE_STATE_COLORS } from '@/types/arena';
import { formatUSDC, timeUntil, formatAddress, isExpired } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<ChallengeType, React.ReactNode> = {
  0: <Zap size={14} />,
  1: <Database size={14} />,
  2: <Code2 size={14} />,
};

const TYPE_COLORS: Record<ChallengeType, string> = {
  0: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  1: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  2: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

interface ChallengeCardProps {
  challenge: Challenge;
  onClick: () => void;
  index?: number;
}

export function ChallengeCard({ challenge, onClick, index = 0 }: ChallengeCardProps) {
  const expired = isExpired(challenge.deadline);
  const stateColor = CHALLENGE_STATE_COLORS[challenge.state];

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="w-full text-left group"
    >
      <div className="relative bg-white/5 hover:bg-white/8 border border-white/10 hover:border-purple-500/40 rounded-2xl p-5 transition-all duration-300 overflow-hidden">
        {/* Glow effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 group-hover:from-purple-600/5 to-transparent transition-all duration-500 rounded-2xl pointer-events-none" />

        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', TYPE_COLORS[challenge.challengeType])}>
              {TYPE_ICONS[challenge.challengeType]}
              {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
            </span>
            <span className={cn('text-xs font-semibold tracking-wide uppercase', stateColor)}>
              {CHALLENGE_STATE_LABELS[challenge.state]}
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="display text-lg font-bold text-white tabular-nums">
              {formatUSDC(challenge.reward)}
            </div>
            <div className="text-xs text-slate-400">USDC</div>
          </div>
        </div>

        {/* Title */}
        <h3 className="display text-base font-semibold text-white mb-1.5 leading-snug group-hover:text-purple-200 transition-colors">
          {challenge.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
          {challenge.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Users size={12} />
              <span className="tabular-nums">{challenge.submissionCount.toString()}/{challenge.maxSubmissions.toString()}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} className={expired && challenge.state === 0 ? 'text-red-400' : ''} />
              <span className={expired && challenge.state === 0 ? 'text-red-400' : ''}>
                {challenge.state === 0 ? timeUntil(challenge.deadline) : formatDeadlineShort(challenge.deadline)}
              </span>
            </span>
            {challenge.winner !== '0x0000000000000000000000000000000000000000' && (
              <span className="flex items-center gap-1 text-purple-400">
                <Trophy size={12} />
                <span className="mono">{formatAddress(challenge.winner)}</span>
              </span>
            )}
          </div>
          <ArrowRight size={14} className="text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </motion.button>
  );
}

function formatDeadlineShort(ts: bigint): string {
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
