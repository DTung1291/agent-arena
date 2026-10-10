import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle2, XCircle, Loader2, AlertCircle, Hash } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import { toast } from 'sonner';
import { Challenge, Submission, CHALLENGE_STATE_LABELS, CHALLENGE_STATE_COLORS } from '@/types/arena';
import { formatUSDC, formatAddress, parseOnchainError } from '@/lib/utils';
import { ARC_TESTNET_ID } from './WalletBar';
import { cn } from '@/lib/utils';

interface VerificationExplorerProps {
  challenges: Challenge[];
  submissions: Submission[];
  contractAddress: `0x${string}`;
  contractAbi: readonly unknown[];
  onRefresh: () => void;
}

export function VerificationExplorer({ challenges, submissions, contractAddress, contractAbi, onRefresh }: VerificationExplorerProps) {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const isWrongChain = chainId !== ARC_TESTNET_ID;

  const [selectedChallenge, setSelectedChallenge] = useState<bigint | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<bigint | null>(null);
  const [evidenceLog, setEvidenceLog] = useState('');
  const [verificationNote, setVerificationNote] = useState('');

  const { writeContract: verify, data: verifyHash, isPending: isVerifying } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: verifyHash });
  if (isSuccess) { toast.success('Submission verified and challenge settled!'); onRefresh(); setSelectedChallenge(null); setSelectedSubmission(null); }

  const isBusy = isVerifying || isConfirming;

  // Challenges where current user is verifier and state is Open or InReview
  const myVerifierChallenges = challenges.filter(
    c => address && c.verifier.toLowerCase() === address.toLowerCase() && (c.state === 0 || c.state === 1)
  );

  const challengeSubmissions = selectedChallenge !== null
    ? submissions.filter(s => s.challengeId === selectedChallenge)
    : [];

  const selectedChallengeData = selectedChallenge !== null
    ? challenges.find(c => c.id === selectedChallenge)
    : null;

  const evidenceHash = evidenceLog ? keccak256(toBytes(evidenceLog)) : null;

  const handleVerify = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return; }
    if (!selectedChallenge || !selectedSubmission || !evidenceLog) {
      toast.error('Select a challenge, submission, and enter the evidence log.');
      return;
    }
    try {
      verify({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'verifyAndSettle',
        args: [selectedChallenge, selectedSubmission, evidenceHash!, verificationNote],
        chainId: ARC_TESTNET_ID,
      });
    } catch (err) { toast.error(parseOnchainError(err)); }
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
        <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-amber-300 font-medium">Off-chain verification with on-chain attestation</p>
          <p className="text-slate-400 mt-0.5">Verification is performed off-chain by the designated verifier. The evidence hash (keccak256 of your computation log) is stored permanently on-chain. This is NOT cryptographic proof — it attests that the designated verifier ran the check.</p>
        </div>
      </div>

      {/* All challenges verification status */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">All Challenges</h3>
        {challenges.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm bg-white/3 rounded-2xl border border-white/5">No challenges yet.</div>
        ) : (
          <div className="space-y-2">
            {challenges.map(c => (
              <div key={c.id.toString()} className="flex items-center justify-between gap-3 p-3 bg-white/5 border border-white/8 rounded-xl text-sm">
                <div className="min-w-0">
                  <span className="text-white font-medium truncate block">{c.title}</span>
                  <span className="text-xs text-slate-500 mono">Verifier: {formatAddress(c.verifier)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs font-semibold', CHALLENGE_STATE_COLORS[c.state])}>
                    {CHALLENGE_STATE_LABELS[c.state]}
                  </span>
                  {c.state >= 2 && c.evidenceHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verifier panel */}
      {address && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
            <Shield size={15} className="text-cyan-400" /> Your Verifier Panel
          </h3>

          {myVerifierChallenges.length === 0 ? (
            <p className="text-sm text-slate-400">No challenges where you are the verifier and settlement is pending.</p>
          ) : (
            <div className="space-y-4">
              {/* Challenge select */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Select Challenge</label>
                <div className="space-y-2">
                  {myVerifierChallenges.map(c => (
                    <button
                      key={c.id.toString()}
                      onClick={() => { setSelectedChallenge(c.id); setSelectedSubmission(null); }}
                      className={cn(
                        'w-full text-left p-3 rounded-xl border text-sm transition-all',
                        selectedChallenge === c.id
                          ? 'border-cyan-500/40 bg-cyan-500/10 text-white'
                          : 'border-white/8 bg-white/3 text-slate-300 hover:border-white/15'
                      )}
                    >
                      <span className="font-medium">{c.title}</span>
                      <span className={cn('ml-2 text-xs', CHALLENGE_STATE_COLORS[c.state])}>{CHALLENGE_STATE_LABELS[c.state]}</span>
                      <span className="ml-2 text-xs text-slate-500">· {formatUSDC(c.reward)} USDC bounty</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submission select */}
              {selectedChallenge !== null && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    Select Winning Submission
                  </label>
                  {challengeSubmissions.length === 0 ? (
                    <p className="text-sm text-slate-500">No submissions yet for this challenge.</p>
                  ) : (
                    <div className="space-y-2">
                      {challengeSubmissions.map(sub => (
                        <button
                          key={sub.id.toString()}
                          onClick={() => setSelectedSubmission(sub.id)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border text-sm transition-all',
                            selectedSubmission === sub.id
                              ? 'border-purple-500/40 bg-purple-500/10 text-white'
                              : 'border-white/8 bg-white/3 text-slate-300 hover:border-white/15'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="mono text-xs text-slate-400">{formatAddress(sub.agentAddress)}</span>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="mono text-xs text-slate-500">Proof: {sub.proofHash.slice(0, 14)}…</span>
                          </div>
                          {sub.proofLink && (
                            <div className="text-xs text-purple-400 mt-0.5 truncate">Link: {sub.proofLink}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Evidence input */}
              {selectedSubmission !== null && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                      Verification Computation Log
                    </label>
                    <textarea
                      value={evidenceLog}
                      onChange={e => setEvidenceLog(e.target.value)}
                      placeholder="Paste your full verification log / computation trace here. This will be hashed and stored on-chain as proof."
                      rows={4}
                      disabled={isBusy}
                      className="w-full bg-black/30 border border-white/10 focus:border-cyan-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
                    />
                    {evidenceHash && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Hash size={11} className="text-slate-500" />
                        <span className="mono text-xs text-slate-400 break-all">
                          Evidence Hash: {evidenceHash}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Verification Note</label>
                    <input
                      type="text"
                      value={verificationNote}
                      onChange={e => setVerificationNote(e.target.value)}
                      placeholder="Brief description of how the submission was verified"
                      disabled={isBusy}
                      className="w-full bg-black/30 border border-white/10 focus:border-cyan-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={isBusy || !evidenceLog}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
                  >
                    {isBusy ? (
                      <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Settling...</span>
                    ) : 'Verify & Settle Challenge'}
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
