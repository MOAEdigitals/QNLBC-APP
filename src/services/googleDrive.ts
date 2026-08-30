import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '../firebase';

// Google Drive OAuth Scopes configured for the application
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
];

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  owners?: { displayName: string; emailAddress: string; photoLink?: string }[];
}

let isSigningIn = false;
// In-memory access token storage (never stored in localStorage for security)
let cachedAccessToken: string | null = null;
let currentGoogleUser: User | null = null;
const authListeners = new Set<(user: User | null, token: string | null) => void>();

export function getCachedToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentGoogleUser(): User | null {
  return currentGoogleUser;
}

export function subscribeToGoogleAuth(
  callback: (user: User | null, token: string | null) => void
): () => void {
  authListeners.add(callback);
  callback(currentGoogleUser, cachedAccessToken);
  return () => {
    authListeners.delete(callback);
  };
}

function notifyAuthListeners() {
  authListeners.forEach((cb) => cb(currentGoogleUser, cachedAccessToken));
}

// Initialize Auth listener on startup
export function initGoogleDriveAuth(
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    currentGoogleUser = user;
    if (user && cachedAccessToken) {
      notifyAuthListeners();
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        notifyAuthListeners();
        if (onFailure) onFailure();
      }
    }
  });
}

// Sign in with Google with Drive scopes
export async function signInWithGoogleDrive(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    GOOGLE_DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));

    // Force prompt to ensure refresh of permissions
    provider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline',
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Google Sign-In completed, but no access token was returned.');
    }

    cachedAccessToken = credential.accessToken;
    currentGoogleUser = result.user;
    notifyAuthListeners();

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

// Sign out from Google
export async function signOutGoogleDrive(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
  currentGoogleUser = null;
  notifyAuthListeners();
}

// Helper: Ensure valid token before API calls
async function requireToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  // Try re-prompting sign-in
  const { accessToken } = await signInWithGoogleDrive();
  return accessToken;
}

// 1. List Files in Google Drive
export async function listDriveFiles(options?: {
  query?: string;
  folderId?: string;
  mimeTypeFilter?: string[];
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
}): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const token = await requireToken();
  const qParts: string[] = ['trashed = false'];

  if (options?.folderId) {
    qParts.push(`'${options.folderId}' in parents`);
  }

  if (options?.mimeTypeFilter && options.mimeTypeFilter.length > 0) {
    const mimeQuery = options.mimeTypeFilter
      .map((mime) => `mimeType = '${mime}'`)
      .join(' or ');
    qParts.push(`(${mimeQuery})`);
  }

  if (options?.query?.trim()) {
    const cleanQuery = options.query.trim().replace(/'/g, "\\'");
    qParts.push(`name contains '${cleanQuery}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(' and '),
    fields:
      'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, iconLink, thumbnailLink, owners)',
    pageSize: String(options?.pageSize || 30),
    orderBy: options?.orderBy || 'modifiedTime desc',
  });

  if (options?.pageToken) {
    params.set('pageToken', options.pageToken);
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Failed to fetch Google Drive files (${response.status})`
    );
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

// 2. Create or Find Folder in Google Drive (e.g., 'NLBC Worship App Backups')
export async function getOrCreateDriveFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const token = await requireToken();
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // Create folder
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create Google Drive folder');
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

// 3. Upload File to Google Drive (Multipart upload)
export async function uploadFileToDrive(options: {
  name: string;
  mimeType: string;
  content: Blob | string;
  parentFolderId?: string;
  description?: string;
}): Promise<DriveFile> {
  const token = await requireToken();

  const metadata: any = {
    name: options.name,
    mimeType: options.mimeType,
  };
  if (options.parentFolderId) {
    metadata.parents = [options.parentFolderId];
  }
  if (options.description) {
    metadata.description = options.description;
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const blobContent =
    typeof options.content === 'string'
      ? new Blob([options.content], { type: options.mimeType })
      : options.content;

  const metadataBlob = new Blob(
    [
      delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${options.mimeType}\r\n\r\n`,
    ],
    { type: 'text/plain' }
  );

  const multipartBlob = new Blob([metadataBlob, blobContent, new Blob([closeDelimiter])], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: multipartBlob,
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to upload file to Google Drive');
  }

  return await response.json();
}

// 4. Download File Content from Google Drive
export async function downloadDriveFileText(fileId: string): Promise<string> {
  const token = await requireToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download file from Google Drive (${response.status})`);
  }

  return await response.text();
}

export async function downloadDriveFileBlob(fileId: string): Promise<Blob> {
  const token = await requireToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download file blob from Google Drive (${response.status})`);
  }

  return await response.blob();
}

// 5. Delete File from Google Drive (Requires explicit confirmation handler in UI)
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await requireToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok && response.status !== 404) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to delete file from Google Drive');
  }
}

// 6. Create Backup of Complete Church App Database to Google Drive
export async function backupAllAppDataToGoogleDrive(fullAppData: {
  songs: any[];
  setlists: any[];
  specialNumbers: any[];
  practiceEntries: any[];
  choirEntries: any[];
  birthdays: any[];
  anniversaries: any[];
  visitors: any[];
  specialRecognitions: any[];
  savedNames: string[];
  welcomeSongs: string[];
}): Promise<{ file: DriveFile; folderName: string }> {
  const folderName = 'NLBC Worship App Backups';
  const folderId = await getOrCreateDriveFolder(folderName);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `nlbc-worship-backup-${timestamp}.json`;

  const payload = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    appName: 'New Life Baptist Church Worship Ministry',
    data: fullAppData,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const file = await uploadFileToDrive({
    name: fileName,
    mimeType: 'application/json',
    content: jsonString,
    parentFolderId: folderId,
    description: `Complete backup of NLBC Worship App database exported on ${new Date().toLocaleString()}`,
  });

  return { file, folderName };
}

// 7. List Available App Backups in Google Drive
export async function listDriveBackups(): Promise<DriveFile[]> {
  try {
    const folderName = 'NLBC Worship App Backups';
    const folderId = await getOrCreateDriveFolder(folderName);
    const { files } = await listDriveFiles({
      folderId,
      mimeTypeFilter: ['application/json'],
      orderBy: 'createdTime desc',
    });
    return files;
  } catch (err) {
    console.error('Error listing drive backups:', err);
    return [];
  }
}
