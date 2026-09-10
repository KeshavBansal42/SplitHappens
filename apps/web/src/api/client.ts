import type {
  AddInvitesRequest,
  CreateSplitRequest,
  CreateSplitResponse,
  GetSplitResponse,
  InvitedSplitsResponse,
  JoinSplitResponse,
  MySplitsResponse,
  OpenSplitRequest,
  PaySplitRequest,
  Participant,
  SplitStatusResponse,
} from "@splithappens/shared";

export type ApiAuth =
  | {
      mode: "privy";
      getAccessToken: () => Promise<string | null>;
      getIdentityToken?: () => string | null;
    }
  | { mode: "dev"; userId: string; wallet: string };

export type ApiErrorBody = {
  error: { code: string; message: string };
  details?: unknown;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(body: ApiErrorBody, readonly status: number) {
    super(body.error.message);
    this.code = body.error.code;
    this.details = body.details;
  }
}

export function createApiClient(auth: ApiAuth) {
  async function headers(): Promise<Record<string, string>> {
    const base = { "content-type": "application/json" };
    if (auth.mode === "privy") {
      const token = await auth.getAccessToken();
      const identity = auth.getIdentityToken?.() ?? null;
      return {
        ...base,
        authorization: token ? `Bearer ${token}` : "",
        ...(identity ? { "x-privy-id-token": identity } : {}),
      };
    }
    return {
      ...base,
      "x-dev-user-id": auth.userId,
      "x-dev-wallet": auth.wallet,
    };
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`/api/v1${path}`, {
      method,
      headers: await headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as
        | ApiErrorBody
        | null;
      throw new ApiClientError(
        payload ?? {
          error: {
            code: "INTERNAL_ERROR",
            message: `Request failed with status ${res.status}`,
          },
        },
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  return {
    createSplit(input: CreateSplitRequest) {
      return request<CreateSplitResponse>("POST", "/splits", input);
    },
    openSplit(id: string, input: OpenSplitRequest) {
      return request<GetSplitResponse>("POST", `/splits/${id}/open`, input);
    },
    getSplit(id: string) {
      return request<GetSplitResponse>("GET", `/splits/${id}`);
    },
    getInvitedSplits() {
      return request<InvitedSplitsResponse>("GET", "/splits/invited");
    },
    getMySplits() {
      return request<MySplitsResponse>("GET", "/splits/mine");
    },
    joinSplit(id: string) {
      return request<JoinSplitResponse>("POST", `/splits/${id}/join`, {});
    },
    addInvites(id: string, input: AddInvitesRequest) {
      return request<GetSplitResponse>("POST", `/splits/${id}/invites`, input);
    },
    paySplit(id: string, input: PaySplitRequest) {
      return request<Participant>("POST", `/splits/${id}/pay`, input);
    },
    getStatus(id: string) {
      return request<SplitStatusResponse>("GET", `/splits/${id}/status`);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
