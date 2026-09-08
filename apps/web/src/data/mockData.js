export const currentUser = {
  id: 'user-1',
  name: 'testUser1',
  address: '0x71C3A10A2b1b32d32A1f2C0123456789aBcDeF01',
  email: 'testuser1@example.com',
  avatar: 'TU1',
  verifiedHuman: false,
};

const ADDRESSES = {
  testUser1: '0x71C3A10A2b1b32d32A1f2C0123456789aBcDeF01',
  testUser2: '0x3aF8b9C2dE4567890123456789aBcDeF012345678',
  testUser3: '0xbC01dE234567890123456789aBcDeF01234567890',
  dummyUser1:'0x9e4F01234567890123456789aBcDeF0123456789',
  dummyUser2:'0x12Ab34Cd567890123456789aBcDeF01234567890',
};

export const splits = [
  {
    id: 'split-1',
    title: 'dummy_split_1',
    totalAmount: 420,
    collectedAmount: 280,
    payeeAddress: ADDRESSES.testUser1,
    payeeName: 'testUser1',
    status: 'partially_paid',
    requireVerification: false,
    createdAt: '2026-09-01',
    participants: [
      { id: 'p1', name: 'testUser1', address: ADDRESSES.testUser1, shareAmount: 140, paid: true, avatar: 'TU1' },
      { id: 'p2', name: 'testUser2', address: ADDRESSES.testUser2, shareAmount: 140, paid: true, avatar: 'TU2' },
      { id: 'p3', name: 'testUser3', address: ADDRESSES.testUser3, shareAmount: 140, paid: false, avatar: 'TU3' },
    ],
  },
  {
    id: 'split-2',
    title: 'dummy_split_2',
    totalAmount: 800,
    collectedAmount: 800,
    payeeAddress: ADDRESSES.dummyUser1,
    payeeName: 'dummyUser1',
    status: 'released',
    requireVerification: false,
    createdAt: '2026-08-28',
    participants: [
      { id: 'p4', name: 'dummyUser1', address: ADDRESSES.dummyUser1, shareAmount: 200, paid: true, avatar: 'DU1' },
      { id: 'p5', name: 'testUser1', address: ADDRESSES.testUser1, shareAmount: 200, paid: true, avatar: 'TU1' },
      { id: 'p6', name: 'dummyUser2', address: ADDRESSES.dummyUser2, shareAmount: 200, paid: true, avatar: 'DU2' },
      { id: 'p7', name: 'testUser3', address: ADDRESSES.testUser3, shareAmount: 200, paid: true, avatar: 'TU3' },
    ],
  },
  {
    id: 'split-3',
    title: 'dummy_split_3',
    totalAmount: 1200,
    collectedAmount: 400,
    payeeAddress: ADDRESSES.testUser1,
    payeeName: 'testUser1',
    status: 'partially_paid',
    requireVerification: false,
    createdAt: '2026-09-03',
    participants: [
      { id: 'p8', name: 'testUser1', address: ADDRESSES.testUser1, shareAmount: 400, paid: true, avatar: 'TU1' },
      { id: 'p9', name: 'testUser2', address: ADDRESSES.testUser2, shareAmount: 400, paid: false, avatar: 'TU2' },
      { id: 'p10', name: 'testUser3', address: ADDRESSES.testUser3, shareAmount: 400, paid: false, avatar: 'TU3' },
    ],
  },
  {
    id: 'split-4',
    title: 'dummy_split_4',
    totalAmount: 150,
    collectedAmount: 150,
    payeeAddress: ADDRESSES.dummyUser1,
    payeeName: 'dummyUser1',
    status: 'released',
    requireVerification: false,
    createdAt: '2026-08-20',
    participants: [
      { id: 'p11', name: 'testUser1', address: ADDRESSES.testUser1, shareAmount: 50, paid: true, avatar: 'TU1' },
      { id: 'p12', name: 'dummyUser1', address: ADDRESSES.dummyUser1, shareAmount: 50, paid: true, avatar: 'DU1' },
      { id: 'p13', name: 'dummyUser2', address: ADDRESSES.dummyUser2, shareAmount: 50, paid: true, avatar: 'DU2' },
    ],
  },
  {
    id: 'split-5',
    title: 'dummy_split_5',
    totalAmount: 85,
    collectedAmount: 0,
    payeeAddress: ADDRESSES.testUser2,
    payeeName: 'testUser2',
    status: 'pending',
    requireVerification: false,
    createdAt: '2026-09-04',
    participants: [
      { id: 'p14', name: 'testUser2', address: ADDRESSES.testUser2, shareAmount: 28.34, paid: false, avatar: 'TU2' },
      { id: 'p15', name: 'testUser1', address: ADDRESSES.testUser1, shareAmount: 28.33, paid: false, avatar: 'TU1' },
      { id: 'p16', name: 'testUser3', address: ADDRESSES.testUser3, shareAmount: 28.33, paid: false, avatar: 'TU3' },
    ],
  },
];

export const stats = {
  totalSplits: 5,
  activeSplits: 3,
  totalUSDC: 2655,
  myShare: 818.33,
};