import { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Trash2,
  Clock,
  Coins,
  ChevronRight,
  ChevronDown,
  Wallet,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { formatMarketCap, formatRelativeTime } from '../utils/projectStorage';

// Animated height component for smooth expand/collapse
function AnimatedCollapse({ isOpen, children }) {
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen, children]);

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ height: isOpen ? height : 0, opacity: isOpen ? 1 : 0 }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

// Delete confirmation modal
function DeleteConfirmModal({ project, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-dark-800 rounded-2xl border border-dark-600 w-full max-w-sm animate-scale-in shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent-danger/20 mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-accent-danger" />
          </div>
          <h3 className="text-lg font-semibold text-white text-center mb-2">
            Delete Project?
          </h3>
          <p className="text-sm text-gray-400 text-center mb-1">
            Are you sure you want to delete
          </p>
          <p className="text-sm text-white text-center font-medium mb-4">
            {project.tokenSymbol} ({project.wallets?.length || 0} wallets)
          </p>
          <p className="text-xs text-gray-500 text-center mb-6">
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl bg-dark-600 hover:bg-dark-500 text-gray-300 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-accent-danger hover:bg-accent-danger/80 text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SavedProjects({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onSaveCurrentProject,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loadingProjectId, setLoadingProjectId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Auto-expand active project
  useEffect(() => {
    if (activeProjectId) {
      setExpandedId(activeProjectId);
    }
  }, [activeProjectId]);

  // Toggle wallet list expansion with smooth animation
  const toggleExpand = (e, projectId) => {
    e.stopPropagation();
    setExpandedId(expandedId === projectId ? null : projectId);
  };

  // Handle project selection with loading state
  const handleSelect = async (project) => {
    if (project.id === activeProjectId) {
      // Just toggle expand if already active
      setExpandedId(expandedId === project.id ? null : project.id);
      return;
    }

    setLoadingProjectId(project.id);

    // Small delay to show loading state
    await new Promise((resolve) => setTimeout(resolve, 150));

    onSelectProject(project);
    setExpandedId(project.id);
    setLoadingProjectId(null);
  };

  // Handle delete with confirmation
  const handleDeleteClick = (e, project) => {
    e.stopPropagation();
    setDeleteTarget(project);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      onDeleteProject(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  // Truncate wallet address for display
  const truncateAddress = (address) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-xl bg-dark-800 border border-dark-600 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-5 w-5 text-accent-primary" />
          <h3 className="font-semibold text-white">Saved Projects</h3>
        </div>
        <div className="text-center py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dark-700 mx-auto mb-3">
            <Coins className="h-6 w-6 text-gray-500" />
          </div>
          <p className="text-gray-400 text-sm">No saved projects yet</p>
          <p className="text-gray-500 text-xs mt-1">
            Track a token to save it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl bg-dark-800 border border-dark-600 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600 bg-dark-700/30">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-accent-primary" />
            <h3 className="font-semibold text-white">Saved Projects</h3>
            <span className="text-xs text-gray-500 bg-dark-600 px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          </div>
        </div>

        {/* Project List */}
        <div className="max-h-[500px] overflow-y-auto">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isHovered = hoveredId === project.id;
            const isExpanded = expandedId === project.id;
            const isLoading = loadingProjectId === project.id;
            const walletCount = project.wallets?.length || 0;

            return (
              <div
                key={project.id}
                className={`
                  border-b border-dark-600/50 last:border-b-0
                  transition-colors duration-200
                  ${isActive ? 'bg-accent-primary/5' : ''}
                `}
              >
                {/* Project Header */}
                <div
                  onClick={() => handleSelect(project)}
                  onMouseEnter={() => setHoveredId(project.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`
                    relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200
                    ${isActive
                      ? 'bg-accent-primary/10 border-l-2 border-l-accent-primary'
                      : 'hover:bg-dark-700/50 border-l-2 border-l-transparent'
                    }
                    ${isLoading ? 'opacity-70 pointer-events-none' : ''}
                  `}
                >
                  {/* Expand/Collapse Button */}
                  {walletCount > 0 && (
                    <button
                      onClick={(e) => toggleExpand(e, project.id)}
                      className={`
                        flex-shrink-0 p-1 hover:bg-dark-600 rounded transition-all duration-200
                        ${isExpanded ? 'bg-dark-600/50' : ''}
                      `}
                    >
                      <div
                        className={`transform transition-transform duration-200 ${
                          isExpanded ? 'rotate-90' : 'rotate-0'
                        }`}
                      >
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                  )}

                  {/* No expand button placeholder */}
                  {walletCount === 0 && <div className="w-6" />}

                  {/* Token Image with loading overlay */}
                  <div className="flex-shrink-0 relative">
                    {project.tokenImage ? (
                      <img
                        src={project.tokenImage}
                        alt={project.tokenSymbol}
                        className={`
                          w-10 h-10 rounded-lg object-cover bg-dark-600
                          transition-all duration-200
                          ${isLoading ? 'opacity-50' : ''}
                        `}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-10 h-10 rounded-lg bg-dark-600 items-center justify-center ${
                        project.tokenImage ? 'hidden' : 'flex'
                      }`}
                    >
                      <Coins className="h-5 w-5 text-gray-500" />
                    </div>

                    {/* Loading spinner overlay */}
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-dark-800/50 rounded-lg">
                        <Loader2 className="h-5 w-5 text-accent-primary animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {project.tokenSymbol}
                      </span>
                      {isActive && (
                        <span className="text-[10px] bg-accent-primary/20 text-accent-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span>{formatMarketCap(project.marketCap)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        {walletCount}
                      </span>
                    </div>
                  </div>

                  {/* Actions / Time */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isHovered && !isActive ? (
                      <button
                        onClick={(e) => handleDeleteClick(e, project)}
                        className="p-1.5 hover:bg-accent-danger/20 text-gray-500 hover:text-accent-danger rounded-lg transition-all duration-200"
                        title="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(project.lastScanned)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Wallet List with Animation */}
                <AnimatedCollapse isOpen={isExpanded && walletCount > 0}>
                  <div className="bg-dark-900/50 border-t border-dark-600/30">
                    <div className="px-4 py-2 flex items-center gap-2 text-xs text-gray-500 border-b border-dark-600/30">
                      <Wallet className="h-3 w-3" />
                      <span>Tracked Wallets</span>
                      <span className="ml-auto bg-dark-600 px-1.5 py-0.5 rounded text-gray-400">
                        {walletCount}
                      </span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {project.wallets.map((wallet, index) => (
                        <div
                          key={wallet.id || index}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-dark-700/30 transition-colors duration-150 group"
                          style={{
                            animationDelay: `${index * 30}ms`,
                          }}
                        >
                          <div className="w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-xs text-gray-500 font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white font-medium truncate">
                                {wallet.name || `Wallet ${index + 1}`}
                              </span>
                              {wallet.group && (
                                <span
                                  className={`
                                    text-[9px] px-1 py-0.5 rounded font-bold uppercase
                                    ${wallet.group === 'PREM'
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : 'bg-blue-500/10 text-blue-400'
                                    }
                                  `}
                                >
                                  {wallet.group === 'PREM' ? 'Premium' : 'WIC'}
                                </span>
                              )}
                            </div>
                            <code className="text-xs text-gray-500 font-mono">
                              {truncateAddress(wallet.address)}
                            </code>
                          </div>
                          <a
                            href={`https://solscan.io/account/${wallet.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-dark-600 rounded transition-all duration-150 text-gray-500 hover:text-accent-primary"
                            title="View on Solscan"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </AnimatedCollapse>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
