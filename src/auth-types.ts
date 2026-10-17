export interface AccountPermissions {
  manageLibraries: boolean;
  scanLibraries: boolean;
  manageMetadata: boolean;
  play: boolean;
  transcode: boolean;
}

export interface Account {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  enabled: boolean;
  allLibraries: boolean;
  libraryIds: number[];
  permissions: AccountPermissions;
  revision: number;
  createdAt: number;
}

export interface AuthStatus {
  setupRequired: boolean;
  localAccess: boolean;
  user: Account | null;
}

export interface CatalogScope { userId: number; libraryIds: number[] | null }
