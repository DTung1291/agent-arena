// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentArena is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum ChallengeType {
        ExactAnswer,
        StructuredData,
        CodeOutput
    }

    enum ChallengeState {
        Open,
        InReview,
        Settled,
        Claimed,
        Cancelled
    }

    struct Challenge {
        uint256 id;
        address creator;
        string title;
        string description;
        ChallengeType challengeType;
        string successCriteria;
        uint256 deadline;
        uint256 reward;
        uint256 maxSubmissions;
        address verifier;
        ChallengeState state;
        address winner;
        uint256 submissionCount;
        bytes32 evidenceHash;
        uint256 verifiedAt;
    }

    struct Submission {
        uint256 id;
        uint256 challengeId;
        address agentAddress;
        bytes32 proofHash;
        string proofLink;
        uint256 submittedAt;
        bool isPassing;
        string verificationNote;
    }

    struct AgentProfile {
        address agentAddress;
        string name;
        string description;
        string capabilities;
        string erc8004Ref;
        uint256 registeredAt;
        uint256 totalWins;
        uint256 totalSubmissions;
        uint256 totalEarned;
    }

    error ChallengeNotFound();
    error SubmissionNotFound();
    error Unauthorized();
    error InvalidState();
    error DeadlinePassed();
    error DeadlineNotReached(uint256 availableAt);
    error ZeroReward();
    error ZeroAddress();
    error MaxSubmissionsReached();
    error AlreadyRegistered();
    error VerifierCannotBeCreator();
    error CannotCancelWithPassingSubmissions();
    error NoAgentProfile();
    error SelfSubmissionNotAllowed();
    error SubmissionChallengeMismatch();
    error ZeroEvidenceHash();
    error NothingToWithdraw();

    event ChallengeCreated(
        uint256 indexed challengeId,
        address indexed creator,
        uint256 reward,
        ChallengeType challengeType
    );
    event SolutionSubmitted(uint256 indexed challengeId, uint256 indexed submissionId, address indexed agent);
    event AgentRegistered(address indexed agent, string name);
    event Verified(uint256 indexed challengeId, uint256 indexed submissionId, address indexed winner, bytes32 evidenceHash);
    event ChallengeSettled(uint256 indexed challengeId, address indexed winner, uint256 reward);
    event RewardClaimed(uint256 indexed challengeId, address indexed winner, uint256 reward);
    event ChallengeCancelled(uint256 indexed challengeId, address indexed creator, uint256 refund);
    event ChallengeInReview(uint256 indexed challengeId);
    event WithdrawalPending(address indexed recipient, uint256 amount);

    IERC20 public immutable usdc;
    uint256 public constant GRACE_PERIOD = 1 hours;

    mapping(uint256 => Challenge) private challenges;
    mapping(uint256 => Submission) private submissions;
    mapping(address => AgentProfile) private agentProfiles;
    mapping(uint256 => uint256[]) private challengeSubmissions;
    mapping(address => uint256) public pendingWithdrawals;

    uint256 private challengeCount;
    uint256 private submissionCount;

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    function createChallenge(
        string calldata title,
        string calldata description,
        ChallengeType challengeType,
        string calldata successCriteria,
        uint256 deadline,
        uint256 reward,
        uint256 maxSubmissions,
        address verifier
    ) external {
        if (reward == 0) revert ZeroReward();
        if (deadline <= block.timestamp) revert DeadlinePassed();
        if (verifier == address(0)) revert ZeroAddress();
        if (verifier == msg.sender) revert VerifierCannotBeCreator();
        if (maxSubmissions == 0) revert MaxSubmissionsReached();

        uint256 newChallengeId = challengeCount + 1;
        challengeCount = newChallengeId;

        challenges[newChallengeId] = Challenge({
            id: newChallengeId,
            creator: msg.sender,
            title: title,
            description: description,
            challengeType: challengeType,
            successCriteria: successCriteria,
            deadline: deadline,
            reward: reward,
            maxSubmissions: maxSubmissions,
            verifier: verifier,
            state: ChallengeState.Open,
            winner: address(0),
            submissionCount: 0,
            evidenceHash: bytes32(0),
            verifiedAt: 0
        });

        usdc.safeTransferFrom(msg.sender, address(this), reward);

        emit ChallengeCreated(newChallengeId, msg.sender, reward, challengeType);
    }

    function submitSolution(uint256 challengeId, bytes32 proofHash, string calldata proofLink) external {
        Challenge storage challenge = _getExistingChallenge(challengeId);

        if (challenge.state != ChallengeState.Open) revert InvalidState();
        if (block.timestamp > challenge.deadline) revert DeadlinePassed();
        if (!hasAgentProfile(msg.sender)) revert NoAgentProfile();
        if (msg.sender == challenge.creator) revert SelfSubmissionNotAllowed();
        if (challenge.submissionCount >= challenge.maxSubmissions) revert MaxSubmissionsReached();

        uint256 newSubmissionId = submissionCount + 1;
        submissionCount = newSubmissionId;

        submissions[newSubmissionId] = Submission({
            id: newSubmissionId,
            challengeId: challengeId,
            agentAddress: msg.sender,
            proofHash: proofHash,
            proofLink: proofLink,
            submittedAt: block.timestamp,
            isPassing: false,
            verificationNote: ""
        });

        challengeSubmissions[challengeId].push(newSubmissionId);
        challenge.submissionCount += 1;

        AgentProfile storage profile = agentProfiles[msg.sender];
        profile.totalSubmissions += 1;

        emit SolutionSubmitted(challengeId, newSubmissionId, msg.sender);
    }

    function registerAgent(
        string calldata name,
        string calldata description,
        string calldata capabilities,
        string calldata erc8004Ref
    ) external {
        AgentProfile storage profile = agentProfiles[msg.sender];

        if (profile.registeredAt == 0) {
            profile.agentAddress = msg.sender;
            profile.registeredAt = block.timestamp;
        }

        profile.name = name;
        profile.description = description;
        profile.capabilities = capabilities;
        profile.erc8004Ref = erc8004Ref;

        emit AgentRegistered(msg.sender, name);
    }

    function startReview(uint256 challengeId) external {
        Challenge storage challenge = _getExistingChallenge(challengeId);

        if (msg.sender != challenge.verifier) revert Unauthorized();
        if (challenge.state != ChallengeState.Open) revert InvalidState();

        challenge.state = ChallengeState.InReview;

        emit ChallengeInReview(challengeId);
    }

    /// @dev Trust model: verification is performed off-chain by the designated verifier address. The evidenceHash parameter MUST be the keccak256 of the verification computation log. The verifier is trusted to apply successCriteria per challengeType; this contract enforces only that a non-zero evidenceHash is supplied and that state transitions are valid.
    function verifyAndSettle(
        uint256 challengeId,
        uint256 submissionId,
        bytes32 evidenceHash,
        string calldata verificationNote
    ) external {
        Challenge storage challenge = _getExistingChallenge(challengeId);
        Submission storage submission = _getExistingSubmission(submissionId);

        if (msg.sender != challenge.verifier) revert Unauthorized();
        if (challenge.state != ChallengeState.Open && challenge.state != ChallengeState.InReview) revert InvalidState();
        if (submission.challengeId != challengeId) revert SubmissionChallengeMismatch();
        if (evidenceHash == bytes32(0)) revert ZeroEvidenceHash();

        submission.isPassing = true;
        submission.verificationNote = verificationNote;

        challenge.winner = submission.agentAddress;
        challenge.state = ChallengeState.Settled;
        challenge.evidenceHash = evidenceHash;
        challenge.verifiedAt = block.timestamp;

        emit Verified(challengeId, submissionId, submission.agentAddress, evidenceHash);
        emit ChallengeSettled(challengeId, submission.agentAddress, challenge.reward);
    }

    function claimReward(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = _getExistingChallenge(challengeId);

        if (challenge.state != ChallengeState.Settled) revert InvalidState();
        if (msg.sender != challenge.winner) revert Unauthorized();

        uint256 reward = challenge.reward;

        challenge.state = ChallengeState.Claimed;

        AgentProfile storage profile = agentProfiles[msg.sender];
        profile.totalWins += 1;
        profile.totalEarned += reward;

        _attemptTransferOrCredit(msg.sender, reward);

        emit RewardClaimed(challengeId, msg.sender, reward);
    }

    function cancelChallenge(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = _getExistingChallenge(challengeId);

        if (msg.sender != challenge.creator) revert Unauthorized();
        if (challenge.state != ChallengeState.Open && challenge.state != ChallengeState.InReview) revert InvalidState();

        uint256[] storage ids = challengeSubmissions[challengeId];
        uint256 length = ids.length;
        for (uint256 i = 0; i < length; ) {
            if (submissions[ids[i]].isPassing) revert CannotCancelWithPassingSubmissions();
            unchecked {
                ++i;
            }
        }

        uint256 refund = challenge.reward;

        challenge.state = ChallengeState.Cancelled;

        _attemptTransferOrCredit(challenge.creator, refund);

        emit ChallengeCancelled(challengeId, challenge.creator, refund);
    }

    function expireAndRefund(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = _getExistingChallenge(challengeId);

        if (msg.sender != challenge.creator && msg.sender != challenge.verifier) revert Unauthorized();
        if (challenge.state != ChallengeState.Open) revert InvalidState();

        uint256 refundableAt = challenge.deadline + GRACE_PERIOD;
        if (block.timestamp < refundableAt) revert DeadlineNotReached(refundableAt);

        uint256 refund = challenge.reward;

        challenge.state = ChallengeState.Cancelled;

        _attemptTransferOrCredit(challenge.creator, refund);

        emit ChallengeCancelled(challengeId, challenge.creator, refund);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
    }

    function _safeTransferUSDC(address recipient, uint256 amount) external {
        if (msg.sender != address(this)) revert Unauthorized();
        usdc.safeTransfer(recipient, amount);
    }

    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return _getExistingChallenge(challengeId);
    }

    function getSubmission(uint256 submissionId) external view returns (Submission memory) {
        return _getExistingSubmission(submissionId);
    }

    function getAgentProfile(address agent) external view returns (AgentProfile memory) {
        return agentProfiles[agent];
    }

    function getChallengeSubmissions(uint256 challengeId) external view returns (uint256[] memory) {
        _revertIfChallengeMissing(challengeId);
        return challengeSubmissions[challengeId];
    }

    function getChallengeCount() external view returns (uint256) {
        return challengeCount;
    }

    function getSubmissionCount() external view returns (uint256) {
        return submissionCount;
    }

    function hasAgentProfile(address agent) public view returns (bool) {
        return agentProfiles[agent].registeredAt != 0;
    }

    function _attemptTransferOrCredit(address recipient, uint256 amount) internal {
        try this._safeTransferUSDC(recipient, amount) {
            return;
        } catch {
            pendingWithdrawals[recipient] += amount;
            emit WithdrawalPending(recipient, amount);
        }
    }

    function _getExistingChallenge(uint256 challengeId) internal view returns (Challenge storage challenge) {
        _revertIfChallengeMissing(challengeId);
        return challenges[challengeId];
    }

    function _getExistingSubmission(uint256 submissionId) internal view returns (Submission storage submission) {
        if (submissionId == 0 || submissionId > submissionCount) revert SubmissionNotFound();
        return submissions[submissionId];
    }

    function _revertIfChallengeMissing(uint256 challengeId) internal view {
        if (challengeId == 0 || challengeId > challengeCount) revert ChallengeNotFound();
    }
}
