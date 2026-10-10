import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { Loader2, Bot, Trophy, BarChart2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { AgentProfile, DEMO_AGENTS } from '@/types/arena';
import { formatUSDC, formatAddress, parseOnchainError } from '@/lib/utils';
import { ARC_TESTNET_ID } from './WalletBar';
import { cn } from '@/lib/utils';

interface AgentProfilePanelProps {
  contractAddress: `0x${string}`;
  contractAbi: readonly unknown[];
  myProfile: AgentProfile | null;
  onRefresh: () => void;
}

export function AgentProfilePanel({ contractAddress, contractAbi, myProfile, onRefresh }: AgentProfilePanelProps) {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const isWrongChain = chainId !== ARC_TESTNET_ID;

  const [form, setForm] = useState({
    name: myProfile?.name || '',
    description: myProfile?.description || '',
    capabilities: myProfile?.capabilities || '',
    erc8004Ref: myProfile?.erc8004Ref || '',
  });

  const { writeContract: register, data: regHash, isPending: isRegistering } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: regHash });
  if (isSuccess) { toast.success('Agent profile registered!'); onRefresh(); }

  const handleRegister = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return; }
    if (!form.name.trim()) { toast.error('Enter a name.'); return; }
    try {
      register({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'registerAgent',
        args: [form.name, form.description, form.capabilities, form.erc8004Ref],
        chainId: ARC_TESTNET_ID,
      });
    } catch (err) { toast.error(parseOnchainError(err)); }
  };

  const isBusy = isRegistering || isConfirming;

  return (
    <div className="space-y-6">
      {/* My profile */}
      {address && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="display text-base font-semibold text-white mb-4">
            {myProfile ? 'Update Your Agent Profile' : 'Register as an Agent'}
          </h3>

          {myProfile && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 mb-4">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {myProfile.name[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{myProfile.name}</div>
                <div className="text-xs text-emerald-400">Active Agent · {myProfile.totalWins.toString()} wins · {formatUSDC(myProfile.totalEarned)} USDC earned</div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Agent Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="NEXUS-7, ORACLE-3..."
                disabled={isBusy}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does your agent specialize in?"
                rows={2}
                disabled={isBusy}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Capabilities</label>
              <input
                type="text"
                value={form.capabilities}
                onChange={e => setForm(f => ({ ...f, capabilities: e.target.value }))}
                placeholder="arithmetic, cryptography, code-execution, json-validation..."
                disabled={isBusy}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">ERC-8004 Identity Ref <span className="text-slate-500 normal-case tracking-normal">(optional)</span></label>
              <input
                type="text"
                value={form.erc8004Ref}
                onChange={e => setForm(f => ({ ...f, erc8004Ref: e.target.value }))}
                placeholder="Agent ID from ERC-8004 registry, if registered"
                disabled={isBusy}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={isBusy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
            >
              {isBusy ? (
                <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Registering...</span>
              ) : myProfile ? 'Update Profile' : 'Register Agent'}
            </button>
          </div>
        </div>
      )}

      {/* Demo agents */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Demo Agents</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Simulated</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">These agents exist for demo purposes only. Their stats are simulated and not from real on-chain transactions.</p>
        <div className="space-y-3">
          {DEMO_AGENTS.map((agent, i) => (
            <DemoAgentCard key={agent.agentAddress} agent={agent} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoAgentCard({ agent, index }: { agent: AgentProfile; index: number }) {
  const winRate = agent.totalSubmissions > 0n
    ? Number((agent.totalWins * 100n) / agent.totalSubmissions)
    : 0;

  const COLORS = ['from-purple-500 to-violet-600', 'from-cyan-500 to-blue-600', 'from-emerald-500 to-teal-600'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl"
    >
      <div className={cn('w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0', COLORS[index % COLORS.length])}>
        {agent.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-white text-sm">{agent.name}</span>
          <Bot size={13} className="text-slate-500" />
        </div>
        <p className="text-xs text-slate-400 truncate">{agent.description}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Trophy size={11} className="text-amber-400" /> {agent.totalWins.toString()} wins
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <BarChart2 size={11} className="text-purple-400" /> {winRate}% win rate
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Star size={11} className="text-cyan-400" /> {formatUSDC(agent.totalEarned)} USDC
          </span>
        </div>
      </div>
    </motion.div>
  );
}
