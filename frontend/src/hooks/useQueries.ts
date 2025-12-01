import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import {
  type ApiUser,
  type AppStatusResponse,
  type Checkin,
  type DirectoryGroup,
  type DirectoryUser,
  type Key,
  type KeyCreatePayload,
  type KeyUpdatePayload,
  type Location,
  type LocationCreatePayload,
  type LocationUpdatePayload,
  type PortalConfig,
  type PortalBackgroundSettings,
  type UserDetailResponse,
  type UpdateUserPayload,
  createKey,
  createLocation,
  deleteKey,
  deleteLocation,
  deletePortalBackground,
  getCurrentUser,
  getPortalBackground,
  getPortalConfig,
  getStatus,
  getUserDetails,
  listCheckins,
  listGroups,
  listKeys,
  listLocations,
  listUsers,
  submitPortalCheckin,
  updateKey,
  updateLocation,
  updateUser,
  uploadPortalBackground,
} from "../api";

type QueryResult<T> = UseQueryResult<T, Error>;
type MutationResult<TData, TVariables> = UseMutationResult<TData, Error, TVariables>;

// Query Keys
export const queryKeys = {
  users: ["users"] as const,
  user: (id: string) => ["user", id] as const,
  locations: ["locations"] as const,
  location: (id: string) => ["location", id] as const,
  keys: ["keys"] as const,
  key: (id: string) => ["key", id] as const,
  currentUser: ["currentUser"] as const,
  groups: ["groups"] as const,
  checkins: (parameters?: { limit?: number; offset?: number }) => ["checkins", parameters?.limit ?? 50, parameters?.offset ?? 0] as const,
  status: ["status"] as const,
  portalBackground: ["portalBackground"] as const,
} as const;

// Current User Hook
export function useCurrentUser(options?: { enabled?: boolean }): QueryResult<ApiUser | null> {
  return useQuery<ApiUser | null>({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
    ...options,
  });
}

export function useStatus(options?: { enabled?: boolean }): QueryResult<AppStatusResponse> {
  return useQuery<AppStatusResponse>({
    queryKey: queryKeys.status,
    queryFn: () => getStatus(),
    staleTime: 60 * 1000,
    ...options,
  });
}

// Locations Hooks
export function useLocations(): QueryResult<Location[]> {
  return useQuery<Location[]>({
    queryKey: queryKeys.locations,
    queryFn: () => listLocations(),
    placeholderData: keepPreviousData,
  });
}

export function useGroups(): QueryResult<DirectoryGroup[]> {
  return useQuery<DirectoryGroup[]>({
    queryKey: queryKeys.groups,
    queryFn: () => listGroups(),
    placeholderData: keepPreviousData,
  });
}

export function useCreateLocation(): MutationResult<Location, LocationCreatePayload> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLocation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.locations });
    },
  });
}

export function useUpdateLocation(): MutationResult<Location, { id: string; payload: LocationUpdatePayload }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LocationUpdatePayload }) => updateLocation(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.locations });
    },
  });
}

export function useDeleteLocation(): MutationResult<void, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.locations });
    },
  });
}

// Keys Hooks
export function useKeys(): QueryResult<Key[]> {
  return useQuery<Key[]>({
    queryKey: queryKeys.keys,
    queryFn: () => listKeys(),
    placeholderData: keepPreviousData,
  });
}

export function useCreateKey(): MutationResult<Key, KeyCreatePayload> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.keys });
    },
  });
}

export function useUpdateKey(): MutationResult<Key, { id: string; payload: KeyUpdatePayload }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: KeyUpdatePayload }) => updateKey(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.keys });
    },
  });
}

export function useDeleteKey(): MutationResult<void, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.keys });
    },
  });
}

// Users Hooks
export function useUsers(): QueryResult<DirectoryUser[]> {
  return useQuery<DirectoryUser[]>({
    queryKey: queryKeys.users,
    queryFn: () => listUsers(),
    placeholderData: keepPreviousData,
  });
}

export function useUserDetails(userId: string): QueryResult<UserDetailResponse> {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => getUserDetails(userId),
    enabled: Boolean(userId),
  });
}

export function useUpdateUser(): MutationResult<UserDetailResponse, { userId: string; payload: UpdateUserPayload }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) => updateUser(userId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

// Checkins Hooks
export function useCheckins(limit = 50, offset = 0): QueryResult<Checkin[]> {
  return useQuery<Checkin[]>({
    queryKey: queryKeys.checkins({ limit, offset }),
    queryFn: () => listCheckins(limit, offset),
    placeholderData: keepPreviousData,
  });
}

// Portal Hooks
export function usePortalConfig(locationIdentifier: string, key: string): QueryResult<PortalConfig> {
  return useQuery({
    queryKey: ["portalConfig", locationIdentifier, key],
    queryFn: () => getPortalConfig(locationIdentifier, key),
    enabled: Boolean(locationIdentifier) && Boolean(key),
    retry: false,
  });
}

export function usePortalCheckin(): MutationResult<
  void,
  {
    locationIdentifier: string;
    key: string;
    userId: string;
    direction: "in" | "out";
    notes?: string;
  }
> {
  return useMutation({
    mutationFn: ({
      locationIdentifier,
      key,
      userId,
      direction,
      notes,
    }: {
      locationIdentifier: string;
      key: string;
      userId: string;
      direction: "in" | "out";
      notes?: string;
    }) => submitPortalCheckin(locationIdentifier, key, userId, direction, notes),
  });
}

// Settings
export function usePortalBackground(): QueryResult<PortalBackgroundSettings> {
  return useQuery<PortalBackgroundSettings>({
    queryKey: queryKeys.portalBackground,
    queryFn: () => getPortalBackground(),
  });
}

export function useUploadPortalBackground(): MutationResult<PortalBackgroundSettings, File> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadPortalBackground,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portalBackground });
    },
  });
}

export function useDeletePortalBackground(): MutationResult<void, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePortalBackground,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portalBackground });
    },
  });
}
