export const GameConfigAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "addCard",
    "inputs": [
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "stats",
        "type": "tuple",
        "internalType": "struct CardStats",
        "components": [
          {
            "name": "cardType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "faction",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rarity",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "attack",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "defense",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "hp",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "initiative",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "speed",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "ammo",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "manaCost",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "size",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "magicResistance",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "schoolImmunity",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "effectImmunity",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "spellPower",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "duration",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "spellTargetType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "successChance",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "school",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      },
      {
        "name": "abilities",
        "type": "tuple[]",
        "internalType": "struct Ability[]",
        "components": [
          {
            "name": "abilityType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "triggerType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "targetType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "value",
            "type": "int16",
            "internalType": "int16"
          },
          {
            "name": "cooldown",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "aoeShape",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "schoolType",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      },
      {
        "name": "ipfsHash",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getCard",
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
        "type": "tuple",
        "internalType": "struct CardData",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "stats",
            "type": "tuple",
            "internalType": "struct CardStats",
            "components": [
              {
                "name": "cardType",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "faction",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "rarity",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "attack",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "defense",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "hp",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "initiative",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "speed",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "ammo",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "manaCost",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "size",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "magicResistance",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "schoolImmunity",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "effectImmunity",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "spellPower",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "duration",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "spellTargetType",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "successChance",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "school",
                "type": "uint8",
                "internalType": "uint8"
              }
            ]
          },
          {
            "name": "abilities",
            "type": "tuple[]",
            "internalType": "struct Ability[]",
            "components": [
              {
                "name": "abilityType",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "triggerType",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "targetType",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "value",
                "type": "int16",
                "internalType": "int16"
              },
              {
                "name": "cooldown",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "aoeShape",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "schoolType",
                "type": "uint8",
                "internalType": "uint8"
              }
            ]
          },
          {
            "name": "ipfsHash",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "exists",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCardCount",
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
    "name": "getCardStats",
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
        "type": "tuple",
        "internalType": "struct CardStats",
        "components": [
          {
            "name": "cardType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "faction",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rarity",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "attack",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "defense",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "hp",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "initiative",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "speed",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "ammo",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "manaCost",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "size",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "magicResistance",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "schoolImmunity",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "effectImmunity",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "spellPower",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "duration",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "spellTargetType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "successChance",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "school",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStarterDeck",
    "inputs": [],
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
    "name": "getStartingTrait",
    "inputs": [
      {
        "name": "faction",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "archetype",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
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
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setStarterDeck",
    "inputs": [
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
    "name": "setStartingTrait",
    "inputs": [
      {
        "name": "faction",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "archetype",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "traitId",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "updateCardAbilities",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newAbilities",
        "type": "tuple[]",
        "internalType": "struct Ability[]",
        "components": [
          {
            "name": "abilityType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "triggerType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "targetType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "value",
            "type": "int16",
            "internalType": "int16"
          },
          {
            "name": "cooldown",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "aoeShape",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "schoolType",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateCardIpfsHash",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newHash",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateCardStats",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newStats",
        "type": "tuple",
        "internalType": "struct CardStats",
        "components": [
          {
            "name": "cardType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "faction",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rarity",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "attack",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "defense",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "hp",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "initiative",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "speed",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "ammo",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "manaCost",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "size",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "magicResistance",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "schoolImmunity",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "effectImmunity",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "spellPower",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "duration",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "spellTargetType",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "successChance",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "school",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "CardAbilitiesUpdated",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CardAdded",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "name",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "cardType",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CardIpfsHashUpdated",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "newHash",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CardStatsUpdated",
    "inputs": [
      {
        "name": "cardId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
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
    "name": "StarterDeckUpdated",
    "inputs": [
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
    "name": "StartingTraitUpdated",
    "inputs": [
      {
        "name": "faction",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "archetype",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "traitId",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "InvalidInitialization",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInitializing",
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
  }
] as const;
