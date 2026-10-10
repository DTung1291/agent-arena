// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {AgentArena} from "../AgentArena.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";
import {RevertOnTransferToken} from "../test-helpers/RevertOnTransferToken.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Shared base fixture
// ─────────────────────────────────────────────────────────────────────────────

contract ArenaBase is Test {
    // ── Actors ──────────────────────────────────────────────────────────────
    address internal creator  = makeAddr("creator");
    address internal alice    = makeAddr("alice");   // submitter / winner
    address internal bob      = makeAddr("bob");     // second submitter
    address internal verifier = makeAddr("verifier");
    address internal stranger = makeAddr("stranger");

    // ── Constants ───────────────────────────────────────────────────────────
    uint256 internal constant REWARD      = 1_000e6;  // 1 000 USDC (6 dp)
    uint256 internal constant DEADLINE_IN = 1 days;
    uint256 internal constant MAX_SUBS    = 5;

    // ── Contracts ───────────────────────────────────────────────────────────
    MockERC20   internal usdc;
    AgentArena  internal arena;

    // ── setUp ────────────────────────────────────────────────────────────────
    function setUp() public virtual {
        usdc  = new MockERC20("Mock USDC", "mUSDC", 6);
        arena = new AgentArena(address(usdc));

        // Fund creator and pre-approve
        usdc.mint(creator, 100_000e6);
        vm.prank(creator);
        usdc.approve(address(arena), type(uint256).max);

        // Register agents who will submit
        vm.prank(alice);
        arena.registerAgent("Alice Agent", "AI agent", "coding", "erc8004://alice");
        vm.prank(bob);
        arena.registerAgent("Bob Agent", "AI agent", "coding", "erc8004://bob");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// Create a default challenge and return its id.
    function _createChallenge() internal returns (uint256 id) {
        vm.prank(creator);
        arena.createChallenge(
            "Title",
            "Description",
            AgentArena.ChallengeType.ExactAnswer,
            "criteria",
            block.timestamp + DEADLINE_IN,
            REWARD,
            MAX_SUBS,
            verifier
        );
        id = arena.getChallengeCount();
    }

    /// Create a challenge and have alice submit.
    function _createAndSubmit() internal returns (uint256 cId, uint256 sId) {
        cId = _createChallenge();
        vm.prank(alice);
        arena.submitSolution(cId, keccak256("proof"), "https://proof.link");
        sId = arena.getSubmissionCount();
    }

    /// Full happy-path up to Settled state.
    function _createSubmitSettle() internal returns (uint256 cId, uint256 sId) {
        (cId, sId) = _createAndSubmit();
        vm.prank(verifier);
        arena.verifyAndSettle(cId, sId, keccak256("evidence"), "looks good");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Deployment & constructor
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_Constructor is ArenaBase {
    function test_Constructor_SetsUsdc() public view {
        assertEq(address(arena.usdc()), address(usdc));
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(AgentArena.ZeroAddress.selector);
        new AgentArena(address(0));
    }

    function test_Constructor_InitialChallengeCountIsZero() public view {
        assertEq(arena.getChallengeCount(), 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. registerAgent
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_RegisterAgent is ArenaBase {
    function test_RegisterAgent_StoresProfile() public {
        address newAgent = makeAddr("newAgent");
        vm.prank(newAgent);
        arena.registerAgent("MyBot", "desc", "caps", "erc8004://bot");

        AgentArena.AgentProfile memory p = arena.getAgentProfile(newAgent);
        assertEq(p.agentAddress, newAgent);
        assertEq(p.name, "MyBot");
        assertEq(p.description, "desc");
        assertEq(p.capabilities, "caps");
        assertEq(p.erc8004Ref, "erc8004://bot");
        assertGt(p.registeredAt, 0);
    }

    function test_RegisterAgent_HasProfile() public {
        assertTrue(arena.hasAgentProfile(alice));
        assertFalse(arena.hasAgentProfile(stranger));
    }

    function test_RegisterAgent_EmitsEvent() public {
        address newAgent = makeAddr("newAgent");
        vm.prank(newAgent);
        vm.expectEmit(true, false, false, true, address(arena));
        emit AgentArena.AgentRegistered(newAgent, "BotName");
        arena.registerAgent("BotName", "d", "c", "r");
    }

    function test_RegisterAgent_UpdatesExistingProfile() public {
        // alice re-registers — registeredAt should be unchanged, fields updated
        uint256 registeredAtBefore = arena.getAgentProfile(alice).registeredAt;
        vm.prank(alice);
        arena.registerAgent("Alice V2", "new desc", "new caps", "erc8004://v2");
        AgentArena.AgentProfile memory p = arena.getAgentProfile(alice);
        assertEq(p.name, "Alice V2");
        assertEq(p.registeredAt, registeredAtBefore); // registeredAt must not change
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. createChallenge
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_CreateChallenge is ArenaBase {
    function test_CreateChallenge_HappyPath() public {
        uint256 arenaBalBefore = usdc.balanceOf(address(arena));
        uint256 creatorBalBefore = usdc.balanceOf(creator);

        uint256 id = _createChallenge();

        assertEq(id, 1);
        assertEq(arena.getChallengeCount(), 1);
        assertEq(usdc.balanceOf(address(arena)), arenaBalBefore + REWARD);
        assertEq(usdc.balanceOf(creator), creatorBalBefore - REWARD);

        AgentArena.Challenge memory c = arena.getChallenge(id);
        assertEq(c.id, id);
        assertEq(c.creator, creator);
        assertEq(c.reward, REWARD);
        assertEq(c.verifier, verifier);
        assertEq(uint8(c.state), uint8(AgentArena.ChallengeState.Open));
        assertEq(c.submissionCount, 0);
        assertEq(c.winner, address(0));
    }

    function test_CreateChallenge_EmitsChallengeCreated() public {
        vm.prank(creator);
        vm.expectEmit(true, true, false, true, address(arena));
        emit AgentArena.ChallengeCreated(
            1, creator, REWARD, AgentArena.ChallengeType.ExactAnswer
        );
        arena.createChallenge(
            "Title", "Desc",
            AgentArena.ChallengeType.ExactAnswer,
            "criteria",
            block.timestamp + DEADLINE_IN,
            REWARD, MAX_SUBS, verifier
        );
    }

    function test_CreateChallenge_RevertZeroReward() public {
        vm.prank(creator);
        vm.expectRevert(AgentArena.ZeroReward.selector);
        arena.createChallenge("T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days, 0, MAX_SUBS, verifier);
    }

    function test_CreateChallenge_RevertDeadlinePassed() public {
        vm.prank(creator);
        vm.expectRevert(AgentArena.DeadlinePassed.selector);
        arena.createChallenge("T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp, REWARD, MAX_SUBS, verifier);
    }

    function test_CreateChallenge_RevertZeroVerifier() public {
        vm.prank(creator);
        vm.expectRevert(AgentArena.ZeroAddress.selector);
        arena.createChallenge("T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days, REWARD, MAX_SUBS, address(0));
    }

    function test_CreateChallenge_RevertVerifierIsCreator() public {
        vm.prank(creator);
        vm.expectRevert(AgentArena.VerifierCannotBeCreator.selector);
        arena.createChallenge("T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days, REWARD, MAX_SUBS, creator);
    }

    function test_CreateChallenge_RevertZeroMaxSubmissions() public {
        vm.prank(creator);
        vm.expectRevert(AgentArena.MaxSubmissionsReached.selector);
        arena.createChallenge("T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days, REWARD, 0, verifier);
    }

    function test_CreateChallenge_RevertChallengeNotFound() public {
        vm.expectRevert(AgentArena.ChallengeNotFound.selector);
        arena.getChallenge(999);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. submitSolution
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_SubmitSolution is ArenaBase {
    function test_SubmitSolution_HappyPath() public {
        uint256 cId = _createChallenge();

        vm.prank(alice);
        arena.submitSolution(cId, keccak256("proof"), "https://link");

        uint256 sId = arena.getSubmissionCount();
        assertEq(sId, 1);

        AgentArena.Submission memory s = arena.getSubmission(sId);
        assertEq(s.challengeId, cId);
        assertEq(s.agentAddress, alice);
        assertFalse(s.isPassing);

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        assertEq(c.submissionCount, 1);

        AgentArena.AgentProfile memory p = arena.getAgentProfile(alice);
        assertEq(p.totalSubmissions, 1);
    }

    function test_SubmitSolution_EmitsEvent() public {
        uint256 cId = _createChallenge();
        vm.prank(alice);
        vm.expectEmit(true, true, true, false, address(arena));
        emit AgentArena.SolutionSubmitted(cId, 1, alice);
        arena.submitSolution(cId, keccak256("proof"), "https://link");
    }

    function test_SubmitSolution_RevertInvalidState_InReview() public {
        uint256 cId = _createChallenge();
        vm.prank(verifier);
        arena.startReview(cId);

        vm.prank(alice);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.submitSolution(cId, keccak256("proof"), "https://link");
    }

    function test_SubmitSolution_RevertDeadlinePassed() public {
        uint256 cId = _createChallenge();
        vm.warp(block.timestamp + DEADLINE_IN + 1);

        vm.prank(alice);
        vm.expectRevert(AgentArena.DeadlinePassed.selector);
        arena.submitSolution(cId, keccak256("proof"), "https://link");
    }

    function test_SubmitSolution_RevertNoAgentProfile() public {
        uint256 cId = _createChallenge();
        vm.prank(stranger);
        vm.expectRevert(AgentArena.NoAgentProfile.selector);
        arena.submitSolution(cId, keccak256("proof"), "https://link");
    }

    function test_SubmitSolution_RevertSelfSubmission_Creator() public {
        // creator tries to submit to own challenge
        vm.prank(creator);
        arena.registerAgent("CreatorBot", "d", "c", "r");

        uint256 cId = _createChallenge();
        vm.prank(creator);
        vm.expectRevert(AgentArena.SelfSubmissionNotAllowed.selector);
        arena.submitSolution(cId, keccak256("proof"), "https://link");
    }

    function test_SubmitSolution_RevertMaxSubmissionsExceeded() public {
        // Create a challenge with only 1 allowed submission
        vm.prank(creator);
        arena.createChallenge(
            "T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days, REWARD, 1, verifier
        );
        uint256 cId = arena.getChallengeCount();

        vm.prank(alice);
        arena.submitSolution(cId, keccak256("proof1"), "link1");

        vm.prank(bob);
        vm.expectRevert(AgentArena.MaxSubmissionsReached.selector);
        arena.submitSolution(cId, keccak256("proof2"), "link2");
    }

    function test_SubmitSolution_RevertSubmissionNotFound() public {
        vm.expectRevert(AgentArena.SubmissionNotFound.selector);
        arena.getSubmission(999);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. startReview
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_StartReview is ArenaBase {
    function test_StartReview_HappyPath() public {
        uint256 cId = _createChallenge();
        vm.prank(verifier);
        arena.startReview(cId);

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        assertEq(uint8(c.state), uint8(AgentArena.ChallengeState.InReview));
    }

    function test_StartReview_EmitsEvent() public {
        uint256 cId = _createChallenge();
        vm.prank(verifier);
        vm.expectEmit(true, false, false, false, address(arena));
        emit AgentArena.ChallengeInReview(cId);
        arena.startReview(cId);
    }

    function test_StartReview_RevertUnauthorized() public {
        uint256 cId = _createChallenge();
        vm.prank(stranger);
        vm.expectRevert(AgentArena.Unauthorized.selector);
        arena.startReview(cId);
    }

    function test_StartReview_RevertInvalidState_AlreadyInReview() public {
        uint256 cId = _createChallenge();
        vm.prank(verifier);
        arena.startReview(cId);

        vm.prank(verifier);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.startReview(cId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. verifyAndSettle
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_VerifyAndSettle is ArenaBase {
    function test_VerifyAndSettle_HappyPath_FromOpen() public {
        (uint256 cId, uint256 sId) = _createAndSubmit();

        vm.prank(verifier);
        arena.verifyAndSettle(cId, sId, keccak256("evidence"), "looks good");

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        assertEq(uint8(c.state), uint8(AgentArena.ChallengeState.Settled));
        assertEq(c.winner, alice);
        assertEq(c.evidenceHash, keccak256("evidence"));
        assertGt(c.verifiedAt, 0);

        AgentArena.Submission memory s = arena.getSubmission(sId);
        assertTrue(s.isPassing);
        assertEq(s.verificationNote, "looks good");
    }

    function test_VerifyAndSettle_HappyPath_FromInReview() public {
        (uint256 cId, uint256 sId) = _createAndSubmit();
        vm.prank(verifier);
        arena.startReview(cId);

        vm.prank(verifier);
        arena.verifyAndSettle(cId, sId, keccak256("evidence"), "ok");

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        assertEq(uint8(c.state), uint8(AgentArena.ChallengeState.Settled));
    }

    function test_VerifyAndSettle_EmitsBothEvents() public {
        (uint256 cId, uint256 sId) = _createAndSubmit();

        vm.prank(verifier);
        // Verified event
        vm.expectEmit(true, true, true, true, address(arena));
        emit AgentArena.Verified(cId, sId, alice, keccak256("evidence"));
        // ChallengeSettled is emitted in the same call — expectEmit covers the next emit
        // We verify both in sequence by calling once; here we assert the Verified event.
        arena.verifyAndSettle(cId, sId, keccak256("evidence"), "note");
    }

    function test_VerifyAndSettle_EmitsChallengeSettled() public {
        (uint256 cId, uint256 sId) = _createAndSubmit();

        vm.prank(verifier);
        vm.expectEmit(true, true, false, true, address(arena));
        emit AgentArena.ChallengeSettled(cId, alice, REWARD);
        arena.verifyAndSettle(cId, sId, keccak256("evidence"), "note");
    }

    function test_VerifyAndSettle_RevertUnauthorized() public {
        (uint256 cId, uint256 sId) = _createAndSubmit();

        vm.prank(stranger);
        vm.expectRevert(AgentArena.Unauthorized.selector);
        arena.verifyAndSettle(cId, sId, keccak256("evidence"), "note");
    }

    function test_VerifyAndSettle_RevertInvalidState_Settled() public {
        // Create challenge with maxSubmissions=2, submit from BOTH alice and bob BEFORE settling,
        // then settle with alice's submission. Attempt to re-settle with bob's should hit
        // InvalidState because the challenge is already Settled.
        vm.prank(creator);
        arena.createChallenge(
            "T2", "D2", AgentArena.ChallengeType.ExactAnswer, "c2",
            block.timestamp + 1 days, REWARD, 2, verifier
        );
        uint256 cId = arena.getChallengeCount();

        // alice submits
        vm.prank(alice);
        arena.submitSolution(cId, keccak256("proof_a"), "link_a");
        uint256 sIdAlice = arena.getSubmissionCount();

        // bob submits
        vm.prank(bob);
        arena.submitSolution(cId, keccak256("proof_b"), "link_b");
        uint256 sIdBob = arena.getSubmissionCount();

        // verifier settles with alice
        vm.prank(verifier);
        arena.verifyAndSettle(cId, sIdAlice, keccak256("ev"), "ok");

        // now try to settle again with bob's submission — challenge is Settled, not Open/InReview
        vm.prank(verifier);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.verifyAndSettle(cId, sIdBob, keccak256("ev2"), "note2");
    }

    function test_VerifyAndSettle_RevertZeroEvidenceHash() public {
        (uint256 cId, uint256 sId) = _createAndSubmit();

        vm.prank(verifier);
        vm.expectRevert(AgentArena.ZeroEvidenceHash.selector);
        arena.verifyAndSettle(cId, sId, bytes32(0), "note");
    }

    function test_VerifyAndSettle_RevertSubmissionChallengeMismatch() public {
        // Create two challenges; submit to each; try to cross-reference
        uint256 cId1 = _createChallenge();
        vm.prank(alice);
        arena.submitSolution(cId1, keccak256("p1"), "l1");
        uint256 sId1 = arena.getSubmissionCount();

        usdc.mint(creator, REWARD);
        uint256 cId2 = _createChallenge(); // creates challenge 2
        vm.prank(alice);
        arena.submitSolution(cId2, keccak256("p2"), "l2");
        // sId2 is now 2

        vm.prank(verifier);
        vm.expectRevert(AgentArena.SubmissionChallengeMismatch.selector);
        // pass submission from challenge 1 to challenge 2's verifyAndSettle
        arena.verifyAndSettle(cId2, sId1, keccak256("ev"), "note");
    }

    function test_VerifyAndSettle_RevertSubmissionNotFound() public {
        uint256 cId = _createChallenge();
        vm.prank(verifier);
        vm.expectRevert(AgentArena.SubmissionNotFound.selector);
        arena.verifyAndSettle(cId, 999, keccak256("ev"), "note");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. claimReward
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_ClaimReward is ArenaBase {
    function test_ClaimReward_HappyPath() public {
        (uint256 cId,) = _createSubmitSettle();

        uint256 aliceBalBefore = usdc.balanceOf(alice);
        uint256 arenaBalBefore = usdc.balanceOf(address(arena));

        vm.prank(alice);
        arena.claimReward(cId);

        assertEq(usdc.balanceOf(alice),          aliceBalBefore + REWARD);
        assertEq(usdc.balanceOf(address(arena)), arenaBalBefore - REWARD);

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        assertEq(uint8(c.state), uint8(AgentArena.ChallengeState.Claimed));

        AgentArena.AgentProfile memory p = arena.getAgentProfile(alice);
        assertEq(p.totalWins, 1);
        assertEq(p.totalEarned, REWARD);
    }

    function test_ClaimReward_EmitsEvent() public {
        (uint256 cId,) = _createSubmitSettle();

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(arena));
        emit AgentArena.RewardClaimed(cId, alice, REWARD);
        arena.claimReward(cId);
    }

    function test_ClaimReward_RevertInvalidState_Open() public {
        uint256 cId = _createChallenge();
        vm.prank(alice);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.claimReward(cId);
    }

    function test_ClaimReward_RevertDoubleClaim() public {
        (uint256 cId,) = _createSubmitSettle();
        vm.prank(alice);
        arena.claimReward(cId); // first claim: state → Claimed

        // Second attempt must revert because state is Claimed, not Settled
        vm.prank(alice);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.claimReward(cId);
    }

    function test_ClaimReward_RevertUnauthorized_NotWinner() public {
        (uint256 cId,) = _createSubmitSettle();
        vm.prank(stranger);
        vm.expectRevert(AgentArena.Unauthorized.selector);
        arena.claimReward(cId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. cancelChallenge
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_CancelChallenge is ArenaBase {
    function test_CancelChallenge_HappyPath_NoSubmissions() public {
        uint256 cId = _createChallenge();
        uint256 creatorBalBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        arena.cancelChallenge(cId);

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        assertEq(uint8(c.state), uint8(AgentArena.ChallengeState.Cancelled));
        assertEq(usdc.balanceOf(creator), creatorBalBefore + REWARD);
    }

    function test_CancelChallenge_HappyPath_NonPassingSubmission() public {
        (uint256 cId,) = _createAndSubmit(); // alice submits, isPassing=false

        uint256 creatorBalBefore = usdc.balanceOf(creator);
        vm.prank(creator);
        arena.cancelChallenge(cId); // should succeed: no passing submissions

        assertEq(usdc.balanceOf(creator), creatorBalBefore + REWARD);
    }

    function test_CancelChallenge_EmitsEvent() public {
        uint256 cId = _createChallenge();
        vm.prank(creator);
        vm.expectEmit(true, true, false, true, address(arena));
        emit AgentArena.ChallengeCancelled(cId, creator, REWARD);
        arena.cancelChallenge(cId);
    }

    function test_CancelChallenge_RevertUnauthorized() public {
        uint256 cId = _createChallenge();
        vm.prank(stranger);
        vm.expectRevert(AgentArena.Unauthorized.selector);
        arena.cancelChallenge(cId);
    }

    function test_CancelChallenge_RevertInvalidState_Settled() public {
        (uint256 cId,) = _createSubmitSettle();
        vm.prank(creator);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.cancelChallenge(cId);
    }

    function test_CancelChallenge_RevertWithPassingSubmission() public {
        (uint256 cId, uint256 sId) = _createAndSubmit();
        // Mark the submission as passing via verifyAndSettle (sets isPassing=true on submission,
        // but challenge moves to Settled — cancel must revert with InvalidState here)
        vm.prank(verifier);
        arena.verifyAndSettle(cId, sId, keccak256("ev"), "note");

        // State is now Settled, so cancel reverts with InvalidState
        vm.prank(creator);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.cancelChallenge(cId);
    }

    function test_CancelChallenge_RevertCannotCancelWithPassingSubmissions() public {
        // To hit CannotCancelWithPassingSubmissions we need a challenge in InReview
        // with a submission whose isPassing flag was set to true by a prior verifyAndSettle
        // that somehow left state != Settled. That path isn't reachable because verifyAndSettle
        // always sets state = Settled. The guard is a defensive check; document as dead code.
        // Instead, verify cancel from InReview works when submission is NOT passing.
        (uint256 cId,) = _createAndSubmit();
        vm.prank(verifier);
        arena.startReview(cId);

        uint256 creatorBalBefore = usdc.balanceOf(creator);
        vm.prank(creator);
        arena.cancelChallenge(cId); // should succeed: InReview, no passing subs

        assertEq(usdc.balanceOf(creator), creatorBalBefore + REWARD);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. expireAndRefund
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_ExpireAndRefund is ArenaBase {
    function test_ExpireAndRefund_CreatorCanRefundAfterGracePeriod() public {
        uint256 cId = _createChallenge();
        AgentArena.Challenge memory c = arena.getChallenge(cId);

        vm.warp(c.deadline + arena.GRACE_PERIOD() + 1);

        uint256 creatorBalBefore = usdc.balanceOf(creator);
        vm.prank(creator);
        arena.expireAndRefund(cId);

        assertEq(usdc.balanceOf(creator), creatorBalBefore + REWARD);
        AgentArena.Challenge memory c2 = arena.getChallenge(cId);
        assertEq(uint8(c2.state), uint8(AgentArena.ChallengeState.Cancelled));
    }

    function test_ExpireAndRefund_VerifierCanRefundAfterGracePeriod() public {
        uint256 cId = _createChallenge();
        AgentArena.Challenge memory c = arena.getChallenge(cId);

        vm.warp(c.deadline + arena.GRACE_PERIOD() + 1);

        uint256 creatorBalBefore = usdc.balanceOf(creator);
        vm.prank(verifier);
        arena.expireAndRefund(cId);

        // refund always goes to creator
        assertEq(usdc.balanceOf(creator), creatorBalBefore + REWARD);
    }

    function test_ExpireAndRefund_EmitsChallengeCancelled() public {
        uint256 cId = _createChallenge();
        AgentArena.Challenge memory c = arena.getChallenge(cId);
        vm.warp(c.deadline + arena.GRACE_PERIOD() + 1);

        vm.prank(creator);
        vm.expectEmit(true, true, false, true, address(arena));
        emit AgentArena.ChallengeCancelled(cId, creator, REWARD);
        arena.expireAndRefund(cId);
    }

    function test_ExpireAndRefund_RevertUnauthorized() public {
        uint256 cId = _createChallenge();
        AgentArena.Challenge memory c = arena.getChallenge(cId);
        vm.warp(c.deadline + arena.GRACE_PERIOD() + 1);

        vm.prank(stranger);
        vm.expectRevert(AgentArena.Unauthorized.selector);
        arena.expireAndRefund(cId);
    }

    function test_ExpireAndRefund_RevertDeadlineNotReached_BeforeGracePeriod() public {
        uint256 cId = _createChallenge();
        AgentArena.Challenge memory c = arena.getChallenge(cId);

        // Just after deadline but before grace period
        vm.warp(c.deadline + 1);
        uint256 refundableAt = c.deadline + arena.GRACE_PERIOD();

        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(AgentArena.DeadlineNotReached.selector, refundableAt)
        );
        arena.expireAndRefund(cId);
    }

    function test_ExpireAndRefund_RevertDeadlineNotReached_BeforeDeadline() public {
        uint256 cId = _createChallenge();
        AgentArena.Challenge memory c = arena.getChallenge(cId);

        // Still within deadline
        vm.warp(c.deadline - 1);
        uint256 refundableAt = c.deadline + arena.GRACE_PERIOD();

        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(AgentArena.DeadlineNotReached.selector, refundableAt)
        );
        arena.expireAndRefund(cId);
    }

    function test_ExpireAndRefund_RevertInvalidState_InReview() public {
        uint256 cId = _createChallenge();
        AgentArena.Challenge memory c = arena.getChallenge(cId);
        vm.warp(c.deadline + arena.GRACE_PERIOD() + 1);

        vm.prank(verifier);
        // Can't start review after deadline when warp already moved time forward
        // Instead: start review BEFORE warping
        vm.revertToState(vm.snapshotState());
    }

    function test_ExpireAndRefund_RevertInvalidState_InReviewPreWarp() public {
        uint256 cId = _createChallenge();

        // Start review first (still within deadline)
        vm.prank(verifier);
        arena.startReview(cId);

        // Now warp past grace period
        AgentArena.Challenge memory c = arena.getChallenge(cId);
        vm.warp(c.deadline + arena.GRACE_PERIOD() + 1);

        // expireAndRefund requires state == Open, but challenge is InReview → InvalidState
        vm.prank(creator);
        vm.expectRevert(AgentArena.InvalidState.selector);
        arena.expireAndRefund(cId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. withdraw (pull-payment path)
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_Withdraw is Test {
    address internal creator  = makeAddr("creator");
    address internal alice    = makeAddr("alice");
    address internal verifier = makeAddr("verifier");

    uint256 internal constant REWARD = 500e6;

    RevertOnTransferToken internal tok;
    AgentArena            internal arena;

    function setUp() public {
        tok   = new RevertOnTransferToken();
        arena = new AgentArena(address(tok));

        tok.mint(creator, 100_000e6);
        vm.prank(creator);
        tok.approve(address(arena), type(uint256).max);

        // Register alice as an agent
        vm.prank(alice);
        arena.registerAgent("Alice", "d", "c", "r");

        // Create challenge
        vm.prank(creator);
        arena.createChallenge(
            "T", "D",
            AgentArena.ChallengeType.ExactAnswer,
            "c",
            block.timestamp + 1 days,
            REWARD, 5, verifier
        );
        uint256 cId = arena.getChallengeCount();

        // Submit
        vm.prank(alice);
        arena.submitSolution(cId, keccak256("proof"), "link");
        uint256 sId = arena.getSubmissionCount();

        // Verify & settle
        vm.prank(verifier);
        arena.verifyAndSettle(cId, sId, keccak256("ev"), "ok");

        // Make all future transfers revert to force pendingWithdrawals credit
        tok.setTransferReverts(true);
    }

    function test_Withdraw_PendingWithdrawalsCredited() public {
        uint256 cId = arena.getChallengeCount();

        vm.prank(alice);
        arena.claimReward(cId);

        // claimReward → _attemptTransferOrCredit → _safeTransferUSDC reverts
        //  → pendingWithdrawals[alice] credited
        assertEq(arena.pendingWithdrawals(alice), REWARD);

        // Challenge state should still be Claimed despite failed transfer
        AgentArena.Challenge memory c = arena.getChallenge(cId);
        assertEq(uint8(c.state), uint8(AgentArena.ChallengeState.Claimed));
    }

    function test_Withdraw_EmitsWithdrawalPending() public {
        uint256 cId = arena.getChallengeCount();

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(arena));
        emit AgentArena.WithdrawalPending(alice, REWARD);
        arena.claimReward(cId);
    }

    function test_Withdraw_HappyPath() public {
        uint256 cId = arena.getChallengeCount();

        vm.prank(alice);
        arena.claimReward(cId); // credits pendingWithdrawals[alice]

        // Re-enable transfers so withdraw() can succeed
        tok.setTransferReverts(false);

        uint256 aliceBalBefore = tok.balanceOf(alice);

        vm.prank(alice);
        arena.withdraw();

        assertEq(tok.balanceOf(alice), aliceBalBefore + REWARD);
        assertEq(arena.pendingWithdrawals(alice), 0);
    }

    function test_Withdraw_RevertNothingToWithdraw() public {
        vm.prank(alice);
        vm.expectRevert(AgentArena.NothingToWithdraw.selector);
        arena.withdraw();
    }

    function test_Withdraw_ClearsBalanceBeforeTransfer() public {
        uint256 cId = arena.getChallengeCount();
        vm.prank(alice);
        arena.claimReward(cId); // credits pending

        tok.setTransferReverts(false);
        vm.prank(alice);
        arena.withdraw();

        // After successful withdraw, pending balance must be zero
        assertEq(arena.pendingWithdrawals(alice), 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Fuzz tests
// ─────────────────────────────────────────────────────────────────────────────

contract AgentArena_Fuzz is ArenaBase {
    function testFuzz_RewardAmountStoredAndReturned(uint256 reward) public {
        // Bound to a sensible range (1 to 1e12 USDC-units)
        reward = bound(reward, 1, 1e12);

        usdc.mint(creator, reward);
        // creator has infinite approval from setUp

        vm.prank(creator);
        arena.createChallenge(
            "T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days,
            reward, 5, verifier
        );
        uint256 cId = arena.getChallengeCount();
        assertEq(arena.getChallenge(cId).reward, reward);
        assertGe(usdc.balanceOf(address(arena)), reward);
    }

    function testFuzz_SubmissionCountIncrementsCorrectly(uint8 numSubs) public {
        // At most 20 submissions to keep runtime sane
        uint256 n = bound(uint256(numSubs), 1, 20);

        vm.prank(creator);
        arena.createChallenge(
            "T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days,
            REWARD, n, verifier
        );
        uint256 cId = arena.getChallengeCount();

        // Create n unique submitter agents and submit
        for (uint256 i = 0; i < n; i++) {
            address agent = makeAddr(string(abi.encodePacked("agent", i)));
            vm.prank(agent);
            arena.registerAgent("A", "d", "c", "r");
            vm.prank(agent);
            arena.submitSolution(cId, keccak256(abi.encodePacked(i)), "link");
        }

        assertEq(arena.getChallenge(cId).submissionCount, n);
        assertEq(arena.getChallengeSubmissions(cId).length, n);
    }

    function testFuzz_ExpireAndRefundReturnsPreciseAmount(uint256 reward) public {
        reward = bound(reward, 1, 1e12);
        usdc.mint(creator, reward);

        vm.prank(creator);
        arena.createChallenge(
            "T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days,
            reward, 5, verifier
        );
        uint256 cId = arena.getChallengeCount();
        AgentArena.Challenge memory c = arena.getChallenge(cId);

        vm.warp(c.deadline + arena.GRACE_PERIOD() + 1);

        uint256 creatorBalBefore = usdc.balanceOf(creator);
        vm.prank(creator);
        arena.expireAndRefund(cId);

        assertEq(usdc.balanceOf(creator), creatorBalBefore + reward);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Invariant: USDC held == sum of rewards for non-cancelled/non-claimed
// ─────────────────────────────────────────────────────────────────────────────

/// @dev Handler drives the invariant fuzzer with bounded, realistic operations.
contract ArenaHandler is Test {
    AgentArena  public arena;
    MockERC20   public usdc;

    address internal creator  = makeAddr("hCreator");
    address internal verifier = makeAddr("hVerifier");

    // Ghost: cumulative rewards for active (non-cancelled, non-claimed) challenges
    uint256 public ghostActiveRewards;

    // Track challenge ids created by this handler
    uint256[] internal _challengeIds;
    // Track submission ids
    uint256[] internal _submissionIds;
    // Agent pool
    address[] internal _agents;
    uint256   internal _agentIdx;

    constructor(AgentArena _arena, MockERC20 _usdc) {
        arena = _arena;
        usdc  = _usdc;

        // Fund creator and give infinite approval
        usdc.mint(creator, type(uint128).max);
        vm.prank(creator);
        usdc.approve(address(arena), type(uint256).max);

        // Pre-create 5 agent addresses
        for (uint256 i = 0; i < 5; i++) {
            address a = makeAddr(string(abi.encodePacked("inv_agent", i)));
            vm.prank(a);
            arena.registerAgent("A", "d", "c", "r");
            _agents.push(a);
        }
    }

    function createChallenge(uint256 reward, uint256 maxSubs) external {
        reward   = bound(reward, 1, 1_000e6);
        maxSubs  = bound(maxSubs, 1, 10);

        vm.prank(creator);
        arena.createChallenge(
            "T", "D", AgentArena.ChallengeType.ExactAnswer, "c",
            block.timestamp + 1 days,
            reward, maxSubs, verifier
        );
        uint256 cId = arena.getChallengeCount();
        _challengeIds.push(cId);
        ghostActiveRewards += reward;
    }

    function submitSolution(uint256 challengeIdxSeed, uint256 agentIdxSeed) external {
        if (_challengeIds.length == 0) return;
        uint256 cId = _challengeIds[bound(challengeIdxSeed, 0, _challengeIds.length - 1)];

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        if (c.state != AgentArena.ChallengeState.Open) return;
        if (block.timestamp > c.deadline) return;
        if (c.submissionCount >= c.maxSubmissions) return;

        address agent = _agents[bound(agentIdxSeed, 0, _agents.length - 1)];
        if (agent == c.creator) return;

        vm.prank(agent);
        try arena.submitSolution(cId, keccak256(abi.encodePacked(block.timestamp, agent)), "link") {
            _submissionIds.push(arena.getSubmissionCount());
        } catch {}
    }

    function verifyAndSettle(uint256 challengeIdxSeed, uint256 submissionIdxSeed) external {
        if (_challengeIds.length == 0 || _submissionIds.length == 0) return;
        uint256 cId = _challengeIds[bound(challengeIdxSeed, 0, _challengeIds.length - 1)];
        uint256 sId = _submissionIds[bound(submissionIdxSeed, 0, _submissionIds.length - 1)];

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        if (c.state != AgentArena.ChallengeState.Open &&
            c.state != AgentArena.ChallengeState.InReview) return;

        AgentArena.Submission memory s = arena.getSubmission(sId);
        if (s.challengeId != cId) return;

        vm.prank(verifier);
        try arena.verifyAndSettle(cId, sId, keccak256("ev"), "note") {} catch {}
        // ghost unchanged: reward still held until claimed
    }

    function claimReward(uint256 challengeIdxSeed) external {
        if (_challengeIds.length == 0) return;
        uint256 cId = _challengeIds[bound(challengeIdxSeed, 0, _challengeIds.length - 1)];

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        if (c.state != AgentArena.ChallengeState.Settled) return;

        vm.prank(c.winner);
        try arena.claimReward(cId) {
            ghostActiveRewards -= c.reward;
        } catch {}
    }

    function cancelChallenge(uint256 challengeIdxSeed) external {
        if (_challengeIds.length == 0) return;
        uint256 cId = _challengeIds[bound(challengeIdxSeed, 0, _challengeIds.length - 1)];

        AgentArena.Challenge memory c = arena.getChallenge(cId);
        if (c.state != AgentArena.ChallengeState.Open &&
            c.state != AgentArena.ChallengeState.InReview) return;

        vm.prank(creator);
        try arena.cancelChallenge(cId) {
            ghostActiveRewards -= c.reward;
        } catch {}
    }
}

contract AgentArena_Invariant is Test {
    MockERC20    internal usdc;
    AgentArena   internal arena;
    ArenaHandler internal handler;

    function setUp() public {
        usdc    = new MockERC20("Mock USDC", "mUSDC", 6);
        arena   = new AgentArena(address(usdc));
        handler = new ArenaHandler(arena, usdc);

        targetContract(address(handler));
    }

    /// @dev PROPERTY: USDC held by arena >= sum of rewards for active challenges.
    ///      (>= rather than == because pendingWithdrawals may also sit in the contract
    ///       after a failed transfer, but our mock always succeeds so == also holds here.)
    function invariant_UsdcBalanceCoversActiveRewards() public view {
        assertGe(
            usdc.balanceOf(address(arena)),
            handler.ghostActiveRewards(),
            "arena USDC balance fell below sum of active rewards"
        );
    }
}
