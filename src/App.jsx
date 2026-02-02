import { useState } from 'react';
import {
  RefreshCw,
  Settings,
  Trash2,
  Activity,
  Clock,
  Upload,
  FolderOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useWalletTracker } from './hooks/useWalletTracker';
import { FileUpload } from './components/FileUpload';
import { TokenPanel } from './components/TokenPanel';
import { SavedProjects } from './components/SavedProjects';
import { HoldingsTable } from './components/HoldingsTable';
import { TransactionFeed } from './components/TransactionFeed';
import { StatsCard } from './components/StatsCard';
import { SettingsPanel } from './components/SettingsPanel';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ToastProvider, useToast } from './components/Toast';

function AppContent() {
  const [showSettings, setShowSettings] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(true);
  const toast = useToast();

  const {
    // State
    wallets,
    tokenMint,
    walletData,
    transactions,
    tokenPrice,
    tokenInfo,
    tokenMetadata,
    previousBalances,
    initialBalances,
    totalHoldings,
    totalValue,
    settings,

    // Project state
    projects,
    activeProjectId,

    // UI state
    isLoading,
    isRefreshing,
    loadingStatus,
    error,
    lastUpdated,

    // Wallet actions
    addWallets,
    replaceWallets,
    removeWallet,

    // Token actions
    updateTokenMint,

    // Project actions
    saveCurrentProject,
    loadProject,
    deleteProject,

    // Settings & misc
    updateSettings,
    manualRefresh,
    cancelFetch,
    clearAll,
    deepFetchWalletHistory,
  } = useWalletTracker();

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    const date = new Date(lastUpdated);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    // Show relative time for recent updates
    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;

    // Show time for older updates
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleImport = (newWallets, replace = false) => {
    if (replace) {
      replaceWallets(newWallets);
    } else {
      addWallets(newWallets);
    }
    setShowImportModal(false);
    toast.success('Wallets Imported', `${newWallets.length} wallets loaded successfully`);
  };

  // Handle save project with toast feedback
  const handleSaveProject = () => {
    const project = saveCurrentProject();
    if (project) {
      toast.success('Project Saved', `${project.tokenSymbol} saved with ${project.wallets?.length || 0} wallets`);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Loading Progress Indicator */}
      <LoadingIndicator
        loadingStatus={loadingStatus}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onCancel={cancelFetch}
      />

      {/* Header */}
      <header className="border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Cabal Play Wallet Tracker</h1>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Powered by</span>
                  <a
                    href="https://helius.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    Helius
                  </a>
                </div>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center gap-3">
              {/* Live indicator */}
              {settings.refreshInterval > 0 && tokenMint && wallets.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
                  <div className={`h-2 w-2 rounded-full ${isRefreshing ? 'bg-accent-warning animate-pulse' : 'bg-accent-success animate-pulse-glow'}`} />
                  <span>Live</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-500">{settings.refreshInterval}s</span>
                </div>
              )}

              {/* Last updated with refresh indicator */}
              {(lastUpdated || isRefreshing) && (
                <div className="hidden md:flex items-center gap-1.5 text-sm">
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 text-accent-warning animate-spin" />
                      <span className="text-accent-warning">Updating...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-500">{formatLastUpdated()}</span>
                    </>
                  )}
                </div>
              )}

              {/* Import wallets button */}
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-700 border border-dark-500 hover:border-accent-primary hover:bg-dark-600 transition-all text-sm text-gray-300"
                title="Import wallets"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </button>

              {/* Refresh button */}
              <button
                onClick={manualRefresh}
                disabled={isLoading || !tokenMint}
                className={`
                  p-2.5 rounded-xl border transition-all
                  ${isLoading
                    ? 'bg-dark-700 border-dark-500 cursor-not-allowed'
                    : 'bg-dark-700 border-dark-500 hover:border-accent-primary hover:bg-dark-600'
                  }
                `}
                title="Refresh data"
              >
                <RefreshCw className={`h-5 w-5 text-gray-400 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Settings button */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-xl bg-dark-700 border border-dark-500 hover:border-accent-primary hover:bg-dark-600 transition-all"
                title="Settings"
              >
                <Settings className="h-5 w-5 text-gray-400" />
              </button>

              {/* Clear all button */}
              {(wallets.length > 0 || tokenMint) && (
                <button
                  onClick={clearAll}
                  className="p-2.5 rounded-xl bg-dark-700 border border-dark-500 hover:border-accent-danger hover:bg-accent-danger/10 transition-all"
                  title="Clear all data"
                >
                  <Trash2 className="h-5 w-5 text-gray-400 hover:text-accent-danger" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Token & Projects Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Token Panel - Takes 2 columns */}
            <div className="lg:col-span-2">
              <TokenPanel
                tokenMint={tokenMint}
                tokenInfo={tokenInfo}
                onTokenChange={updateTokenMint}
                onSaveProject={handleSaveProject}
                isLoading={isLoading}
                hasWallets={wallets.length > 0}
              />

              {/* Wallet count indicator */}
              {wallets.length > 0 && (
                <div className="mt-4 flex items-center justify-between px-4 py-3 bg-dark-800/50 rounded-xl border border-dark-600">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <FolderOpen className="h-4 w-4" />
                    <span><strong className="text-white">{wallets.length}</strong> wallets loaded</span>
                  </div>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
                  >
                    Replace wallets
                  </button>
                </div>
              )}
            </div>

            {/* Saved Projects Sidebar - Takes 1 column */}
            <div className="lg:col-span-1">
              <SavedProjects
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={loadProject}
                onDeleteProject={deleteProject}
                onSaveCurrentProject={saveCurrentProject}
              />
            </div>
          </section>

          {/* Error Display */}
          {error && (
            <div className="bg-accent-danger/10 border border-accent-danger/30 rounded-xl p-4 text-accent-danger animate-slide-up">
              <p className="font-medium">Error fetching data</p>
              <p className="text-sm mt-1 opacity-80">{error}</p>
            </div>
          )}

          {/* Stats Section - Only show when we have data */}
          {tokenMint && walletData.length > 0 && (
            <StatsCard
              walletData={walletData}
              totalHoldings={totalHoldings}
              totalValue={totalValue}
              tokenPrice={tokenPrice}
              lastUpdated={lastUpdated}
            />
          )}

          {/* Activity Feed - Collapsible Section */}
          {tokenMint && transactions.length > 0 && (
            <section className="rounded-xl bg-dark-800 border border-dark-600 overflow-hidden">
              {/* Collapsible Header */}
              <button
                onClick={() => setShowActivityFeed(!showActivityFeed)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-primary/10">
                    <Activity className="h-5 w-5 text-accent-primary" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-white">Activity Feed</h2>
                    <p className="text-xs text-gray-500">
                      {transactions.length} token transactions across all wallets
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    {showActivityFeed ? 'Hide' : 'Show'}
                  </span>
                  {showActivityFeed ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Content */}
              {showActivityFeed && (
                <div className="border-t border-dark-600 p-4">
                  <TransactionFeed
                    transactions={transactions}
                    isLoading={isLoading || isRefreshing}
                  />
                </div>
              )}
            </section>
          )}

          {/* Wallet Holdings Table */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Wallet Holdings</h2>
            <HoldingsTable
              walletData={walletData}
              wallets={wallets}
              tokenPrice={tokenPrice}
              tokenMetadata={tokenMetadata}
              previousBalances={previousBalances}
              initialBalances={initialBalances}
              transactions={transactions}
              onRemoveWallet={removeWallet}
              onDeepFetchWallet={deepFetchWalletHistory}
              isLoading={isLoading}
            />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-600 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>Cabal Play Wallet Tracker • By Wisemen Alpha</p>
            <div className="flex items-center gap-4">
              <a
                href="https://solscan.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent-primary transition-colors"
              >
                Solscan
              </a>
              <span className="text-gray-700">•</span>
              <a
                href="https://dexscreener.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent-primary transition-colors"
              >
                DexScreener
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl border border-dark-600 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-accent-primary" />
                <h2 className="text-lg font-semibold text-white">Import Wallets</h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-gray-400"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <FileUpload
                onUpload={(newWallets) => handleImport(newWallets, wallets.length > 0)}
                existingCount={wallets.length}
              />
              {wallets.length > 0 && (
                <p className="text-xs text-gray-500 mt-4 text-center">
                  This will replace your current {wallets.length} wallets
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap app with providers
function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
