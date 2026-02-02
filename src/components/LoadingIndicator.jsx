import React from 'react';
import {
  Loader2,
  Database,
  Wallet,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

// Stage icons and colors
const stageConfig = {
  token_info: {
    icon: Database,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  balances: {
    icon: Wallet,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  transactions: {
    icon: ArrowRightLeft,
    color: 'text-accent-primary',
    bgColor: 'bg-accent-primary/20',
  },
  error: {
    icon: AlertCircle,
    color: 'text-accent-danger',
    bgColor: 'bg-accent-danger/20',
  },
};

export function LoadingIndicator({ loadingStatus, isLoading, isRefreshing, onCancel }) {
  // Show minimal indicator for background refresh (stale-while-revalidate)
  if (!isLoading && isRefreshing && loadingStatus?.stage) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-dark-800/90 backdrop-blur-sm border border-dark-600 rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-accent-primary animate-spin" />
          <span className="text-sm text-gray-300">
            {loadingStatus.detail || 'Checking for updates...'}
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="ml-1 p-1 hover:bg-dark-600 rounded-full transition-colors"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Don't render if not loading or no status
  if (!isLoading || !loadingStatus?.stage) return null;

  const config = stageConfig[loadingStatus.stage] || stageConfig.token_info;
  const StageIcon = config.icon;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-xl overflow-hidden min-w-[280px]">
        {/* Header with animated icon and cancel button */}
        <div className="flex items-center gap-3 p-3 border-b border-dark-600">
          <div className={`
            flex items-center justify-center w-10 h-10 rounded-lg
            ${config.bgColor}
          `}>
            {loadingStatus.stage === 'error' ? (
              <StageIcon className={`h-5 w-5 ${config.color}`} />
            ) : (
              <Loader2 className={`h-5 w-5 ${config.color} animate-spin`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {loadingStatus.message}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {loadingStatus.detail}
            </p>
          </div>
          {/* Cancel button */}
          {onCancel && loadingStatus.stage !== 'error' && (
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-dark-600 rounded-lg transition-colors group"
              title="Cancel fetch"
            >
              <X className="h-4 w-4 text-gray-500 group-hover:text-white" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-3 py-2 bg-dark-900/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-mono text-gray-400">
              {loadingStatus.progress}%
            </span>
          </div>
          <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                loadingStatus.stage === 'error'
                  ? 'bg-accent-danger'
                  : 'bg-gradient-to-r from-accent-primary to-purple-500'
              }`}
              style={{ width: `${loadingStatus.progress}%` }}
            />
          </div>
        </div>

        {/* Stage indicators */}
        <div className="flex items-center justify-between px-3 py-2 bg-dark-900/30">
          <StageStep
            label="Token"
            isActive={loadingStatus.stage === 'token_info'}
            isComplete={['balances', 'transactions'].includes(loadingStatus.stage)}
          />
          <div className="flex-1 h-px bg-dark-600 mx-2" />
          <StageStep
            label="Balances"
            isActive={loadingStatus.stage === 'balances'}
            isComplete={loadingStatus.stage === 'transactions'}
          />
          <div className="flex-1 h-px bg-dark-600 mx-2" />
          <StageStep
            label="Activity"
            isActive={loadingStatus.stage === 'transactions'}
            isComplete={loadingStatus.progress === 100}
          />
        </div>
      </div>
    </div>
  );
}

// Individual stage step indicator
function StageStep({ label, isActive, isComplete }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`
        w-5 h-5 rounded-full flex items-center justify-center text-xs
        transition-all duration-200
        ${isComplete
          ? 'bg-accent-success text-white'
          : isActive
            ? 'bg-accent-primary text-white'
            : 'bg-dark-600 text-gray-500'
        }
      `}>
        {isComplete ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : isActive ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
        )}
      </div>
      <span className={`
        text-[10px] mt-1 font-medium
        ${isComplete
          ? 'text-accent-success'
          : isActive
            ? 'text-accent-primary'
            : 'text-gray-600'
        }
      `}>
        {label}
      </span>
    </div>
  );
}
