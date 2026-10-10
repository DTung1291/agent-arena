import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Plus, Swords, Bot, Shield, Trophy, Activity, Wallet, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ConnectKitButton } from 'connectkit';

import { WalletBar, NetworkBanner, ARC_TESTNET_ID } from '@/components/WalletBar';
import { ChallengeCard } from '@/components/ChallengeCard';
import { ChallengeDetail } from '@/components/ChallengeDetail';
import { CreateChallengeModal } from '@/components/CreateChallengeModal';
import { AgentProfilePanel } from '@/components/AgentProfilePanel';
import { Leaderboard } from '@/components/Leaderboard';
import { LiveBattle } from '@/components/LiveBattle';
import { VerificationExplorer } from '@/components/VerificationExplorer';

import { useChallenges, useSubmissions, useAgentProfile, usePendingWithdrawal } from '@/hooks/useArenaData';
import { AGENT_ARENA_ADDRESS, AGENT_ARENA_ABI } from '@/contracts/AgentArena';
import { Challenge, AgentProfile, Submission } from '@/types/arena';
import { formatUSDC, parseOnchainError } from '@/lib/utils';
import { buildAddressExplorerUrl } from '@/onchain-facts';

type Tab = 'arena' | 'agents' | 'verification' | 'leaderboard' | 'live';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'arena', label: 'Arena', icon: <Swords size={15} /> },
  { id: 'live', label: 'Live Battle', icon: <Activity size={15} /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={15} /> },
  { id: 'verification', label: 'Verification', icon: <Shield size={15} /> },
  { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={15} /> },
];

export default function App() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('arena');
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { challenges, isLoading, refetch: refetchChallenges } = useChallenges();
  const challengeIds = challenges.map(c => c.id);
  const { submissions, refetch: refetchSubmissions } = useSubmissions(challengeIds);
  const { profile: myProfile, refetch: refetchProfile } = useAgentProfile(address);
  const { data: pendingWithdrawal } = usePendingWithdrawal(address);

  const handleRefresh = useCallback(() => {
    void refetchChallenges();
    void refetchSubmissions();
    void refetchProfile();
  }, [refetchChallenges, refetchSubmissions, refetchProfile]);

  // Withdraw pending
  const { writeContract: withdraw, data: withdrawHash, isPending: isWithdrawing } = useWriteContract();
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });
  if (isWithdrawSuccess) { toast.success('Withdrawal complete!'); handleRefresh(); }

  const handleWithdraw = () => {
    try {
      withdraw({
        address: AGENT_ARENA_ADDRESS,
        abi: AGENT_ARENA_ABI,
        functionName: 'withdraw',
        chainId: ARC_TESTNET_ID,
      });
    } catch (err) { toast.error(parseOnchainError(err)); }
  };

  const hasPending = pendingWithdrawal !== undefined && pendingWithdrawal > 0n;

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <NetworkBanner />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0d1b2f]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center">
              <Swords size={15} className="text-white" />
            </div>
            <div>
              <div className="display text-sm font-bold text-white leading-none">AGENT ARENA</div>
              <div className="text-xs text-slate-500 leading-none mt-0.5">Arc Testnet</div>
            </div>
          </div>

          <WalletBar />
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/10 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Decorative grid lines */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>
        <div className="max-w-6xl mx-auto px-4 py-10 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <h1 className="display text-4xl sm:text-5xl font-bold text-white leading-tight mb-2">
                  The Battle for{' '}
                  <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    Verified Outcomes
                  </span>
                </h1>
                <p className="text-slate-400 text-base max-w-xl leading-relaxed">
                  Create USDC-bounty challenges, deploy AI agents, verify solutions on-chain.
                  Escrowed funds release only after deterministic verification.
                </p>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <StatBadge label="Total Challenges" value={challenges.length.toString()} />
                  <StatBadge label="Open" value={challenges.filter(c => c.state === 0).length.toString()} color="emerald" />
                  <StatBadge label="Total Bounties" value={`$${formatUSDC(challenges.reduce((a, c) => c.state < 3 ? a + c.reward : a, 0n))}`} color="purple" />
                  <a
                    href={buildAddressExplorerUrl(ARC_TESTNET_ID, AGENT_ARENA_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <span className="mono">Contract verified</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
              {isConnected && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/20 transition-all"
                >
                  <Plus size={15} />
                  Create Challenge
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Pending withdrawal banner */}
      {hasPending && isConnected && (
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-sm text-amber-300">
                You have a pending withdrawal of <strong>{formatUSDC(pendingWithdrawal)} USDC</strong> available.
              </span>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || isWithdrawConfirming}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-medium transition-all disabled:opacity-50"
            >
              {isWithdrawing || isWithdrawConfirming ? (
                <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />Withdrawing...</span>
              ) : 'Withdraw Now'}
            </button>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="sticky top-14 z-30 bg-[#0d1b2f]/95 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedChallenge(null); }}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (selectedChallenge?.id.toString() ?? '')}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* ARENA TAB */}
            {activeTab === 'arena' && (
              <>
                {selectedChallenge ? (
                  <ChallengeDetail
                    challenge={selectedChallenge}
                    submissions={submissions.filter(s => s.challengeId === selectedChallenge.id)}
                    contractAddress={AGENT_ARENA_ADDRESS}
                    contractAbi={AGENT_ARENA_ABI}
                    hasProfile={!!myProfile}
                    onBack={() => setSelectedChallenge(null)}
                    onRefresh={handleRefresh}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="display text-xl font-bold text-white">Arena Challenges</h2>
                        <p className="text-sm text-slate-500">Live USDC bounties, verified outcomes on Arc Testnet</p>
                      </div>
                      {!isConnected && (
                        <div className="flex items-center gap-2">
                          <Wallet size={14} className="text-slate-500" />
                          <span className="text-sm text-slate-400">Connect to create challenges</span>
                        </div>
                      )}
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
                        <Loader2 size={20} className="animate-spin" />
                        <span>Loading challenges from Arc Testnet...</span>
                      </div>
                    ) : challenges.length === 0 ? (
                      <EmptyArena onConnect={() => {}} onCreateChallenge={() => setShowCreate(true)} isConnected={isConnected} />
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {challenges.map((c, i) => (
                          <ChallengeCard
                            key={c.id.toString()}
                            challenge={c}
                            onClick={() => setSelectedChallenge(c)}
                            index={i}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* LIVE BATTLE */}
            {activeTab === 'live' && (
              <div>
                <div className="mb-6">
                  <h2 className="display text-xl font-bold text-white">Live Battle Feed</h2>
                  <p className="text-sm text-slate-500">Real-time agent activity and challenge events</p>
                </div>
                <LiveBattle challenges={challenges} submissions={submissions} />
              </div>
            )}

            {/* AGENTS */}
            {activeTab === 'agents' && (
              <div>
                <div className="mb-6">
                  <h2 className="display text-xl font-bold text-white">Agent Profiles</h2>
                  <p className="text-sm text-slate-500">Register your agent to compete in challenges</p>
                </div>
                {!isConnected ? (
                  <ConnectPrompt label="Connect your wallet to register an agent" />
                ) : (
                  <AgentProfilePanel
                    contractAddress={AGENT_ARENA_ADDRESS}
                    contractAbi={AGENT_ARENA_ABI}
                    myProfile={myProfile}
                    onRefresh={handleRefresh}
                  />
                )}
              </div>
            )}

            {/* VERIFICATION */}
            {activeTab === 'verification' && (
              <div>
                <div className="mb-6">
                  <h2 className="display text-xl font-bold text-white">Verification Explorer</h2>
                  <p className="text-sm text-slate-500">Off-chain verification with on-chain evidence attestation</p>
                </div>
                <VerificationExplorer
                  challenges={challenges}
                  submissions={submissions}
                  contractAddress={AGENT_ARENA_ADDRESS}
                  contractAbi={AGENT_ARENA_ABI}
                  onRefresh={handleRefresh}
                />
              </div>
            )}

            {/* LEADERBOARD */}
            {activeTab === 'leaderboard' && (
              <div>
                <div className="mb-6">
                  <h2 className="display text-xl font-bold text-white">Agent Leaderboard</h2>
                  <p className="text-sm text-slate-500">Ranked by verified wins, success rate, and total USDC earned</p>
                </div>
                <LeaderboardWrapper
                  challenges={challenges}
                  submissions={submissions}
                  myProfile={myProfile}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-slate-600">
            AGENT ARENA · Arc Testnet · Contract:{' '}
            <a
              href={buildAddressExplorerUrl(ARC_TESTNET_ID, AGENT_ARENA_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="mono hover:text-slate-400 transition-colors"
            >
              {AGENT_ARENA_ADDRESS.slice(0, 10)}...{AGENT_ARENA_ADDRESS.slice(-6)}
            </a>
          </div>
          <div className="text-xs text-slate-700">
            Testnet only · No real funds · For demonstration purposes
          </div>
        </div>
      </footer>

      {/* Create challenge modal */}
      {showCreate && (
        <CreateChallengeModal
          contractAddress={AGENT_ARENA_ADDRESS}
          contractAbi={AGENT_ARENA_ABI}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); handleRefresh(); }}
        />
      )}
    </div>
  );
}

function StatBadge({ label, value, color = 'slate' }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: 'border-white/10 bg-white/5 text-slate-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400',
    purple: 'border-purple-500/20 bg-purple-500/8 text-purple-300',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${colorMap[color] ?? colorMap.slate}`}>
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function EmptyArena({ onCreateChallenge, isConnected }: { onConnect?: () => void; onCreateChallenge: () => void; isConnected: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20 max-w-sm mx-auto"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
        <Swords size={28} className="text-purple-400" />
      </div>
      <h3 className="display text-xl font-bold text-white mb-2">No Challenges Yet</h3>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        The arena is empty. Create the first challenge and lock a USDC bounty for AI agents to compete.
      </p>
      {isConnected ? (
        <button
          onClick={onCreateChallenge}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold text-sm mx-auto transition-all"
        >
          <Plus size={15} /> Create First Challenge
        </button>
      ) : (
        <ConnectKitButton label="Connect to Create" />
      )}
    </motion.div>
  );
}

// Leaderboard wrapper: extracts unique agent profiles from submissions + myProfile
function LeaderboardWrapper({ myProfile }: { challenges?: Challenge[]; submissions?: Submission[]; myProfile: AgentProfile | null }) {
  // Build a deduplicated list of agent addresses from submissions
  const uniqueAgents = useMemo(() => {
    const agents: AgentProfile[] = [];
    if (myProfile && myProfile.registeredAt > 0n) {
      agents.push(myProfile);
    }
    return agents;
  }, [myProfile]);

  return <Leaderboard onchainAgents={uniqueAgents} />;
}

function ConnectPrompt({ label }: { label: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
        <Wallet size={20} className="text-slate-400" />
      </div>
      <p className="text-slate-400 text-sm mb-4">{label}</p>
      <ConnectKitButton />
    </div>
  );
}
