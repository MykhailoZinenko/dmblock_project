export const PackOpeningAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "adminBasePriceWei",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "buyPack",
    "inputs": [
      {
        "name": "tier",
        "type": "uint8",
        "internalType": "enum PackOpening.PackTier"
      }
    ],
    "outputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "callbackGasLimit",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cardNFT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ICardNFT"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "effectivePriceWei",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gameConfig",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IGameConfig"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTierPool",
    "inputs": [
      {
        "name": "tier",
        "type": "uint8",
        "internalType": "enum PackOpening.PackTier"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "cardNFT_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "gameConfig_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "vrfCoordinator_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "keyHash_",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "subscriptionId_",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "keyHash",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lastTradePriceWei",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "marketplace",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mintedCount",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nativePayment",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rawFulfillRandomWords",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "randomWords",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recordTrade",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "priceWei",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requestConfirmations",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requests",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tier",
        "type": "uint8",
        "internalType": "enum PackOpening.PackTier"
      },
      {
        "name": "fulfilled",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setCardPrice",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "basePriceWei",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "currentTwapPriceWei",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "tradeCount",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMarketplace",
    "inputs": [
      {
        "name": "newMarketplace",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTierConfig",
    "inputs": [
      {
        "name": "tier",
        "type": "uint8",
        "internalType": "enum PackOpening.PackTier"
      },
      {
        "name": "priceWei",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "cardCount",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "guaranteedRarity",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "enabled",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTierPool",
    "inputs": [
      {
        "name": "tier",
        "type": "uint8",
        "internalType": "enum PackOpening.PackTier"
      },
      {
        "name": "cardIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setVrfConfig",
    "inputs": [
      {
        "name": "coordinator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "keyHash_",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "subscriptionId_",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "requestConfirmations_",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "callbackGasLimit_",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "nativePayment_",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "subscriptionId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tierConfigs",
    "inputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum PackOpening.PackTier"
      }
    ],
    "outputs": [
      {
        "name": "priceWei",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "cardCount",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "guaranteedRarity",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "enabled",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalTradeVolumeWei",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "twapPriceWei",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "uniqueTrades",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vrfCoordinator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IVRFCoordinatorV2Plus"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address payable"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "CardPriceSet",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "adminBasePriceWei",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "twapPriceWei",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "uniqueTrades",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      {
        "name": "version",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketplaceSet",
    "inputs": [
      {
        "name": "marketplace",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PackOpened",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tier",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum PackOpening.PackTier"
      },
      {
        "name": "firstTokenId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "cardIds",
        "type": "uint256[]",
        "indexed": false,
        "internalType": "uint256[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PackRequested",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tier",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum PackOpening.PackTier"
      },
      {
        "name": "paid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TierConfigSet",
    "inputs": [
      {
        "name": "tier",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum PackOpening.PackTier"
      },
      {
        "name": "priceWei",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "cardCount",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "guaranteedRarity",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "enabled",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TierPoolSet",
    "inputs": [
      {
        "name": "tier",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum PackOpening.PackTier"
      },
      {
        "name": "cardIds",
        "type": "uint256[]",
        "indexed": false,
        "internalType": "uint256[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeRecorded",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "priceWei",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "newTwapPriceWei",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "uniqueTrades",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VrfConfigSet",
    "inputs": [
      {
        "name": "coordinator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "keyHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "subscriptionId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "requestConfirmations",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "callbackGasLimit",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "nativePayment",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyFulfilled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidConfig",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidInitialization",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTier",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInitializing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotMarketplace",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OnlyCoordinator",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "PayoutFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PoolEmpty",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnknownRequest",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WrongPayment",
    "inputs": []
  }
] as const;
