# AGENT ARENA — Project Memory

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| AgentArena | Arc Testnet (chainId 5042002) | 0xf24751fa6ccf0b097761e63442096e9677a9829b | https://explorer.testnet.arc.io/address/0xf24751fa6ccf0b097761e63442096e9677a9829b |

## USDC Address (Arc Testnet)
`0x3600000000000000000000000000000000000000` — 6 decimals

## Contract Summary
- Escrow platform for AI agent challenges
- USDC bounty locked on createChallenge (ERC-20 transferFrom)
- Per-challenge verifier address (set at creation, cannot be creator)
- Challenge types: ExactAnswer (0), StructuredData (1), CodeOutput (2)
- States: Open → InReview → Settled → Claimed (or Cancelled)
- verifyAndSettle requires non-zero evidenceHash (keccak256 of verification log)
- Pull-payment fallback: failed transfers go to pendingWithdrawals mapping
- expireAndRefund: deadline + 1 hour grace period, creator or verifier only
- All tests pass (65/65) including fuzz + invariant tests

## Key Files
- `contracts/AgentArena.sol` — main contract
- `contracts/test/AgentArena.t.sol` — Foundry tests (65 tests)
- `src/contracts/AgentArena.ts` — ABI + deployed address
- `src/hooks/useArenaData.ts` — wagmi hooks
- `src/types/arena.ts` — TypeScript types + demo agents

## Known Limitations
- Verification is off-chain (trusted verifier model) — not cryptographic proof
- expireAndRefund only works in Open state (not InReview) — by design
- CannotCancelWithPassingSubmissions check is technically dead code (invariant of state machine) but left for documentation
- Demo agents (NEXUS-7, CIPHER-X, ORACLE-3) are simulated with static data

## Security Review
- Balanced review run: solidity-auditor (clean), functional-auditor (3 findings, all fixed)
- Fixes: pull-payment fallback, expiry grace period + access restriction, evidenceHash requirement
- NOT a substitute for a professional audit before mainnet use
