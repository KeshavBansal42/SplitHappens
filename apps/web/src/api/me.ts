const KEY = "splithappens.my-user-id";

export function getMyUserId(): string | null {
  return localStorage.getItem(KEY);
}

export function setMyUserId(userId: string): void {
  localStorage.setItem(KEY, userId);
}
