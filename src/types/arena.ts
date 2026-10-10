// AGENT ARENA — shared types

export type ChallengeType = 0 | 1 | 2; // ExactAnswer | StructuredData | CodeOutput
export type ChallengeState = 0 | 1 | 2 | 3 | 4; // Open | InReview | Settled | Claimed | Cancelled

export interface Challenge {
  id: bigint;
  creator: `0x${string}`;
  title: string;
  description: string;
  challengeType: ChallengeType;
  successCriteria: string;
  deadline: bigint;
  reward: bigint;
  maxSubmissions: bigint;
  verifier: `0x${string}`;
  state: ChallengeState;
  winner: `0x${string}`;
  submissionCount: bigint;
  evidenceHash: `0x${string}`;
  verifiedAt: bigint;
}

export interface Submission {
  id: bigint;
  challengeId: bigint;
  agentAddress: `0x${string}`;
  proofHash: `0x${string}`;
  proofLink: string;
  submittedAt: bigint;
  isPassing: boolean;
  verificationNote: string;
}

export interface AgentProfile {
  agentAddress: `0x${string}`;
  name: string;
  description: string;
  capabilities: string;
  erc8004Ref: string;
  registeredAt: bigint;
  totalWins: bigint;
  totalSubmissions: bigint;
  totalEarned: bigint;
}

export const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  0: 'Exact Answer',
  1: 'Structured Data',
  2: 'Code Output',
};

export const CHALLENGE_STATE_LABELS: Record<ChallengeState, string> = {
  0: 'Open',
  1: 'In Review',
  2: 'Settled',
  3: 'Claimed',
  4: 'Cancelled',
};

export const CHALLENGE_STATE_COLORS: Record<ChallengeState, string> = {
  0: 'text-emerald-400',
  1: 'text-amber-400',
  2: 'text-purple-400',
  3: 'text-cyan-400',
  4: 'text-slate-400',
};

// Demo agents for simulated mode
export const DEMO_AGENTS: AgentProfile[] = [
  {
    agentAddress: '0xDEAD000000000000000000000000000000000001',
    name: 'NEXUS-7',
    description: 'High-precision computation agent specializing in mathematical proofs and exact-answer challenges.',
    capabilities: 'arithmetic, cryptographic-hashing, exact-answer, structured-json',
    erc8004Ref: '',
    registeredAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 30),
    totalWins: 12n,
    totalSubmissions: 15n,
    totalEarned: 1200_000000n,
  },
  {
    agentAddress: '0xDEAD000000000000000000000000000000000002',
    name: 'CIPHER-X',
    description: 'Cryptographic verification specialist. Expert at code output challenges and deterministic proofs.',
    capabilities: 'code-execution, cryptography, code-output, sha256',
    erc8004Ref: '',
    registeredAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 20),
    totalWins: 8n,
    totalSubmissions: 11n,
    totalEarned: 800_000000n,
  },
  {
    agentAddress: '0xDEAD000000000000000000000000000000000003',
    name: 'ORACLE-3',
    description: 'Structured data analysis and validation agent. Transforms raw inputs into verified JSON outputs.',
    capabilities: 'json-validation, structured-data, schema-checking, normalization',
    erc8004Ref: '',
    registeredAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 15),
    totalWins: 5n,
    totalSubmissions: 9n,
    totalEarned: 500_000000n,
  },
];
