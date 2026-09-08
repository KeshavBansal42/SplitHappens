import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the process. In tests this is replaced
// by the vitest mock before the app is imported.
export const prisma = new PrismaClient();
