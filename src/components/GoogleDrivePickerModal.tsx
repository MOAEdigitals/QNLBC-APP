import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Folder,
  FileAudio,
  FileText,
  Search,
  RefreshCw,
  X,
  Check,
  ExternalLink,
  Plus,
} from 'lucide-react';
import {
  listDriveFiles,
  downloadDriveFileBlob,
  signInWithGoogleDrive,
  subscribeToGoogleAuth,
  DriveFile,
} from '../services/googleDrive';
import { User } from 'firebase/auth';

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  allowedTypes?: 'audio' | 'pdf' | 'all';
  onSelectFile: (file: DriveFile, blob?: Blob) => void;
}

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  title = 'Select File from Google Drive',
  allowedTypes = 'all',
  onSelectFile,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToGoogleAuth((currentUser, currentToken) => {
      setUser(currentUser);
      setToken(currentToken);
      if (currentToken && isOpen) {
        fetchFiles();
      }
    });
    return () => unsub();
  }, [isOpen, allowedTypes]);

  const fetchFiles = async (customQuery = searchQuery) => {
    setIsLoading(true);
    try {
      let mimeFilter: string[] | undefined;
      if (allowedTypes === 'audio') {
        mimeFilter = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg'];
      } else if (allowedTypes === 'pdf') {
        mimeFilter = ['application/pdf'];
      }

      const res = await listDriveFiles({
        query: customQuery,
        mimeTypeFilter: mimeFilter,
        pageSize: 50,
      });
      setFiles(res.files);
    } catch (err: any) {
      console.error('Error loading files in picker:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await signInWithGoogleDrive();
      setUser(res.user);
      setToken(res.accessToken);
      fetchFiles();
    } catch (err: any) {
      alert(err.message || 'Could not connect Google Drive');
    }
  };

  const handleChooseFile = async (file: DriveFile) => {
    setIsDownloading(true);
    setDownloadingFileId(file.id);
    try {
      let blob: Blob | undefined;
      try {
        blob = await downloadDriveFileBlob(file.id);
      } catch (err) {
        console.warn('Could not download blob, passing metadata only:', err);
      }
      onSelectFile(file, blob);
      onClose();
    } catch (err: any) {
      alert(`Error fetching file from Drive: ${err.message}`);
    } finally {
      setIsDownloading(false);
      setDownloadingFileId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-blue-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">{title}</h3>
              <p className="text-[11px] text-blue-100">
                {allowedTypes === 'audio'
                  ? 'Showing audio recordings & rehearsal tracks'
                  : allowedTypes === 'pdf'
                  ? 'Showing PDF chord charts & sheet music'
                  : 'Select any worship document or file'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {!user || !token ? (
          <div className="p-8 text-center bg-slate-50 flex-1 flex flex-col items-center justify-center">
            <HardDrive className="w-12 h-12 text-blue-500 mb-3" />
            <h4 className="font-bold text-slate-800 text-sm">Google Drive is not connected</h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
              Sign in with your Google account to access and choose files directly from your Drive.
            </p>
            <button
              onClick={handleConnect}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition-all"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-3">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search files in Google Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => fetchFiles()}
                disabled={isLoading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg text-xs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading your Google Drive files...
                </div>
              ) : files.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No matching files found</p>
                </div>
              ) : (
                files.map((f) => {
                  const isAudio = f.mimeType.includes('audio');
                  const isPdf = f.mimeType.includes('pdf');
                  const isThisDownloading = isDownloading && downloadingFileId === f.id;

                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all gap-2"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isAudio
                              ? 'bg-purple-50 text-purple-600'
                              : isPdf
                              ? 'bg-red-50 text-red-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {isAudio ? (
                            <FileAudio className="w-4 h-4" />
                          ) : isPdf ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <Folder className="w-4 h-4" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-slate-800 truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {f.size ? `${(parseInt(f.size, 10) / (1024 * 1024)).toFixed(1)} MB` : 'File'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleChooseFile(f)}
                        disabled={isDownloading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                      >
                        {isThisDownloading ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Select</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:bg-slate-200 px-4 py-1.5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
