import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle } from 'lucide-react';
import { parseWalletFile } from '../utils/fileParser';

export function FileUpload({ onUpload, existingCount = 0 }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) await processFile(file);
    // Reset input
    e.target.value = '';
  };

  const processFile = async (file) => {
    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExtension = validExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      setUploadResult({
        success: false,
        message: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)',
      });
      return;
    }

    setIsProcessing(true);
    setUploadResult(null);

    try {
      const wallets = await parseWalletFile(file);
      onUpload(wallets);
      setUploadResult({
        success: true,
        message: `Successfully imported ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      setUploadResult({
        success: false,
        message: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearResult = () => setUploadResult(null);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center
          transition-all duration-200
          ${isDragging
            ? 'border-accent-primary bg-accent-primary/10'
            : 'border-dark-500 hover:border-accent-primary/50 hover:bg-dark-700/50'
          }
          ${isProcessing ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          {isProcessing ? (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-500 border-t-accent-primary" />
              <p className="text-gray-400">Processing file...</p>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-dark-600">
                {isDragging ? (
                  <FileSpreadsheet className="h-7 w-7 text-accent-primary" />
                ) : (
                  <Upload className="h-7 w-7 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-white font-medium">
                  {isDragging ? 'Drop your file here' : 'Upload wallet list'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  CSV or Excel with Name & Wallet Address columns
                </p>
              </div>
              {existingCount > 0 && (
                <p className="text-xs text-gray-500">
                  {existingCount} wallet{existingCount !== 1 ? 's' : ''} currently tracked
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Result message */}
      {uploadResult && (
        <div
          className={`
            flex items-center gap-3 rounded-lg p-3 animate-slide-up
            ${uploadResult.success
              ? 'bg-accent-success/10 text-accent-success'
              : 'bg-accent-danger/10 text-accent-danger'
            }
          `}
        >
          {uploadResult.success ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <p className="flex-1 text-sm">{uploadResult.message}</p>
          <button
            onClick={clearResult}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
