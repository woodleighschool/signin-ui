export interface ApiUser {
  display_name: string;
  is_admin: boolean;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

export class ApiValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public fieldErrors: Record<string, string>,
    public status: number,
  ) {
    super(message);
    this.name = "ApiValidationError";
  }
}

export interface Checkin {
  id: string;
  locationId: string;
  locationName: string;
  locationIdentifier: string;
  keyId: string | null;
  userId: string;
  userDisplayName: string;
  userUpn: string;
  userDepartment?: string;
  direction: string;
  notes?: string;
  occurredAt: string;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  identifier: string;
  createdAt: string;
  groupIds: string[];
  notesEnabled: boolean;
}

export interface Key {
  id: string;
  description: string;
  keyValue: string; // Masked in list, full on create
  locations: Location[];
  createdAt: string;
}

export interface DirectoryUser {
  id: string;
  upn: string;
  displayName: string;
  department?: string;
  isAdmin: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserDetailResponse {
  user: DirectoryUser;
  locationIds: string[] | null;
  groups: DirectoryGroup[] | null;
  accessibleLocationIds: string[];
}

export interface DirectoryGroup {
  id: string;
  displayName: string;
  description?: string;
}

export interface UpdateUserPayload {
  isAdmin?: boolean;
  locationIds?: string[];
}

export interface AppStatusResponse {
  status: string;
  version: BuildInfo;
}

export interface BuildInfo {
  version: string;
  gitCommit: string;
  buildDate: string;
}

export interface AuthProviders {
  oauth: boolean;
  local: boolean;
}

// Location payloads
export interface LocationPayload {
  name: string;
  groupIds: string[];
  notesEnabled: boolean;
}

export type LocationCreatePayload = LocationPayload;
export type LocationUpdatePayload = LocationPayload;

// Key payloads
export interface KeyPayload {
  description: string;
  locationIds: string[];
  keyValue?: string;
}

export type KeyCreatePayload = KeyPayload;
export type KeyUpdatePayload = KeyPayload;

const API_BASE = "/api/v1";

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>,
    hasMessage = typeof candidate.message === "string",
    hasError = typeof candidate.error === "string",
    hasFieldErrors = candidate.fieldErrors !== undefined;

  return hasMessage || hasError || hasFieldErrors;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();

    try {
      const parsed: unknown = JSON.parse(text);

      if (isApiErrorResponse(parsed)) {
        const errorData = parsed,
          { fieldErrors } = errorData;

        if (fieldErrors) {
          throw new ApiValidationError(
            errorData.message || errorData.error || "Validation failed",
            errorData.code || errorData.error || "VALIDATION_FAILED",
            fieldErrors,
            res.status,
          );
        }

        throw new Error(errorData.message || errorData.error || text || res.statusText);
      }

      throw new Error(text || res.statusText);
    } catch (parseError) {
      if (parseError instanceof ApiValidationError) {
        throw parseError;
      }

      throw new Error(text || res.statusText);
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`,
    res = await fetch(url, { credentials: "include", ...options });
  return handleResponse<T>(res);
}

// Auth

export async function getCurrentUser(): Promise<ApiUser | null> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (res.status === 401) {
    return null;
  }

  return handleResponse<ApiUser>(res);
}

export async function getAuthProviders(): Promise<AuthProviders> {
  const res = await fetch("/api/auth/providers", {
    credentials: "include",
  });

  return handleResponse<AuthProviders>(res);
}

// Locations

export async function listLocations(): Promise<Location[]> {
  return apiRequest<Location[]>("/locations");
}

// Groups
export async function listGroups(): Promise<DirectoryGroup[]> {
  return apiRequest<DirectoryGroup[]>("/groups");
}

export async function createLocation(payload: LocationCreatePayload): Promise<Location> {
  return apiRequest<Location>("/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateLocation(id: string, payload: LocationUpdatePayload): Promise<Location> {
  return apiRequest<Location>(`/locations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteLocation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/locations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok && res.status !== 404) {
    throw new Error("Failed to delete location");
  }
}

// Keys

export async function listKeys(): Promise<Key[]> {
  return apiRequest<Key[]>("/keys");
}

export async function createKey(payload: KeyCreatePayload): Promise<Key> {
  return apiRequest<Key>("/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateKey(id: string, payload: KeyUpdatePayload): Promise<Key> {
  return apiRequest<Key>(`/keys/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteKey(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/keys/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok && res.status !== 404) {
    throw new Error("Failed to delete key");
  }
}

// Users

export async function listUsers(): Promise<DirectoryUser[]> {
  return apiRequest<DirectoryUser[]>("/users");
}

export async function getUserDetails(userId: string): Promise<UserDetailResponse> {
  return apiRequest<UserDetailResponse>(`/users/${userId}`);
}

export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<UserDetailResponse> {
  if (payload.isAdmin === undefined && payload.locationIds === undefined) {
    throw new Error("No user fields provided for update");
  }

  return apiRequest<UserDetailResponse>(`/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Checkins

export async function listCheckins(limit = 50, offset = 0): Promise<Checkin[]> {
  const parameters = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return apiRequest<Checkin[]>(`/checkins?${parameters.toString()}`);
}

// Status

export async function getStatus(): Promise<AppStatusResponse> {
  return apiRequest<AppStatusResponse>("/status");
}

// Portal

export interface PortalConfig {
  location: {
    id: string;
    name: string;
    identifier: string;
    notesEnabled: boolean;
  };
  users: DirectoryUser[];
  backgroundImageUrl?: string;
}

export async function getPortalConfig(locationIdentifier: string, key: string): Promise<PortalConfig> {
  const parameters = new URLSearchParams({ location: locationIdentifier, key }),
    res = await fetch(`/api/portal/config?${parameters.toString()}`);
  return handleResponse<PortalConfig>(res);
}

export async function submitPortalCheckin(locationIdentifier: string, key: string, userId: string, direction: "in" | "out", notes?: string): Promise<void> {
  const res = await fetch("/api/portal/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: locationIdentifier,
      key,
      userId,
      direction,
      notes,
    }),
  });
  return handleResponse<undefined>(res);
}

// Settings

export interface PortalBackgroundSettings {
  hasImage: boolean;
  url?: string;
  contentType?: string;
  updatedAt?: string;
}

export async function getPortalBackground(): Promise<PortalBackgroundSettings> {
  return apiRequest<PortalBackgroundSettings>("/settings/portal-background");
}

export async function uploadPortalBackground(file: File): Promise<PortalBackgroundSettings> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/settings/portal-background`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  return handleResponse<PortalBackgroundSettings>(res);
}

export async function deletePortalBackground(): Promise<void> {
  const res = await fetch(`${API_BASE}/settings/portal-background`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse<undefined>(res);
}
