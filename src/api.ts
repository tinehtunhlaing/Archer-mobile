import { Platform } from "react-native";

export type Role = "CLIENT" | "FREELANCER" | "ADMIN";
export type Currency = "USD" | "MMK";
export type Locale = "en" | "my";

export type Profile = {
  id: string;
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
  role?: Role;
  memberSince?: string;
};

export type User = {
  id: string;
  email: string;
  role: Role;
  profile?: Profile | null;
  createdAt?: string;
};

export type Job = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  budgetType: "FIXED" | "HOURLY";
  budgetMin: string | null;
  budgetMax: string | null;
  currency: Currency;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  client?: { id: string; profile: { displayName: string } | null };
  _count?: { proposals: number };
};

export type Proposal = {
  id: string;
  jobId: string;
  freelancerId: string;
  coverLetter: string;
  bidAmount: string | null;
  currency: Currency | null;
  status: "PENDING" | "REJECTED" | "WITHDRAWN";
  createdAt: string;
  job?: Pick<Job, "id" | "title" | "currency" | "status">;
  freelancer?: {
    id: string;
    // The proposals route includes the raw Prisma profile, whose skills field is JSON text.
    profile: (Omit<Profile, "skills"> & { skills: string }) | null;
  };
  conversation?: { id: string } | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender?: { id: string; profile: { displayName: string } | null };
};

export type Conversation = {
  id: string;
  jobId: string;
  clientId: string;
  freelancerId: string;
  createdAt: string;
  job: Pick<Job, "id" | "title" | "status">;
  client: { id: string; profile: { displayName: string } | null };
  freelancer: { id: string; profile: { displayName: string } | null };
  messages: Message[];
};

type ApiEnvelope<T> = { data: T; nextCursor?: string | null };
type ApiFailure = { error?: { code?: string; message?: string } };

const localApiHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const API_BASE = (
  configuredApiUrl
    ? Platform.OS === "android"
      ? configuredApiUrl.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i, (_match, scheme: string) => `${scheme}10.0.2.2`)
      : configuredApiUrl
    : `http://${localApiHost}:4000/api`
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH";
    body?: unknown;
    token?: string | null;
    locale?: Locale;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": options.locale ?? "en",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError("Could not reach Archer API. Check the API URL and server.", 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> & ApiFailure;
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.error?.code,
    );
  }
  if (!payload || !("data" in payload)) {
    throw new ApiError("The API returned an unexpected response.", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

export const authApi = {
  register: (input: { email: string; password: string; role: Exclude<Role, "ADMIN">; displayName: string }, locale?: Locale) =>
    apiRequest<{ user: User; accessToken: string; tokenType: "Bearer" }>("/auth/register", { method: "POST", body: input, locale }),
  login: (input: { email: string; password: string }, locale?: Locale) =>
    apiRequest<{ user: User; accessToken: string; tokenType: "Bearer" }>("/auth/login", { method: "POST", body: input, locale }),
  me: (token: string, locale?: Locale) => apiRequest<User>("/auth/me", { token, locale }),
};

export const jobsApi = {
  mine: (token: string, limit = 100, locale?: Locale) =>
    apiRequest<Job[]>(`/jobs/mine?limit=${limit}`, { token, locale }),
  list: (params: { q?: string; currency?: Currency; limit?: number; cursor?: string } = {}, locale?: Locale) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const suffix = query.size ? `?${query.toString()}` : "";
    return apiRequestPage<Job[]>(`/jobs${suffix}`, locale);
  },
  get: (jobId: string, locale?: Locale) => apiRequest<Job>(`/jobs/${encodeURIComponent(jobId)}`, { locale }),
  create: (token: string, input: {
    title: string;
    description: string;
    budgetType: Job["budgetType"];
    budgetMin?: string;
    budgetMax?: string;
    currency: Currency;
  }, locale?: Locale) => apiRequest<Job>("/jobs", { method: "POST", token, body: input, locale }),
  close: (token: string, jobId: string, locale?: Locale) =>
    apiRequest<Job>(`/jobs/${encodeURIComponent(jobId)}/close`, { method: "PATCH", token, locale }),
};

export async function apiRequestPage<T>(path: string, locale?: Locale): Promise<{ data: T; nextCursor?: string | null }> {
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": locale ?? "en" };
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { headers });
  } catch {
    throw new ApiError("Could not reach Archer API. Check the API URL and server.", 0, "NETWORK_ERROR");
  }
  const payload = (await response.json().catch(() => null)) as (ApiEnvelope<T> & ApiFailure) | null;
  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? `Request failed (${response.status})`, response.status, payload?.error?.code);
  }
  if (!payload || !("data" in payload)) throw new ApiError("The API returned an unexpected response.", response.status, "INVALID_RESPONSE");
  return { data: payload.data, ...(payload.nextCursor !== undefined ? { nextCursor: payload.nextCursor } : {}) };
}

export const profileApi = {
  me: (token: string, locale?: Locale) => apiRequest<Profile>("/profiles/me", { token, locale }),
  update: (token: string, input: Pick<Profile, "displayName"> & Partial<Pick<Profile, "headline" | "bio" | "location" | "skills">>, locale?: Locale) =>
    apiRequest<Profile>("/profiles/me", { method: "PUT", token, body: input, locale }),
  get: (userId: string, locale?: Locale) => apiRequest<Profile>(`/profiles/${encodeURIComponent(userId)}`, { locale }),
};

export const proposalsApi = {
  mine: (token: string, locale?: Locale) => apiRequest<Proposal[]>("/proposals/me", { token, locale }),
  forJob: (token: string, jobId: string, locale?: Locale) =>
    apiRequest<Proposal[]>(`/proposals/jobs/${encodeURIComponent(jobId)}`, { token, locale }),
  submit: (token: string, jobId: string, input: { coverLetter: string; bidAmount?: string }, locale?: Locale) =>
    apiRequest<{ proposal: Proposal; conversation: Conversation }>(`/proposals/jobs/${encodeURIComponent(jobId)}`, { method: "POST", token, body: input, locale }),
  withdraw: (token: string, proposalId: string, locale?: Locale) =>
    apiRequest<Proposal>(`/proposals/${encodeURIComponent(proposalId)}/withdraw`, { method: "PATCH", token, locale }),
  reject: (token: string, proposalId: string, locale?: Locale) =>
    apiRequest<Proposal>(`/proposals/${encodeURIComponent(proposalId)}/reject`, { method: "PATCH", token, locale }),
};

export const conversationsApi = {
  list: (token: string, locale?: Locale) => apiRequest<Conversation[]>("/conversations", { token, locale }),
  messages: (token: string, conversationId: string, locale?: Locale) =>
    apiRequest<Message[]>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { token, locale }),
  send: (token: string, conversationId: string, body: string, locale?: Locale) =>
    apiRequest<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", token, body: { body }, locale }),
};
