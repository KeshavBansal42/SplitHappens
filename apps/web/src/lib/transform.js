export function deriveName(email, userId) {
  if (email) return email.split('@')[0];
  if (userId) return userId.slice(0, 8);
  return 'Unknown';
}

export function deriveAvatar(name) {
  return name.slice(0, 2).toUpperCase();
}

export function adaptParticipant(p, currentUser) {
  const name = deriveName(null, p.userId);
  const wallet = currentUser?.wallet?.toLowerCase() || '';
  return {
    id: p.id,
    name,
    avatar: deriveAvatar(name),
    address: p.walletAddress || 'Not connected',
    shareAmount: parseFloat(p.shareAmount),
    paid: p.paid,
    txHash: p.txHash,
    isCurrentUser: p.walletAddress?.toLowerCase() === wallet,
  };
}

export function adaptSplit(split, currentUser) {
  const participants = split.participants.map((p) =>
    adaptParticipant(p, currentUser)
  );
  const collectedAmount = participants
    .filter((p) => p.paid)
    .reduce((sum, p) => sum + p.shareAmount, 0);

  return {
    id: split.id,
    title: split.title,
    totalAmount: parseFloat(split.totalAmount),
    collectedAmount,
    payeeAddress: split.payeeAddress,
    payeeName: deriveName(null, split.participants[0]?.userId),
    status: split.status,
    requireVerification: split.requireVerification,
    createdAt: split.createdAt?.split('T')[0] || '',
    participants,
    invites: split.invites || [],
  };
}

export function adaptSplitList(splits, currentUser) {
  return splits.map((s) => adaptSplit(s, currentUser));
}

export function computeStats(splits, currentUser) {
  const totalSplits = splits.length;
  const activeSplits = splits.filter(
    (s) => s.status === 'partially_paid' || s.status === 'pending'
  ).length;
  const totalUSDC = splits.reduce((sum, s) => sum + s.totalAmount, 0);
  const myShare = splits.reduce((sum, s) => {
    const me = s.participants.find((p) => p.isCurrentUser);
    return sum + (me ? me.shareAmount : 0);
  }, 0);

  return { totalSplits, activeSplits, totalUSDC, myShare };
}