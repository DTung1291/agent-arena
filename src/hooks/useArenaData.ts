import { useReadContract, useReadContracts } from 'wagmi';
import { useMemo } from 'react';
import { AGENT_ARENA_ADDRESS, AGENT_ARENA_ABI } from '@/contracts/AgentArena';
import { Challenge, Submission, AgentProfile } from '@/types/arena';
import { ARC_TESTNET_ID } from '@/components/WalletBar';

const BASE_CONFIG = {
  address: AGENT_ARENA_ADDRESS,
  abi: AGENT_ARENA_ABI,
  chainId: ARC_TESTNET_ID,
} as const;

export function useChallengeCount() {
  return useReadContract({
    ...BASE_CONFIG,
    functionName: 'getChallengeCount',
  });
}

export function useChallenges() {
  const { data: count } = useChallengeCount();
  const challengeCount = count ? Number(count) : 0;

  const contracts = useMemo(() =>
    Array.from({ length: challengeCount }, (_, i) => ({
      ...BASE_CONFIG,
      functionName: 'getChallenge' as const,
      args: [BigInt(i + 1)] as const,
    })),
    [challengeCount]
  );

  const { data: results, isLoading, refetch } = useReadContracts({
    contracts,
    query: { enabled: challengeCount > 0 },
  });

  const challenges = useMemo<Challenge[]>(() => {
    if (!results) return [];
    return results
      .filter(r => r.status === 'success' && r.result)
      .map(r => {
        const d = r.result as unknown as {
          id: bigint; creator: `0x${string}`; title: string; description: string;
          challengeType: number; successCriteria: string; deadline: bigint;
          reward: bigint; maxSubmissions: bigint; verifier: `0x${string}`;
          state: number; winner: `0x${string}`; submissionCount: bigint;
          evidenceHash: `0x${string}`; verifiedAt: bigint;
        };
        return {
          id: d.id,
          creator: d.creator,
          title: d.title,
          description: d.description,
          challengeType: d.challengeType as 0 | 1 | 2,
          successCriteria: d.successCriteria,
          deadline: d.deadline,
          reward: d.reward,
          maxSubmissions: d.maxSubmissions,
          verifier: d.verifier,
          state: d.state as 0 | 1 | 2 | 3 | 4,
          winner: d.winner,
          submissionCount: d.submissionCount,
          evidenceHash: d.evidenceHash,
          verifiedAt: d.verifiedAt,
        } satisfies Challenge;
      });
  }, [results]);

  return { challenges, isLoading, refetch };
}

export function useSubmissions(challengeIds: bigint[]) {
  // Get submission IDs for each challenge
  const subIdContracts = useMemo(() =>
    challengeIds.map(id => ({
      ...BASE_CONFIG,
      functionName: 'getChallengeSubmissions' as const,
      args: [id] as const,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(challengeIds.map(String))]
  );

  const { data: subIdResults } = useReadContracts({
    contracts: subIdContracts,
    query: { enabled: challengeIds.length > 0 },
  });

  const allSubIds = useMemo<bigint[]>(() => {
    if (!subIdResults) return [];
    return subIdResults
      .filter(r => r.status === 'success' && Array.isArray(r.result))
      .flatMap(r => r.result as bigint[]);
  }, [subIdResults]);

  const subContracts = useMemo(() =>
    allSubIds.map(id => ({
      ...BASE_CONFIG,
      functionName: 'getSubmission' as const,
      args: [id] as const,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(allSubIds.map(String))]
  );

  const { data: subResults, refetch } = useReadContracts({
    contracts: subContracts,
    query: { enabled: allSubIds.length > 0 },
  });

  const submissions = useMemo<Submission[]>(() => {
    if (!subResults) return [];
    return subResults
      .filter(r => r.status === 'success' && r.result)
      .map(r => {
        const d = r.result as unknown as {
          id: bigint; challengeId: bigint; agentAddress: `0x${string}`;
          proofHash: `0x${string}`; proofLink: string; submittedAt: bigint;
          isPassing: boolean; verificationNote: string;
        };
        return {
          id: d.id,
          challengeId: d.challengeId,
          agentAddress: d.agentAddress,
          proofHash: d.proofHash,
          proofLink: d.proofLink,
          submittedAt: d.submittedAt,
          isPassing: d.isPassing,
          verificationNote: d.verificationNote,
        } satisfies Submission;
      });
  }, [subResults]);

  return { submissions, refetch };
}

export function useAgentProfile(address: `0x${string}` | undefined) {
  const { data, refetch } = useReadContract({
    ...BASE_CONFIG,
    functionName: 'getAgentProfile',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const profile = useMemo<AgentProfile | null>(() => {
    if (!data) return null;
    const d = data;
    if (!d.registeredAt || d.registeredAt === 0n) return null;
    return {
      agentAddress: d.agentAddress,
      name: d.name,
      description: d.description,
      capabilities: d.capabilities,
      erc8004Ref: d.erc8004Ref,
      registeredAt: d.registeredAt,
      totalWins: d.totalWins,
      totalSubmissions: d.totalSubmissions,
      totalEarned: d.totalEarned,
    } satisfies AgentProfile;
  }, [data]);

  return { profile, refetch };
}

export function usePendingWithdrawal(address: `0x${string}` | undefined) {
  return useReadContract({
    ...BASE_CONFIG,
    functionName: 'pendingWithdrawals',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}
