import React, { useState, useEffect } from 'react';
import {
  Cloud,
  UploadCloud,
  DownloadCloud,
  Folder,
  FileText,
  FileAudio,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Lock,
  ArrowDownToLine,
  FileJson,
  Upload,
  HardDrive,
} from 'lucide-react';
import {
  signInWithGoogleDrive,
  signOutGoogleDrive,
  subscribeToGoogleAuth,
  listDriveFiles,
  listDriveBackups,
  backupAllAppDataToGoogleDrive,
  downloadDriveFileText,
  deleteDriveFile,
  uploadFileToDrive,
  getOrCreateDriveFolder,
  DriveFile,
} from '../services/googleDrive';
import { User } from 'firebase/auth';

interface GoogleDriveSectionProps {
  appData: {
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
  };
  onRestoreData: (restoredData: any) => void;
}

export const GoogleDriveSection: React.FC<GoogleDriveSectionProps> = ({
  appData,
  onRestoreData,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Backup & Files state
  const [activeTab, setActiveTab] = useState<'backups' | 'files' | 'upload'>('backups');
  const [backups, setBackups] = useState<DriveFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);

  // Explorer state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<'all' | 'audio' | 'pdf' | 'json'>('all');

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Restore Confirmation Modal state
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState<DriveFile | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Delete Confirmation Modal state
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToGoogleAuth((currentUser, currentToken) => {
      setUser(currentUser);
      setToken(currentToken);
      if (currentToken) {
        loadBackups();
        loadFiles();
      }
    });
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await signInWithGoogleDrive();
      setUser(result.user);
      setToken(result.accessToken);
      loadBackups();
      loadFiles();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setAuthError(err.message || 'Failed to authenticate with Google Drive');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogleDrive();
      setUser(null);
      setToken(null);
      setBackups([]);
      setDriveFiles([]);
    } catch (err: any) {
      console.error('Sign Out Error:', err);
    }
  };

  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const files = await listDriveBackups();
      setBackups(files);
    } catch (err: any) {
      console.error('Failed to load backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const loadFiles = async (customSearch = searchQuery) => {
    setIsLoadingFiles(true);
    try {
      let mimeFilter: string[] | undefined;
      if (fileFilter === 'audio') {
        mimeFilter = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg'];
      } else if (fileFilter === 'pdf') {
        mimeFilter = ['application/pdf'];
      } else if (fileFilter === 'json') {
        mimeFilter = ['application/json'];
      }

      const { files } = await listDriveFiles({
        query: customSearch,
        mimeTypeFilter: mimeFilter,
        pageSize: 40,
      });
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Failed to list files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccessMsg(null);
    try {
      const { file, folderName } = await backupAllAppDataToGoogleDrive(appData);
      setBackupSuccessMsg(`Backup saved to Google Drive: "${folderName}/${file.name}"`);
      await loadBackups();
      setTimeout(() => setBackupSuccessMsg(null), 6000);
    } catch (err: any) {
      alert(`Backup failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackupToRestore) return;
    setIsRestoring(true);
    try {
      const jsonText = await downloadDriveFileText(selectedBackupToRestore.id);
      const parsed = JSON.parse(jsonText);
      if (!parsed.data) {
        throw new Error('Invalid backup file format. Missing root "data" object.');
      }
      onRestoreData(parsed.data);
      alert('Application database successfully restored from Google Drive backup!');
      setSelectedBackupToRestore(null);
    } catch (err: any) {
      alert(`Failed to restore backup: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      setDriveFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      setBackups((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      setFileToDelete(null);
    } catch (err: any) {
      alert(`Failed to delete file: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadProgress(true);
    setUploadSuccessMsg(null);
    try {
      const folderId = await getOrCreateDriveFolder('NLBC Worship Ministry Files');
      const uploaded = await uploadFileToDrive({
        name: uploadFile.name,
        mimeType: uploadFile.type || 'application/octet-stream',
        content: uploadFile,
        parentFolderId: folderId,
        description: `Uploaded from NLBC Worship Ministry App on ${new Date().toLocaleString()}`,
      });
      setUploadSuccessMsg(`Successfully uploaded "${uploaded.name}" to Google Drive!`);
      setUploadFile(null);
      await loadFiles();
      setTimeout(() => setUploadSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadProgress(false);
    }
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return 'Unknown size';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return 'Unknown';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="google-drive-integration-section" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-white border border-white/20 shadow-inner">
              <HardDrive className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Google Drive Integration</h3>
                <span className="bg-blue-500/40 text-blue-100 text-xs px-2.5 py-0.5 rounded-full border border-blue-300/30 font-medium">
                  Cloud Sync & Storage
                </span>
              </div>
              <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                Backup entire church library, access sheet music, audio tracks, and sync files securely to Google Drive.
              </p>
            </div>
          </div>

          {/* Account Status / Sign In Button */}
          <div>
            {!user || !token ? (
              <button
                id="google-drive-signin-btn"
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="inline-flex items-center justify-center gap-2.5 bg-white text-slate-800 hover:bg-slate-50 font-semibold px-4 py-2.5 rounded-lg shadow-sm border border-slate-200 text-sm transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {isAuthenticating ? 'Connecting...' : 'Connect Google Drive'}
              </button>
            ) : (
              <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur border border-white/20 rounded-lg p-1.5 px-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    className="w-7 h-7 rounded-full border border-white/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-300 text-blue-900 font-bold flex items-center justify-center text-xs">
                    {(user.displayName || user.email || 'G')[0].toUpperCase()}
                  </div>
                )}
                <div className="text-left leading-tight hidden sm:block">
                  <p className="text-xs font-semibold text-white truncate max-w-[140px]">
                    {user.displayName || 'Google Account'}
                  </p>
                  <p className="text-[11px] text-blue-200 truncate max-w-[140px]">
                    {user.email}
                  </p>
                </div>
                <button
                  id="google-drive-signout-btn"
                  onClick={handleSignOut}
                  className="text-xs bg-white/20 hover:bg-white/30 text-white font-medium px-2 py-1 rounded transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {authError && (
          <div className="mt-3 bg-red-500/20 border border-red-300/40 text-red-100 text-xs p-2.5 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!user || !token ? (
        <div className="p-8 text-center bg-slate-50/60">
          <div className="max-w-md mx-auto">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-sm">
              <Cloud className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Connect your Google Drive</h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5">
              Securely create cloud backups of all church songs, setlists, and schedule data, or access and upload worship media directly.
            </p>
            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm text-sm transition-all"
            >
              <Lock className="w-4 h-4" />
              {isAuthenticating ? 'Authorizing...' : 'Authorize Google Drive Access'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Sub Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              id="tab-drive-backups"
              onClick={() => setActiveTab('backups')}
              className={`flex items-center gap-2 py-2.5 px-4 font-semibold text-xs sm:text-sm border-b-2 transition-all ${
                activeTab === 'backups'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <DownloadCloud className="w-4 h-4" />
              Church Backups & Snapshots
              {backups.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {backups.length}
                </span>
              )}
            </button>
            <button
              id="tab-drive-files"
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 py-2.5 px-4 font-semibold text-xs sm:text-sm border-b-2 transition-all ${
                activeTab === 'files'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Folder className="w-4 h-4" />
              Drive File Explorer
            </button>
            <button
              id="tab-drive-upload"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 py-2.5 px-4 font-semibold text-xs sm:text-sm border-b-2 transition-all ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Upload Media to Drive
            </button>
          </div>

          {/* TAB 1: BACKUPS & RESTORE */}
          {activeTab === 'backups' && (
            <div className="space-y-5">
              {/* Backup Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    Cloud Backup to Google Drive
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saves {appData.songs.length} songs, {appData.setlists.length} setlists, {appData.specialNumbers.length} special numbers, and {appData.practiceEntries.length} practice sessions.
                  </p>
                </div>
                <button
                  id="btn-create-drive-backup"
                  onClick={handleCreateBackup}
                  disabled={isBackingUp}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  <UploadCloud className={`w-4 h-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
                  {isBackingUp ? 'Creating Backup...' : 'Create Backup to Drive'}
                </button>
              </div>

              {backupSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{backupSuccessMsg}</span>
                </div>
              )}

              {/* Existing Backups List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Available Backups in Google Drive
                  </h5>
                  <button
                    onClick={loadBackups}
                    disabled={isLoadingBackups}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {isLoadingBackups ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading backups from Google Drive...
                  </div>
                ) : backups.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FileJson className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No cloud backups found yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click "Create Backup to Drive" to make your first snapshot.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {backups.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all gap-3"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <FileJson className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-slate-800">{b.name}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                              <span>Created: {formatDate(b.createdTime || b.modifiedTime)}</span>
                              <span>•</span>
                              <span>Size: {formatFileSize(b.size)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {b.webViewLink && (
                            <a
                              href={b.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors text-xs flex items-center gap-1 font-medium"
                              title="View in Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Drive</span>
                            </a>
                          )}
                          <button
                            id={`restore-backup-${b.id}`}
                            onClick={() => setSelectedBackupToRestore(b)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            Restore
                          </button>
                          <button
                            id={`delete-backup-${b.id}`}
                            onClick={() => setFileToDelete(b)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Backup from Drive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DRIVE FILE EXPLORER */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="input-drive-search"
                    type="text"
                    placeholder="Search files in Google Drive..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadFiles()}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    id="select-drive-filter"
                    value={fileFilter}
                    onChange={(e) => {
                      setFileFilter(e.target.value as any);
                    }}
                    className="py-2 px-3 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                  >
                    <option value="all">All Files</option>
                    <option value="audio">Audio Tracks (MP3/WAV)</option>
                    <option value="pdf">Sheet Music & Chords (PDF)</option>
                    <option value="json">Backups & Data (JSON)</option>
                  </select>
                  <button
                    onClick={() => loadFiles()}
                    disabled={isLoadingFiles}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg text-xs transition-colors"
                    title="Refresh List"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Files Grid / List */}
              {isLoadingFiles ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Searching Google Drive files...
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No files found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Upload audio files or sheets using the "Upload Media" tab.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {driveFiles.map((file) => {
                    const isAudio = file.mimeType.includes('audio');
                    const isPdf = file.mimeType.includes('pdf');
                    const isFolder = file.mimeType.includes('folder');

                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isAudio
                                ? 'bg-purple-50 text-purple-600'
                                : isPdf
                                ? 'bg-red-50 text-red-600'
                                : isFolder
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {isAudio ? (
                              <FileAudio className="w-5 h-5" />
                            ) : isPdf ? (
                              <FileText className="w-5 h-5" />
                            ) : isFolder ? (
                              <Folder className="w-5 h-5" />
                            ) : (
                              <FileJson className="w-5 h-5" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatFileSize(file.size)} • {formatDate(file.modifiedTime)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                              title="Open in Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => setFileToDelete(file)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UPLOAD TO DRIVE */}
          {activeTab === 'upload' && (
            <div className="max-w-xl mx-auto space-y-4">
              <form onSubmit={handleUploadFile} className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">Upload Worship Media to Drive</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload chord charts (PDF), vocal rehearsal audios (MP3/WAV), or setlist notes directly to your Google Drive worship folder.
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-100/60 transition-colors">
                  <input
                    id="file-upload-input"
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                  >
                    <Plus className="w-6 h-6 text-slate-400" />
                    <span className="text-xs font-semibold text-blue-600 hover:underline">
                      {uploadFile ? uploadFile.name : 'Select file from your device'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {uploadFile ? formatFileSize(String(uploadFile.size)) : 'Supports audio, PDF, images, or JSON documents'}
                    </span>
                  </label>
                </div>

                {uploadSuccessMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{uploadSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!uploadFile || uploadProgress}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  {uploadProgress ? 'Uploading to Drive...' : 'Upload to Google Drive'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL (Mandatory User Confirmation for Destructive/Mutating Operations) */}
      {selectedBackupToRestore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Restore Database from Backup?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                You are about to restore the application state from:
              </p>
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 break-all">
                {selectedBackupToRestore.name}
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded mt-2 border border-amber-200">
                ⚠️ This will merge and replace current songs, setlists, and schedule entries with the contents of this backup file.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBackupToRestore(null)}
                disabled={isRestoring}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-restore"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                {isRestoring ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (Mandatory User Confirmation for Destructive Operations) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Delete File from Google Drive?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Are you sure you want to permanently delete this file from your Google Drive?
              </p>
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 break-all">
                {fileToDelete.name}
              </div>
              <p className="text-[11px] text-red-600 mt-1">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-drive-file"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
