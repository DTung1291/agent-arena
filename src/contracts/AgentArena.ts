// AgentArena contract — deployed on Arc Testnet
// Address: 0xf24751fa6ccf0b097761e63442096e9677a9829b
// Chain: Arc Testnet (chainId 5042002)
// USDC: 0x3600000000000000000000000000000000000000

export const AGENT_ARENA_ADDRESS = '0xf24751fa6ccf0b097761e63442096e9677a9829b' as const;

export const AGENT_ARENA_ABI = [
  // Enums (represented as uint8 in ABI)
  // Events
  {
    type: 'event',
    name: 'ChallengeCreated',
    inputs: [
      { name: 'challengeId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
      { name: 'challengeType', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SolutionSubmitted',
    inputs: [
      { name: 'challengeId', type: 'uint256', indexed: true },
      { name: 'submissionId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Verified',
    inputs: [
      { name: 'challengeId', type: 'uint256', indexed: true },
      { name: 'submissionId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'evidenceHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ChallengeSettled',
    inputs: [
      { name: 'challengeId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardClaimed',
    inputs: [
      { name: 'challengeId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ChallengeCancelled',
    inputs: [
      { name: 'challengeId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'refund', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ChallengeInReview',
    inputs: [{ name: 'challengeId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'WithdrawalPending',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Functions
  {
    type: 'function',
    name: 'createChallenge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'challengeType', type: 'uint8' },
      { name: 'successCriteria', type: 'string' },
      { name: 'deadline', type: 'uint256' },
      { name: 'reward', type: 'uint256' },
      { name: 'maxSubmissions', type: 'uint256' },
      { name: 'verifier', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitSolution',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'challengeId', type: 'uint256' },
      { name: 'proofHash', type: 'bytes32' },
      { name: 'proofLink', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'registerAgent',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'capabilities', type: 'string' },
      { name: 'erc8004Ref', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'startReview',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'challengeId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'verifyAndSettle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'challengeId', type: 'uint256' },
      { name: 'submissionId', type: 'uint256' },
      { name: 'evidenceHash', type: 'bytes32' },
      { name: 'verificationNote', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimReward',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'challengeId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelChallenge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'challengeId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'expireAndRefund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'challengeId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // View functions
  {
    type: 'function',
    name: 'getChallenge',
    stateMutability: 'view',
    inputs: [{ name: 'challengeId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'challengeType', type: 'uint8' },
          { name: 'successCriteria', type: 'string' },
          { name: 'deadline', type: 'uint256' },
          { name: 'reward', type: 'uint256' },
          { name: 'maxSubmissions', type: 'uint256' },
          { name: 'verifier', type: 'address' },
          { name: 'state', type: 'uint8' },
          { name: 'winner', type: 'address' },
          { name: 'submissionCount', type: 'uint256' },
          { name: 'evidenceHash', type: 'bytes32' },
          { name: 'verifiedAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getSubmission',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'challengeId', type: 'uint256' },
          { name: 'agentAddress', type: 'address' },
          { name: 'proofHash', type: 'bytes32' },
          { name: 'proofLink', type: 'string' },
          { name: 'submittedAt', type: 'uint256' },
          { name: 'isPassing', type: 'bool' },
          { name: 'verificationNote', type: 'string' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getAgentProfile',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'agentAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'capabilities', type: 'string' },
          { name: 'erc8004Ref', type: 'string' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'totalWins', type: 'uint256' },
          { name: 'totalSubmissions', type: 'uint256' },
          { name: 'totalEarned', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getChallengeSubmissions',
    stateMutability: 'view',
    inputs: [{ name: 'challengeId', type: 'uint256' }],
    outputs: [{ type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'getChallengeCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getSubmissionCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasAgentProfile',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'pendingWithdrawals',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'usdc',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'GRACE_PERIOD',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // Constructor
  {
    type: 'constructor',
    inputs: [{ name: 'usdc_', type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const;
