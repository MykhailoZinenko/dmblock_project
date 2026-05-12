// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IGameConfig} from "./interfaces/IGameConfig.sol";
import {ICardNFT} from "./interfaces/ICardNFT.sol";
import {IVRFCoordinatorV2Plus} from "./interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "./libraries/VRFV2PlusClient.sol";

contract PackOpening is Initializable, OwnableUpgradeable {
    enum PackTier {
        Common,
        Rare,
        Epic,
        Legendary
    }

    struct TierConfig {
        uint96 priceWei;
        uint16 cardCount;
        uint8 guaranteedRarity;
        bool enabled;
    }

    struct PackRequest {
        address player;
        PackTier tier;
        bool fulfilled;
    }

    ICardNFT public cardNFT;
    IGameConfig public gameConfig;
    IVRFCoordinatorV2Plus public vrfCoordinator;

    bytes32 public keyHash;
    uint256 public subscriptionId;
    uint16 public requestConfirmations;
    uint32 public callbackGasLimit;
    bool public nativePayment;
    bool private _entered;

    mapping(PackTier => TierConfig) public tierConfigs;
    mapping(PackTier => uint256[]) private _tierPools;
    mapping(uint256 => uint96) public adminBasePriceWei;
    mapping(uint256 => uint96) public twapPriceWei;
    mapping(uint256 => uint16) public uniqueTrades;
    mapping(uint256 => PackRequest) public requests;

    error InvalidAddress();
    error InvalidTier();
    error InvalidConfig();
    error PoolEmpty();
    error WrongPayment();
    error UnknownRequest();
    error AlreadyFulfilled();
    error OnlyCoordinator();
    error PayoutFailed();
    error ReentrantCall();

    event TierConfigSet(PackTier indexed tier, uint96 priceWei, uint16 cardCount, uint8 guaranteedRarity, bool enabled);
    event TierPoolSet(PackTier indexed tier, uint256[] cardIds);
    event CardPriceSet(uint256 indexed cardId, uint96 adminBasePriceWei, uint96 twapPriceWei, uint16 uniqueTrades);
    event VrfConfigSet(
        address indexed coordinator,
        bytes32 keyHash,
        uint256 subscriptionId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        bool nativePayment
    );
    event PackRequested(uint256 indexed requestId, address indexed player, PackTier indexed tier, uint256 paid);
    event PackOpened(
        uint256 indexed requestId,
        address indexed player,
        PackTier indexed tier,
        uint256 firstTokenId,
        uint256[] cardIds
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address cardNFT_,
        address gameConfig_,
        address vrfCoordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_
    ) external initializer {
        if (
            owner_ == address(0) || cardNFT_ == address(0) || gameConfig_ == address(0) || vrfCoordinator_ == address(0)
        ) {
            revert InvalidAddress();
        }

        __Ownable_init(owner_);
        cardNFT = ICardNFT(cardNFT_);
        gameConfig = IGameConfig(gameConfig_);
        vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinator_);
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        requestConfirmations = 3;
        callbackGasLimit = 1_500_000;
        nativePayment = false;

        tierConfigs[PackTier.Common] =
            TierConfig({priceWei: 0.002 ether, cardCount: 4, guaranteedRarity: 0, enabled: true});
        tierConfigs[PackTier.Rare] =
            TierConfig({priceWei: 0.0075 ether, cardCount: 5, guaranteedRarity: 1, enabled: true});
        tierConfigs[PackTier.Epic] =
            TierConfig({priceWei: 0.02 ether, cardCount: 6, guaranteedRarity: 2, enabled: true});
        tierConfigs[PackTier.Legendary] =
            TierConfig({priceWei: 0.075 ether, cardCount: 7, guaranteedRarity: 3, enabled: true});
    }

    modifier nonReentrant() {
        if (_entered) revert ReentrantCall();
        _entered = true;
        _;
        _entered = false;
    }

    function buyPack(PackTier tier) external payable nonReentrant returns (uint256 requestId) {
        TierConfig memory config = tierConfigs[tier];
        if (!config.enabled || config.cardCount == 0) revert InvalidTier();
        if (msg.value != config.priceWei) revert WrongPayment();
        if (_tierPools[tier].length == 0) revert PoolEmpty();

        requestId = vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient.argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: nativePayment}))
            })
        );

        requests[requestId] = PackRequest({player: msg.sender, tier: tier, fulfilled: false});
        emit PackRequested(requestId, msg.sender, tier, msg.value);
    }

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(vrfCoordinator)) revert OnlyCoordinator();
        PackRequest storage request = requests[requestId];
        if (request.player == address(0)) revert UnknownRequest();
        if (request.fulfilled) revert AlreadyFulfilled();
        request.fulfilled = true;

        TierConfig memory config = tierConfigs[request.tier];
        uint256[] memory cardIds = new uint256[](config.cardCount);
        uint256 seed = randomWords.length == 0 ? uint256(keccak256(abi.encode(requestId))) : randomWords[0];

        if (config.guaranteedRarity > 0) {
            cardIds[0] = _pickCard(request.tier, seed, config.guaranteedRarity);
            for (uint256 i = 1; i < config.cardCount; i++) {
                cardIds[i] = _pickCard(request.tier, uint256(keccak256(abi.encode(seed, i))), 0);
            }
        } else {
            for (uint256 i = 0; i < config.cardCount; i++) {
                cardIds[i] = _pickCard(request.tier, uint256(keccak256(abi.encode(seed, i))), 0);
            }
        }

        uint256 firstTokenId = cardNFT.batchMint(request.player, cardIds);
        emit PackOpened(requestId, request.player, request.tier, firstTokenId, cardIds);
    }

    function setTierConfig(PackTier tier, uint96 priceWei, uint16 cardCount, uint8 guaranteedRarity, bool enabled)
        external
        onlyOwner
    {
        if (cardCount == 0 || guaranteedRarity > 3) revert InvalidConfig();
        tierConfigs[tier] = TierConfig({
            priceWei: priceWei, cardCount: cardCount, guaranteedRarity: guaranteedRarity, enabled: enabled
        });
        emit TierConfigSet(tier, priceWei, cardCount, guaranteedRarity, enabled);
    }

    function setTierPool(PackTier tier, uint256[] calldata cardIds) external onlyOwner {
        if (cardIds.length == 0) revert PoolEmpty();

        delete _tierPools[tier];
        for (uint256 i = 0; i < cardIds.length; i++) {
            if (cardIds[i] >= gameConfig.getCardCount()) revert InvalidConfig();
            _tierPools[tier].push(cardIds[i]);
        }

        emit TierPoolSet(tier, cardIds);
    }

    function setCardPrice(uint256 cardId, uint96 basePriceWei, uint96 currentTwapPriceWei, uint16 tradeCount)
        external
        onlyOwner
    {
        if (cardId >= gameConfig.getCardCount() || basePriceWei == 0) revert InvalidConfig();
        adminBasePriceWei[cardId] = basePriceWei;
        twapPriceWei[cardId] = currentTwapPriceWei;
        uniqueTrades[cardId] = tradeCount;
        emit CardPriceSet(cardId, basePriceWei, currentTwapPriceWei, tradeCount);
    }

    function setVrfConfig(
        address coordinator,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint16 requestConfirmations_,
        uint32 callbackGasLimit_,
        bool nativePayment_
    ) external onlyOwner {
        if (coordinator == address(0) || requestConfirmations_ == 0 || callbackGasLimit_ == 0) revert InvalidConfig();
        vrfCoordinator = IVRFCoordinatorV2Plus(coordinator);
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        requestConfirmations = requestConfirmations_;
        callbackGasLimit = callbackGasLimit_;
        nativePayment = nativePayment_;
        emit VrfConfigSet(
            coordinator, keyHash_, subscriptionId_, requestConfirmations_, callbackGasLimit_, nativePayment_
        );
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) amount = address(this).balance;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert PayoutFailed();
    }

    function getTierPool(PackTier tier) external view returns (uint256[] memory) {
        return _tierPools[tier];
    }

    function effectivePriceWei(uint256 cardId) public view returns (uint96) {
        if (uniqueTrades[cardId] >= 10 && twapPriceWei[cardId] > 0) {
            return twapPriceWei[cardId];
        }
        return adminBasePriceWei[cardId];
    }

    function _pickCard(PackTier tier, uint256 seed, uint8 minRarity) private view returns (uint256) {
        uint256[] storage pool = _tierPools[tier];
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < pool.length; i++) {
            uint256 cardId = pool[i];
            if (gameConfig.getCardStats(cardId).rarity < minRarity) continue;
            totalWeight += _cardWeight(cardId);
        }

        if (totalWeight == 0) revert PoolEmpty();

        uint256 cursor = seed % totalWeight;
        for (uint256 i = 0; i < pool.length; i++) {
            uint256 cardId = pool[i];
            if (gameConfig.getCardStats(cardId).rarity < minRarity) continue;
            uint256 weight = _cardWeight(cardId);
            if (cursor < weight) return cardId;
            cursor -= weight;
        }

        return pool[pool.length - 1];
    }

    function _cardWeight(uint256 cardId) private view returns (uint256) {
        uint96 price = effectivePriceWei(cardId);
        if (price == 0) revert InvalidConfig();
        return 1e24 / price;
    }
}
