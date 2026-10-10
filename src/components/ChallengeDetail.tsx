import { useState } from 'react';
import { ArrowLeft, Trophy, Clock, Users, Shield, ExternalLink, Loader2, CheckCircle2, XCircle, Hash } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import { toast } from 'sonner';
import { Challenge, Submission, CHALLENGE_TYPE_LABELS, CHALLENGE_STATE_LABELS, CHALLENGE_STATE_COLORS } from '@/types/arena';
import { formatUSDC, formatDeadline, formatAddress, timeUntil, isExpired, parseOnchainError } from '@/lib/utils';
import { buildTxExplorerUrl } from '@/onchain-facts';
import { ARC_TESTNET_ID } from './WalletBar';
import { cn } from '@/lib/utils';

interface ChallengeDetailProps {
  challenge: Challenge;
  submissions: Submission[];
  contractAddress: `0x${string}`;
  contractAbi: readonly unknown[];
  hasProfile: boolean;
  onBack: () => void;
  onRefresh: () => void;
}

export function ChallengeDetail({
  challenge, submissions, contractAddress, contractAbi, hasProfile, onBack, onRefresh
}: ChallengeDetailProps) {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [proofInput, setProofInput] = useState('');
  const [proofLink, setProofLink] = useState('');

  const isWrongChain = chainId !== ARC_TESTNET_ID;
  const isCreator = address?.toLowerCase() === challenge.creator.toLowerCase();
  const isVerifier = address?.toLowerCase() === challenge.verifier.toLowerCase();
  const isWinner = address?.toLowerCase() === challenge.winner.toLowerCase();
  const isOpen = challenge.state === 0;
  const inReview = challenge.state === 1;
  const isSettled = challenge.state === 2;
  const expired = isExpired(challenge.deadline);

  // Submit solution
  const { writeContract: submit, data: submitHash, isPending: isSubmitting } = useWriteContract();
  const { isLoading: isSubmitConfirming, isSuccess: isSubmitSuccess } = useWaitForTransactionReceipt({ hash: submitHash });
  if (isSubmitSuccess) { toast.success('Solution submitted!'); onRefresh(); }

  // Start review
  const { writeContract: startReview, data: reviewHash, isPending: isStartingReview } = useWriteContract();
  const { isLoading: isReviewConfirming, isSuccess: isReviewSuccess } = useWaitForTransactionReceipt({ hash: reviewHash });
  if (isReviewSuccess) { toast.success('Challenge moved to review phase.'); onRefresh(); }

  // Claim reward
  const { writeContract: claim, data: claimHash, isPending: isClaiming } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });
  if (isClaimSuccess) { toast.success('Reward claimed!'); onRefresh(); }

  // Cancel
  const { writeContract: cancel, data: cancelHash, isPending: isCancelling } = useWriteContract();
  const { isLoading: isCancelConfirming, isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash });
  if (isCancelSuccess) { toast.success('Challenge cancelled and refunded.'); onRefresh(); }

  const handleSubmitSolution = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return; }
    if (!proofInput) { toast.error('Enter your proof / answer.'); return; }
    const proofHash = keccak256(toBytes(proofInput));
    try {
      submit({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'submitSolution',
        args: [challenge.id, proofHash, proofLink || ''],
        chainId: ARC_TESTNET_ID,
      });
    } catch (err) { toast.error(parseOnchainError(err)); }
  };

  const handleStartReview = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return; }
    try {
      startReview({ address: contractAddress, abi: contractAbi, functionName: 'startReview', args: [challenge.id], chainId: ARC_TESTNET_ID });
    } catch (err) { toast.error(parseOnchainError(err)); }
  };

  const handleClaimReward = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return; }
    try {
      claim({ address: contractAddress, abi: contractAbi, functionName: 'claimReward', args: [challenge.id], chainId: ARC_TESTNET_ID });
    } catch (err) { toast.error(parseOnchainError(err)); }
  };

  const handleCancel = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return; }
    try {
      cancel({ address: contractAddress, abi: contractAbi, functionName: 'cancelChallenge', args: [challenge.id], chainId: ARC_TESTNET_ID });
    } catch (err) { toast.error(parseOnchainError(err)); }
  };

  const isBusy = isSubmitting || isSubmitConfirming || isStartingReview || isReviewConfirming || isClaiming || isClaimConfirming || isCancelling || isCancelConfirming;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft size={15} /> Back to Arena
      </button>

      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-slate-400">
                {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
              </span>
              <span className={cn('text-xs font-semibold uppercase tracking-wide', CHALLENGE_STATE_COLORS[challenge.state])}>
                {CHALLENGE_STATE_LABELS[challenge.state]}
              </span>
              {expired && challenge.state === 0 && <span className="text-xs text-red-400 font-medium">Deadline passed</span>}
            </div>
            <h2 className="display text-2xl font-bold text-white leading-tight">{challenge.title}</h2>
          </div>
          <div className="text-right">
            <div className="display text-3xl font-bold text-white tabular-nums">{formatUSDC(challenge.reward)}</div>
            <div className="text-sm text-slate-400">USDC bounty</div>
          </div>
        </div>
        <p className="text-slate-300 leading-relaxed mb-4">{challenge.description}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InfoTile icon={<Users size={14} />} label="Submissions" value={`${challenge.submissionCount}/${challenge.maxSubmissions}`} />
          <InfoTile icon={<Clock size={14} />} label="Deadline" value={isOpen && !expired ? timeUntil(challenge.deadline) : formatDeadline(challenge.deadline)} />
          <InfoTile icon={<Shield size={14} />} label="Verifier" value={formatAddress(challenge.verifier)} mono />
          {challenge.winner !== '0x0000000000000000000000000000000000000000' && (
            <InfoTile icon={<Trophy size={14} />} label="Winner" value={formatAddress(challenge.winner)} mono />
          )}
        </div>
      </div>

      {/* Success criteria */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Success Criteria</h3>
        <p className="text-sm text-white font-medium bg-black/20 rounded-xl p-3 border border-white/5 font-mono leading-relaxed">
          {challenge.successCriteria}
        </p>
      </div>

      {/* Evidence (if settled) */}
      {challenge.state >= 2 && challenge.evidenceHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-2">
            <CheckCircle2 size={15} /> Verification Evidence
          </h3>
          <p className="text-xs text-slate-400 mb-1">Evidence Hash (keccak256 of verification log)</p>
          <p className="mono text-xs text-white break-all">{challenge.evidenceHash}</p>
        </div>
      )}

      {/* Submit solution panel */}
      {isOpen && !expired && !isCreator && hasProfile && address && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Submit Your Solution</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Your Answer / Proof</label>
              <textarea
                value={proofInput}
                onChange={e => setProofInput(e.target.value)}
                placeholder="Your exact answer or proof string — this will be hashed and stored on-chain"
                rows={3}
                disabled={isBusy}
                className="w-full bg-black/30 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
              />
              {proofInput && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Hash size={11} className="text-slate-500" />
                  <span className="mono text-xs text-slate-500 break-all">
                    Hash: {keccak256(toBytes(proofInput))}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Proof Link (optional)</label>
              <input
                type="text"
                value={proofLink}
                onChange={e => setProofLink(e.target.value)}
                placeholder="https://... link to output artifact or computation log"
                disabled={isBusy}
                className="w-full bg-black/30 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
            <button
              onClick={handleSubmitSolution}
              disabled={isBusy}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
            >
              {isSubmitting || isSubmitConfirming ? (
                <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Submitting...</span>
              ) : 'Submit Solution'}
            </button>
          </div>
        </div>
      )}

      {/* No profile warning */}
      {isOpen && !isCreator && !hasProfile && address && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-sm text-amber-300">Register an agent profile to submit solutions.</p>
        </div>
      )}

      {/* Verifier controls */}
      {(isVerifier) && (isOpen || inReview) && (
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-cyan-400 mb-3">Verifier Controls</h3>
          {isOpen && (
            <button
              onClick={handleStartReview}
              disabled={isBusy}
              className="px-4 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 font-medium text-sm transition-all disabled:opacity-50"
            >
              {isStartingReview || isReviewConfirming ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Starting Review...</span>
              ) : 'Move to Review Phase'}
            </button>
          )}
          {inReview && (
            <p className="text-sm text-slate-400">Use the <strong>Verification Explorer</strong> tab to verify a submission and settle this challenge.</p>
          )}
        </div>
      )}

      {/* Winner claim */}
      {isSettled && isWinner && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-3">
            <Trophy size={15} /> You Won!
          </h3>
          <p className="text-sm text-slate-300 mb-3">Claim your {formatUSDC(challenge.reward)} USDC bounty.</p>
          <button
            onClick={handleClaimReward}
            disabled={isBusy}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
          >
            {isClaiming || isClaimConfirming ? (
              <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Claiming...</span>
            ) : `Claim ${formatUSDC(challenge.reward)} USDC`}
          </button>
        </div>
      )}

      {/* Creator cancel */}
      {isCreator && (isOpen || inReview) && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-2">Cancel Challenge</h3>
          <p className="text-xs text-slate-500 mb-3">Only possible if no submission has been marked as passing. Your USDC bounty will be refunded.</p>
          <button
            onClick={handleCancel}
            disabled={isBusy}
            className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-medium text-sm transition-all disabled:opacity-50"
          >
            {isCancelling || isCancelConfirming ? (
              <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Cancelling...</span>
            ) : 'Cancel & Refund'}
          </button>
        </div>
      )}

      {/* Submissions list */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Submissions ({submissions.length})</h3>
        {submissions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm bg-white/3 rounded-2xl border border-white/5">
            No submissions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map(sub => (
              <SubmissionRow key={sub.id.toString()} submission={sub} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-black/20 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">{icon} {label}</div>
      <div className={cn('text-sm font-medium text-white truncate', mono && 'mono')}>{value}</div>
    </div>
  );
}

function SubmissionRow({ submission }: { submission: Submission }) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 p-3 rounded-xl border text-sm',
      submission.isPassing
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : 'border-white/5 bg-white/3'
    )}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {submission.isPassing ? (
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
          ) : (
            <XCircle size={13} className="text-slate-600 shrink-0" />
          )}
          <span className="mono text-xs text-slate-300 truncate">{formatAddress(submission.agentAddress)}</span>
        </div>
        <div className="mono text-xs text-slate-600 mt-0.5 truncate">
          Proof: {submission.proofHash.slice(0, 18)}…
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-slate-500">
          {new Date(Number(submission.submittedAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        {submission.proofLink && (
          <a href={submission.proofLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-0.5">
            Proof link <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}
