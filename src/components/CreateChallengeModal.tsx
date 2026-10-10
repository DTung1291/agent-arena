import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertCircle, Loader2 } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from 'wagmi';
import { erc20Abi, parseUnits } from 'viem';
import { toast } from 'sonner';
import { ARC_TESTNET_ID, usdcFact } from './WalletBar';
import { parseOnchainError } from '@/lib/utils';

interface CreateChallengeModalProps {
  contractAddress: `0x${string}`;
  contractAbi: readonly unknown[];
  onClose: () => void;
  onSuccess: () => void;
}

const CHALLENGE_TYPES = [
  { value: 0, label: 'Exact Answer', desc: 'Single deterministic answer' },
  { value: 1, label: 'Structured Data', desc: 'JSON / schema validation' },
  { value: 2, label: 'Code Output', desc: 'Deterministic program output' },
];

const DEADLINE_OPTIONS = [
  { label: '1 hour', secs: 3600 },
  { label: '6 hours', secs: 21600 },
  { label: '24 hours', secs: 86400 },
  { label: '3 days', secs: 259200 },
  { label: '7 days', secs: 604800 },
];

export function CreateChallengeModal({ contractAddress, contractAbi, onClose, onSuccess }: CreateChallengeModalProps) {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const [step, setStep] = useState<'form' | 'approve' | 'create'>('form');
  const [form, setForm] = useState({
    title: '',
    description: '',
    challengeType: 0,
    successCriteria: '',
    deadlineSecs: 86400,
    reward: '',
    maxSubmissions: '10',
    verifier: '',
  });

  const isWrongChain = chainId !== ARC_TESTNET_ID;

  const { data: allowance } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, contractAddress] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  });

  const rewardRaw = form.reward ? parseUnits(form.reward, 6) : 0n;
  const needsApproval = allowance !== undefined && allowance < rewardRaw;

  // Approve
  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  // Create
  const { writeContract: create, data: createHash, isPending: isCreating } = useWriteContract();
  const { isLoading: isCreateConfirming, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({ hash: createHash });

  // Handle approval success
  if (isApproveSuccess && step === 'approve') {
    setStep('create');
  }

  // Handle create success
  if (isCreateSuccess && step === 'create') {
    toast.success('Challenge created and bounty locked!');
    onSuccess();
    onClose();
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return; }
    if (!form.title || !form.description || !form.successCriteria || !form.reward || !form.verifier) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (!form.verifier.startsWith('0x') || form.verifier.length !== 42) {
      toast.error('Invalid verifier address.');
      return;
    }
    if (form.verifier.toLowerCase() === address?.toLowerCase()) {
      toast.error('Verifier cannot be the challenge creator.');
      return;
    }

    if (needsApproval) {
      setStep('approve');
      try {
        approve({
          address: usdcFact.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [contractAddress, rewardRaw],
          chainId: ARC_TESTNET_ID,
        });
      } catch (err) {
        toast.error(parseOnchainError(err));
        setStep('form');
      }
    } else {
      setStep('create');
      submitCreate();
    }
  };

  const submitCreate = useCallback(() => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + form.deadlineSecs);
    try {
      create({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'createChallenge',
        args: [
          form.title,
          form.description,
          form.challengeType,
          form.successCriteria,
          deadline,
          rewardRaw,
          BigInt(form.maxSubmissions),
          form.verifier as `0x${string}`,
        ],
        chainId: ARC_TESTNET_ID,
      });
    } catch (err) {
      toast.error(parseOnchainError(err));
      setStep('form');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, contractAddress, contractAbi, rewardRaw, create]);

  // After approval confirmed, do the create
  if (isApproveSuccess && step === 'approve') {
    submitCreate();
  }

  const isBusy = isApproving || isApproveConfirming || isCreating || isCreateConfirming;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/70 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg bg-[#0d1b2f] border border-white/10 rounded-2xl shadow-2xl mb-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="display text-lg font-semibold text-white">Create Arena Challenge</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Progress indicator */}
          {step !== 'form' && (
            <div className="px-6 pt-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Loader2 size={15} className="animate-spin text-purple-400" />
                <span className="text-sm text-purple-300">
                  {step === 'approve' && (isApproving ? 'Confirm USDC approval in wallet...' : 'Waiting for approval confirmation...')}
                  {step === 'create' && (isCreating ? 'Confirm challenge creation in wallet...' : 'Locking bounty on-chain...')}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Challenge Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Compute SHA-256 of a 1MB payload"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                disabled={isBusy}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the challenge in detail..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
                disabled={isBusy}
              />
            </div>

            {/* Challenge type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Challenge Type</label>
              <div className="grid grid-cols-3 gap-2">
                {CHALLENGE_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, challengeType: t.value }))}
                    disabled={isBusy}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      form.challengeType === t.value
                        ? 'border-purple-500 bg-purple-500/15 text-white'
                        : 'border-white/10 bg-white/3 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold">{t.label}</div>
                    <div className="text-xs opacity-60 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Success criteria */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Success Criteria
                <span className="ml-1.5 text-purple-400 normal-case tracking-normal">— deterministic, measurable</span>
              </label>
              <textarea
                value={form.successCriteria}
                onChange={e => setForm(f => ({ ...f, successCriteria: e.target.value }))}
                placeholder="e.g. Output must equal the hex string 'a3f2c1...' (exact match)"
                rows={2}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
                disabled={isBusy}
              />
              <div className="flex items-start gap-1.5 mt-1.5">
                <Info size={12} className="text-slate-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500">Use objective, verifiable criteria. The verifier will check submissions against this.</p>
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Deadline</label>
              <div className="flex gap-2 flex-wrap">
                {DEADLINE_OPTIONS.map(o => (
                  <button
                    key={o.secs}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, deadlineSecs: o.secs }))}
                    disabled={isBusy}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.deadlineSecs === o.secs
                        ? 'border-purple-500 bg-purple-500/15 text-white'
                        : 'border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reward + max submissions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Reward (USDC)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.reward}
                  onChange={e => setForm(f => ({ ...f, reward: e.target.value }))}
                  placeholder="10.00"
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors tabular-nums"
                  disabled={isBusy}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Max Submissions</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.maxSubmissions}
                  onChange={e => setForm(f => ({ ...f, maxSubmissions: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors tabular-nums"
                  disabled={isBusy}
                />
              </div>
            </div>

            {/* Verifier */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Verifier Address</label>
              <input
                type="text"
                value={form.verifier}
                onChange={e => setForm(f => ({ ...f, verifier: e.target.value }))}
                placeholder="0x..."
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors mono"
                disabled={isBusy}
              />
              <div className="flex items-start gap-1.5 mt-1.5">
                <AlertCircle size={12} className="text-amber-500/70 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500">The verifier is the only address that can mark a submission as passing and settle the challenge.</p>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-2">
              {isWrongChain ? (
                <button
                  type="button"
                  onClick={() => switchChain({ chainId: ARC_TESTNET_ID })}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
                >
                  Switch to Arc Testnet
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
                >
                  {isBusy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={15} className="animate-spin" />
                      {step === 'approve' ? 'Approving USDC...' : 'Creating Challenge...'}
                    </span>
                  ) : needsApproval ? (
                    `Approve ${form.reward} USDC & Create`
                  ) : (
                    `Lock ${form.reward || '0'} USDC & Create`
                  )}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
