export function deriveName(email, userId) {
  if (email) return email.split('@')[0];
  if (userId) return userId.slice(0, 8);
  return 'Unknown';
}

export function deriveAvatar(name) {
  return name.slice(0, 2).toUpperCase();
}

export function adaptParticipant(p, currentUser) {
  // Prefer the email so people are identifiable, not a database id.
  const name = p.email || deriveName(null, p.userId);
  const wallet = currentUser?.wallet?.toLowerCase() || '';
  return {
    id: p.id,
    userId: p.userId,
    email: p.email || null,
    name,
    avatar: deriveAvatar(name),
    address: p.walletAddress || 'Not connected',
    walletAddress: p.walletAddress,
    shareAmount: parseFloat(p.shareAmount),
    shareAmountRaw: p.shareAmount,
    paid: p.paid,
    txHash: p.txHash,
    isCurrentUser: Boolean(wallet) && p.walletAddress?.toLowerCase() === wallet,
  };
}

export function adaptSummary(s) {
  return {
    id: s.id,
    title: s.title,
    totalAmount: parseFloat(s.totalAmount),
    collectedAmount: parseFloat(s.paidAmount || '0'),
    paidCount: s.paidCount || 0,
    payeeAddress: s.payeeAddress,
    status: s.status,
    participantCount: s.participantCount,
    opened: s.opened,
    createdAt: (s.createdAt || '').split('T')[0],
    myShareAmount:
      s.myShareAmount === null || s.myShareAmount === undefined
        ? null
        : parseFloat(s.myShareAmount),
  };
}

export function adaptSplitList(splits) {
  return splits.map(adaptSummary);
}

export function adaptStatus(status, currentUser) {
  const split = status.split;
  const participants = (status.participants || []).map((p) =>
    adaptParticipant(p, currentUser)
  );
  const collected = parseFloat(status.onChain?.collected || '0');
  const target = parseFloat(status.onChain?.target || split.totalAmount);

  return {
    id: split.id,
    title: split.title,
    totalAmount: parseFloat(split.totalAmount),
    totalAmountRaw: split.totalAmount,
    collectedAmount: collected,
    targetAmount: target,
    onChainReleased: Boolean(status.onChain?.released),
    fullyFunded: target > 0 && collected >= target,
    payeeAddress: split.payeeAddress,
    status: split.status,
    requireVerification: split.requireVerification,
    participantCount: split.participantCount,
    creatorId: split.creatorId,
    opened: split.opened,
    participants,
    invites: status.invites || [],
    me: participants.find((p) => p.isCurrentUser) || null,
  };
}

export function computeStats(splits) {
  const totalSplits = splits.length;
  const activeSplits = splits.filter((s) => s.status !== 'released').length;
  const totalUSDC = splits.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const myShare = splits.reduce(
    (sum, s) => sum + (s.myShareAmount || 0),
    0
  );

  return { totalSplits, activeSplits, totalUSDC, myShare };
}
