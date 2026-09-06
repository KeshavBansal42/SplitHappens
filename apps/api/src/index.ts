import { randomUUID } from "node:crypto";

export function placeholder(): string {
  return `api-${randomUUID()}`;
}

console.log(placeholder());
