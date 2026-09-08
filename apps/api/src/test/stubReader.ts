export type StubEscrowStatus = {
  collected: bigint;
  target: bigint;
  released: boolean;
};

let current: StubEscrowStatus = { collected: 0n, target: 0n, released: false };

export function setEscrowStatus(status: StubEscrowStatus): void {
  current = status;
}

export async function getEscrowStatus(): Promise<StubEscrowStatus> {
  return current;
}
