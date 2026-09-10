export const escrowAbi = [
  {
    type: "function",
    name: "openSplit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "splitId", type: "uint256" },
      { name: "payeeAddress", type: "address" },
      { name: "target", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "splitId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "splitId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getSplitStatus",
    stateMutability: "view",
    inputs: [{ name: "splitId", type: "uint256" }],
    outputs: [
      { name: "collected", type: "uint256" },
      { name: "target", type: "uint256" },
      { name: "released", type: "bool" },
    ],
  },
] as const;
