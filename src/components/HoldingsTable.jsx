import React, { useState, useMemo, useCallback } from 'react';
import {
  Wallet,
  ExternalLink,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Send,
  Trophy,
  Medal,
  Award,
  Link2,
  Search,
  Loader2,
  HelpCircle,
  ShoppingCart,
  Plus,
  Ban,
  Zap,
  Package,
} from 'lucide-react';
import { truncateAddress, WALLET_GROUPS } from '../utils/fileParser';

// Time constants (defined outside component to avoid recreation)
const FIFTEEN_MINS_MS = 15 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Format functions (pure functions, no dependencies)
const formatBalance = (balance) => {
  if (!balance || balance === 0) return '0';
  if (balance < 0.0001) return balance.toExponential(4);
  if (balance < 1) return balance.toFixed(6);
  if (balance < 1000) return balance.toFixed(4);
  if (balance < 1000000) return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (balance < 1000000000) return (balance / 1000000).toFixed(2) + 'M';
  return (balance / 1000000000).toFixed(2) + 'B';
};

const formatUSD = (value) => {
  if (!value || value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1000000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${(value / 1000000).toFixed(2)}M`;
};

// Memoized sub-components (defined outside to prevent recreation)
const RankBadge = React.memo(({ rank }) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400">
        <Trophy className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-400/20 text-gray-300">
        <Medal className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400">
        <Award className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-dark-600 text-gray-500 text-xs font-medium">
      {rank}
    </div>
  );
});
RankBadge.displayName = 'RankBadge';

const GroupBadge = React.memo(({ group }) => {
  if (!group || !WALLET_GROUPS[group]) return null;

  const groupInfo = WALLET_GROUPS[group];
  return (
    <span className={`
      inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
      ${groupInfo.bg} ${groupInfo.color}
    `}>
      {groupInfo.label}
    </span>
  );
});
GroupBadge.displayName = 'GroupBadge';

const BalanceChangeIndicator = React.memo(({ change }) => {
  if (!change) return null;

  return (
    <div className={`
      flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded
      ${change.direction === 'up'
        ? 'bg-accent-success/10 text-accent-success'
        : 'bg-accent-danger/10 text-accent-danger'
      }
    `}>
      {change.direction === 'up' ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>{formatBalance(Math.abs(change.amount))}</span>
    </div>
  );
});
BalanceChangeIndicator.displayName = 'BalanceChangeIndicator';

// Loading skeleton for wallet data
const WalletLoadingSkeleton = React.memo(({ status, queuePosition, estimatedTime }) => {
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-end gap-2">
        <Loader2 className="h-4 w-4 text-accent-primary animate-spin" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-gray-500">In queue</span>
        </div>
        {estimatedTime && (
          <span className="text-xs text-gray-600">~{estimatedTime}s remaining</span>
        )}
      </div>
    );
  }

  return null;
});
WalletLoadingSkeleton.displayName = 'WalletLoadingSkeleton';

// Shimmer loading bar for holdings percentage
const HoldingsBarSkeleton = React.memo(() => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden min-w-[60px] relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-dark-500 to-transparent animate-shimmer" />
    </div>
    <span className="text-xs text-gray-600 min-w-[50px] text-right">---</span>
  </div>
));
HoldingsBarSkeleton.displayName = 'HoldingsBarSkeleton';

const HoldingsBar = React.memo(({ percentage, rank }) => {
  if (percentage === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden min-w-[60px]">
          <div className="h-full w-0" />
        </div>
        <span className="text-xs text-gray-500 min-w-[50px] text-right">
          New
        </span>
      </div>
    );
  }

  // Cap visual bar at 100% but show actual value
  const barWidth = Math.min(percentage, 100);
  const isOverAcquired = percentage > 100;

  // Color based on how much they're holding
  const getBarColor = () => {
    if (isOverAcquired) return 'bg-purple-500';
    if (rank <= 3) {
      if (rank === 1) return 'bg-yellow-500';
      if (rank === 2) return 'bg-gray-400';
      return 'bg-orange-500';
    }
    if (percentage >= 80) return 'bg-accent-success';
    if (percentage >= 50) return 'bg-accent-primary';
    if (percentage >= 20) return 'bg-accent-warning';
    return 'bg-accent-danger';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden min-w-[60px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`text-xs min-w-[50px] text-right font-mono ${
        isOverAcquired ? 'text-purple-400' :
        percentage >= 80 ? 'text-accent-success' :
        percentage >= 50 ? 'text-white' :
        percentage >= 20 ? 'text-accent-warning' :
        'text-accent-danger'
      }`}>
        {percentage > 999 ? '>999%' : `${percentage.toFixed(0)}%`}
      </span>
    </div>
  );
});
HoldingsBar.displayName = 'HoldingsBar';

export function HoldingsTable({
  walletData,
  wallets = [],
  tokenPrice,
  tokenMetadata,
  previousBalances = {},
  initialBalances = {},
  transactions = [],
  onRemoveWallet,
  onDeepFetchWallet,
  isLoading,
}) {
  const [sortField, setSortField] = useState('uiBalance');
  const [sortDirection, setSortDirection] = useState('desc');
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [expandedWallet, setExpandedWallet] = useState(null);
  const [deepFetchingWallets, setDeepFetchingWallets] = useState(new Set());
  const [groupFilter, setGroupFilter] = useState('ALL'); // ALL, PREM, WIC

  // Create a map of tracked wallet addresses for quick lookup
  const trackedAddresses = useMemo(() => {
    const map = new Map();
    wallets.forEach(w => {
      map.set(w.address.toLowerCase(), w.name);
    });
    return map;
  }, [wallets]);

  // Create a map of wallet address -> group (PREM/WIC)
  const walletGroups = useMemo(() => {
    const map = new Map();
    wallets.forEach(w => {
      if (w.group) {
        map.set(w.address.toLowerCase(), w.group);
      }
    });
    return map;
  }, [wallets]);

  // Get group for a wallet address
  const getWalletGroup = useCallback((address) => {
    return address ? walletGroups.get(address.toLowerCase()) : null;
  }, [walletGroups]);

  // Helper functions that use trackedAddresses (stable references via useCallback)
  const isTrackedWallet = useCallback((address) => {
    return address && trackedAddresses.has(address.toLowerCase());
  }, [trackedAddresses]);

  const getTrackedWalletName = useCallback((address) => {
    return address ? trackedAddresses.get(address.toLowerCase()) : null;
  }, [trackedAddresses]);

  // Memoized map of wallet address -> processed transactions with stats
  // This prevents recalculating for each wallet on every render
  const walletTransactionsMap = useMemo(() => {
    const map = new Map();

    // Group transactions by wallet address and process them
    transactions.forEach(tx => {
      const walletKey = tx.walletAddress?.toLowerCase();
      if (!walletKey) return;

      if (!map.has(walletKey)) {
        map.set(walletKey, {
          transactions: [],
          totalBought: 0,
          totalSold: 0,
          totalTransferredOut: 0,
          totalTransferredIn: 0,
          connectedWallets: new Map(),
        });
      }

      const walletData = map.get(walletKey);

      // Categorize transaction based on new type system
      // Types from API: BUY, SELL, TRANSFER_OUT, TRANSFER_IN
      let category;
      const txType = tx.type;

      if (txType === 'BUY') {
        category = 'BUY';
        walletData.totalBought += tx.amount || 0;
      } else if (txType === 'TRANSFER_IN') {
        category = 'TRANSFER_IN';
        walletData.totalTransferredIn += tx.amount || 0;
        // Also count as acquired (received tokens)
        walletData.totalBought += tx.amount || 0;
        // Track source wallet if it's tracked
        if (tx.fromWallet) {
          const fromWalletKey = tx.fromWallet.toLowerCase();
          if (trackedAddresses.has(fromWalletKey)) {
            const existing = walletData.connectedWallets.get(fromWalletKey) || { sent: 0, received: 0 };
            walletData.connectedWallets.set(fromWalletKey, {
              ...existing,
              received: (existing.received || 0) + (tx.amount || 0),
              name: trackedAddresses.get(fromWalletKey),
              address: tx.fromWallet,
            });
          }
        }
      } else if (txType === 'TRANSFER_OUT') {
        category = 'TRANSFER_OUT';
        walletData.totalTransferredOut += tx.amount || 0;
        // Track destination wallet
        if (tx.toWallet) {
          const toWalletKey = tx.toWallet.toLowerCase();
          const existing = walletData.connectedWallets.get(toWalletKey) || { sent: 0, received: 0 };
          walletData.connectedWallets.set(toWalletKey, {
            ...existing,
            sent: (existing.sent || 0) + (tx.amount || 0),
            name: trackedAddresses.get(toWalletKey),
            address: tx.toWallet,
            isTracked: trackedAddresses.has(toWalletKey),
          });
        }
      } else if (txType === 'SELL') {
        category = 'SELL';
        walletData.totalSold += tx.amount || 0;
      } else {
        // Legacy fallback for old transaction data
        if (tx.type === 'BUY') {
          category = 'BUY';
          walletData.totalBought += tx.amount || 0;
        } else {
          // Old SELL type - check if it's actually a transfer
          if (tx.toWallet && trackedAddresses.has(tx.toWallet.toLowerCase())) {
            category = 'TRANSFER_OUT';
            walletData.totalTransferredOut += tx.amount || 0;
          } else {
            category = 'SELL';
            walletData.totalSold += tx.amount || 0;
          }
        }
      }

      // Add processed transaction
      walletData.transactions.push({
        ...tx,
        category,
        toWalletName: tx.toWallet ? trackedAddresses.get(tx.toWallet.toLowerCase()) : null,
        fromWalletName: tx.fromWallet ? trackedAddresses.get(tx.fromWallet.toLowerCase()) : null,
      });
    });

    return map;
  }, [transactions, trackedAddresses]);

  // Get processed transactions for a wallet (O(1) lookup)
  const getWalletTransactions = useCallback((walletAddress) => {
    const data = walletTransactionsMap.get(walletAddress.toLowerCase());
    return data?.transactions || [];
  }, [walletTransactionsMap]);

  // Get total tokens acquired by a wallet
  const getTotalAcquired = useCallback((walletAddress) => {
    const data = walletTransactionsMap.get(walletAddress.toLowerCase());
    if (data?.totalBought > 0) {
      return data.totalBought;
    }
    // Fallback to stored initial balance if no transaction history
    return initialBalances[walletAddress] || 0;
  }, [walletTransactionsMap, initialBalances]);

  // Get % of acquired holdings remaining
  const getHoldingsPercent = useCallback((wallet) => {
    const totalAcquired = getTotalAcquired(wallet.address);
    if (totalAcquired <= 0) return null;
    const current = wallet.uiBalance || 0;
    return (current / totalAcquired) * 100;
  }, [getTotalAcquired]);

  /**
   * Get detailed activity status for a wallet (optimized single-pass)
   * Status priority:
   * - OUT: wallet has 0 balance
   * - SELLING: sold within last 15 mins
   * - SOLD: sold within last 24 hours (and reduced position)
   * - TRANSFERRED: transferred out within last 24 hours
   * - RECEIVED: received transfer within last 24 hours
   * - BUY: first purchase within 24 hours (only has 1 buy tx)
   * - BOUGHT MORE: additional purchase within 24 hours
   * - HOLDING: has balance, no recent activity
   * - UNKNOWN: has balance but no transaction history found
   */
  const getActivityStatus = useCallback((walletAddress, currentBalance) => {
    // OUT - wallet has 0 balance
    if (currentBalance <= 0 || currentBalance === undefined) {
      return {
        status: 'OUT',
        label: 'Out',
        color: 'bg-gray-500/10 text-gray-400',
        icon: Ban,
        description: 'Completely exited position',
      };
    }

    const walletTxs = getWalletTransactions(walletAddress);
    const walletStats = walletTransactionsMap.get(walletAddress.toLowerCase());

    // No transactions found but has balance
    if (walletTxs.length === 0) {
      return {
        status: 'UNKNOWN',
        label: 'Unknown',
        color: 'bg-accent-warning/10 text-accent-warning',
        icon: HelpCircle,
        description: 'No transaction history found',
      };
    }

    // Single pass through transactions to categorize by time window and type
    const now = Date.now();
    let sellsIn15Mins = false;
    let sellsIn24Hours = false;
    let sellAmountIn24Hours = 0;
    let transfersOutIn24Hours = false;
    let transfersInIn24Hours = false;
    let buysIn24Hours = false;
    let totalBuys = 0;
    let totalTransfersIn = 0;

    for (const tx of walletTxs) {
      // Count total buys and transfers for detection
      if (tx.category === 'BUY') totalBuys++;
      if (tx.category === 'TRANSFER_IN') totalTransfersIn++;

      // Check time window
      if (!tx.timestamp) continue;
      const txAge = now - new Date(tx.timestamp).getTime();

      // Check 15-minute window
      if (txAge <= FIFTEEN_MINS_MS) {
        if (tx.category === 'SELL') sellsIn15Mins = true;
      }

      // Check 24-hour window
      if (txAge <= TWENTY_FOUR_HOURS_MS) {
        if (tx.category === 'SELL') {
          sellsIn24Hours = true;
          sellAmountIn24Hours += tx.amount || 0;
        } else if (tx.category === 'TRANSFER_OUT') {
          transfersOutIn24Hours = true;
        } else if (tx.category === 'TRANSFER_IN') {
          transfersInIn24Hours = true;
        } else if (tx.category === 'BUY') {
          buysIn24Hours = true;
        }
      }

      // Early exit if we found the highest priority status (SELLING)
      if (sellsIn15Mins) break;
    }

    // Calculate if the wallet actually reduced their position
    // Don't show "SOLD" if they still have all/most of their tokens
    const totalAcquired = walletStats?.totalBought || 0;
    const hasSignificantSell = totalAcquired > 0
      ? (sellAmountIn24Hours / totalAcquired) > 0.05 // Sold more than 5% of acquired
      : sellAmountIn24Hours > 0;

    // Return status based on priority
    if (sellsIn15Mins) {
      return {
        status: 'SELLING',
        label: 'Selling',
        color: 'bg-red-500/20 text-red-400 animate-pulse',
        icon: Zap,
        description: 'Actively selling (within 15 mins)',
      };
    }

    // Only show SOLD if they actually reduced position significantly
    if (sellsIn24Hours && hasSignificantSell) {
      return {
        status: 'SOLD',
        label: 'Sold',
        color: 'bg-accent-danger/10 text-accent-danger',
        icon: TrendingDown,
        description: 'Sold within last 24 hours',
      };
    }

    if (transfersOutIn24Hours) {
      return {
        status: 'TRANSFERRED',
        label: 'Transferred',
        color: 'bg-blue-500/10 text-blue-400',
        icon: Send,
        description: 'Transferred out within last 24 hours',
      };
    }

    // Show RECEIVED status for incoming transfers
    if (transfersInIn24Hours) {
      return {
        status: 'RECEIVED',
        label: 'Received',
        color: 'bg-cyan-500/10 text-cyan-400',
        icon: Package,
        description: 'Received transfer within last 24 hours',
      };
    }

    if (buysIn24Hours) {
      // Check if this is their first buy ever (only 1 total buy tx, not counting transfers)
      if (totalBuys === 1 && totalTransfersIn === 0) {
        return {
          status: 'BUY',
          label: 'Buy',
          color: 'bg-accent-success/20 text-accent-success',
          icon: ShoppingCart,
          description: 'First purchase within 24 hours',
        };
      }

      // Multiple buys - they bought more
      return {
        status: 'BOUGHT_MORE',
        label: 'Bought More',
        color: 'bg-green-500/20 text-green-400',
        icon: Plus,
        description: 'Added to position within 24 hours',
      };
    }

    // HOLDING - has balance, has tx history, but no recent activity
    return {
      status: 'HOLDING',
      label: 'Holding',
      color: 'bg-purple-500/10 text-purple-400',
      icon: Package,
      description: 'Holding steady (no activity in 24h)',
    };
  }, [getWalletTransactions, walletTransactionsMap]);

  // Get balance change
  const getBalanceChange = (wallet) => {
    const prevBalance = previousBalances[wallet.address];
    if (prevBalance === undefined) return null;

    const change = (wallet.uiBalance || 0) - prevBalance;
    if (Math.abs(change) < 0.0001) return null; // Ignore tiny changes

    return {
      amount: change,
      percentage: prevBalance > 0 ? ((change / prevBalance) * 100) : 0,
      direction: change > 0 ? 'up' : 'down',
    };
  };

  // Get transfer stats for a wallet (uses pre-calculated data from walletTransactionsMap)
  const getTransferStats = useCallback((walletAddress) => {
    const data = walletTransactionsMap.get(walletAddress.toLowerCase());

    if (!data) {
      return {
        totalTransferredOut: 0,
        totalTransferredIn: 0,
        totalSold: 0,
        totalBought: 0,
        connectedWallets: [],
      };
    }

    return {
      totalTransferredOut: data.totalTransferredOut || 0,
      totalTransferredIn: data.totalTransferredIn || 0,
      totalSold: data.totalSold,
      totalBought: data.totalBought,
      connectedWallets: Array.from(data.connectedWallets.values()),
    };
  }, [walletTransactionsMap]);

  // Sort data (memoized to avoid recalculating on every render)
  const sortedData = useMemo(() => {
    return [...walletData].sort((a, b) => {
      let aVal, bVal;

      // Handle special sort fields
      if (sortField === 'name') {
        aVal = a.name?.toLowerCase() || '';
        bVal = b.name?.toLowerCase() || '';
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (sortField === 'usdValue') {
        aVal = (a.uiBalance || 0) * tokenPrice;
        bVal = (b.uiBalance || 0) * tokenPrice;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      // Numeric sorting
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [walletData, sortField, sortDirection, tokenPrice]);

  // Filter by group (PREM/WIC/ALL)
  const filteredData = useMemo(() => {
    if (groupFilter === 'ALL') return sortedData;
    return sortedData.filter(wallet => {
      const group = walletGroups.get(wallet.address?.toLowerCase());
      return group === groupFilter;
    });
  }, [sortedData, groupFilter, walletGroups]);

  // Count wallets by group for filter badges
  const groupCounts = useMemo(() => {
    const counts = { ALL: walletData.length, PREM: 0, WIC: 0 };
    walletData.forEach(wallet => {
      const group = walletGroups.get(wallet.address?.toLowerCase());
      if (group === 'PREM') counts.PREM++;
      else if (group === 'WIC') counts.WIC++;
    });
    return counts;
  }, [walletData, walletGroups]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const copyAddress = async (address) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Handle deep fetch for a wallet
  const handleDeepFetch = async (walletAddress) => {
    if (!onDeepFetchWallet || deepFetchingWallets.has(walletAddress)) return;

    setDeepFetchingWallets(prev => new Set([...prev, walletAddress]));

    try {
      await onDeepFetchWallet(walletAddress);
    } finally {
      setDeepFetchingWallets(prev => {
        const next = new Set(prev);
        next.delete(walletAddress);
        return next;
      });
    }
  };

  // SortIcon depends on component state so stays inside
  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 text-accent-primary" />
    ) : (
      <ChevronDown className="h-4 w-4 text-accent-primary" />
    );
  };

  if (walletData.length === 0) {
    return (
      <div className="rounded-xl bg-dark-800 border border-dark-600 p-12 text-center">
        <Wallet className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 font-medium">No wallets loaded</p>
        <p className="text-gray-500 text-sm mt-1">
          Upload a CSV or Excel file to start tracking
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-dark-800 border border-dark-600 overflow-hidden">
      {/* Group Filter Tabs */}
      {(groupCounts.PREM > 0 || groupCounts.WIC > 0) && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-600 bg-dark-700/30">
          <span className="text-xs text-gray-500 mr-2">Filter:</span>
          <button
            onClick={() => setGroupFilter('ALL')}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${groupFilter === 'ALL'
                ? 'bg-accent-primary text-white'
                : 'bg-dark-600 text-gray-400 hover:bg-dark-500 hover:text-white'
              }
            `}
          >
            All
            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">
              {groupCounts.ALL}
            </span>
          </button>
          {groupCounts.PREM > 0 && (
            <button
              onClick={() => setGroupFilter('PREM')}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${groupFilter === 'PREM'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                }
              `}
            >
              Premium
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                groupFilter === 'PREM' ? 'bg-black/20' : 'bg-yellow-500/20'
              }`}>
                {groupCounts.PREM}
              </span>
            </button>
          )}
          {groupCounts.WIC > 0 && (
            <button
              onClick={() => setGroupFilter('WIC')}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${groupFilter === 'WIC'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                }
              `}
            >
              WIC
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                groupFilter === 'WIC' ? 'bg-black/20' : 'bg-blue-500/20'
              }`}>
                {groupCounts.WIC}
              </span>
            </button>
          )}
          {groupFilter !== 'ALL' && (
            <span className="text-xs text-gray-500 ml-auto">
              Showing {filteredData.length} of {groupCounts.ALL} wallets
            </span>
          )}
        </div>
      )}

      {/* Table header */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-600 bg-dark-700/50">
              {/* Rank */}
              <th className="px-3 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-12">
                #
              </th>
              {/* Name */}
              <th
                onClick={() => handleSort('name')}
                className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  Wallet
                  <SortIcon field="name" />
                </div>
              </th>
              {/* Holdings + Supply % */}
              <th
                onClick={() => handleSort('uiBalance')}
                className="px-4 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors min-w-[180px]"
              >
                <div className="flex items-center justify-end gap-2">
                  Holdings
                  <SortIcon field="uiBalance" />
                </div>
              </th>
              {/* Holding % Bar */}
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[140px]">
                Holding %
              </th>
              {/* Value */}
              <th
                onClick={() => handleSort('usdValue')}
                className="px-4 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  Value
                  <SortIcon field="usdValue" />
                </div>
              </th>
              {/* Activity */}
              <th className="px-4 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Activity
              </th>
              {/* Actions */}
              <th className="px-4 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {filteredData.map((wallet, index) => {
              const usdValue = (wallet.uiBalance || 0) * tokenPrice;
              const hasError = wallet.error;
              const rank = index + 1;
              const balanceChange = getBalanceChange(wallet);
              const holdingsPercent = getHoldingsPercent(wallet);
              const isExpanded = expandedWallet === wallet.id;

              return (
                <React.Fragment key={wallet.id}>
                  {/* Main Row */}
                  <tr
                    onClick={(e) => {
                      // Don't expand if clicking on buttons/links
                      if (e.target.closest('button') || e.target.closest('a')) return;
                      setExpandedWallet(isExpanded ? null : wallet.id);
                    }}
                    className={`
                      table-row-hover transition-colors cursor-pointer
                      ${isLoading ? 'opacity-50' : ''}
                      ${rank <= 3 ? 'bg-dark-700/30' : ''}
                      ${isExpanded ? 'bg-dark-700/50' : ''}
                    `}
                  >
                    {/* Rank */}
                    <td className="px-3 py-4">
                      <RankBadge rank={rank} />
                    </td>

                    {/* Name + Address */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-600 flex-shrink-0">
                          <Wallet className="h-4 w-4 text-accent-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate">
                              {wallet.name}
                            </span>
                            <GroupBadge group={getWalletGroup(wallet.address)} />
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-accent-primary" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <code className="font-mono text-xs text-gray-500">
                              {truncateAddress(wallet.address, 4, 4)}
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyAddress(wallet.address);
                              }}
                              className="p-1 hover:bg-dark-600 rounded transition-colors"
                              title="Copy address"
                            >
                              {copiedAddress === wallet.address ? (
                                <Check className="h-3 w-3 text-accent-success" />
                              ) : (
                                <Copy className="h-3 w-3 text-gray-600 hover:text-gray-400" />
                              )}
                            </button>
                            <a
                              href={`https://solscan.io/account/${wallet.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 hover:bg-dark-600 rounded transition-colors"
                              title="View on Solscan"
                            >
                              <ExternalLink className="h-3 w-3 text-gray-600 hover:text-gray-400" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Holdings + Change */}
                    <td className="px-4 py-4 text-right">
                      {wallet.status === 'loading' || wallet.status === 'pending' ? (
                        <WalletLoadingSkeleton
                          status={wallet.status}
                          queuePosition={wallet.queuePosition}
                          estimatedTime={wallet.estimatedTime}
                        />
                      ) : hasError ? (
                        <div className="flex items-center justify-end gap-2 text-amber-500">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">Retrying...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-white font-medium">
                            {formatBalance(wallet.uiBalance)}
                          </span>
                          <BalanceChangeIndicator change={balanceChange} />
                        </div>
                      )}
                    </td>

                    {/* Holding % Bar */}
                    <td className="px-4 py-4">
                      {wallet.status === 'loading' || wallet.status === 'pending' ? (
                        <HoldingsBarSkeleton />
                      ) : !hasError ? (
                        <HoldingsBar
                          percentage={holdingsPercent}
                          rank={rank}
                        />
                      ) : null}
                    </td>

                    {/* USD Value */}
                    <td className="px-4 py-4 text-right">
                      <span className={`font-mono font-medium ${usdValue > 0 ? 'text-white' : 'text-gray-500'}`}>
                        {formatUSD(usdValue)}
                      </span>
                    </td>

                    {/* Activity */}
                    <td className="px-4 py-4">
                      {(() => {
                        const activityStatus = getActivityStatus(wallet.address, wallet.uiBalance);
                        const StatusIcon = activityStatus.icon;
                        return (
                          <div className="flex items-center justify-center">
                            <span
                              className={`
                                flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg
                                ${activityStatus.color}
                                ${activityStatus.status === 'UNKNOWN' ? 'cursor-pointer hover:opacity-80' : ''}
                                transition-all
                              `}
                              title={activityStatus.description}
                              onClick={(e) => {
                                if (activityStatus.status === 'UNKNOWN') {
                                  e.stopPropagation();
                                  setExpandedWallet(wallet.id);
                                }
                              }}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {activityStatus.label}
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveWallet(wallet.id);
                          }}
                          className="p-2 hover:bg-accent-danger/10 text-gray-500 hover:text-accent-danger rounded-lg transition-colors"
                          title="Remove wallet"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {isExpanded && (
                    <tr className="bg-dark-900/50">
                      <td colSpan={7} className="px-4 py-4">
                        {(() => {
                          // Compute expanded-only data here to avoid calculating when collapsed
                          const walletTxs = getWalletTransactions(wallet.address);
                          const totalAcquired = getTotalAcquired(wallet.address);
                          const transferStats = getTransferStats(wallet.address);
                          return (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pl-12">
                              {/* Stats Summary */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-gray-400">Wallet Stats</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-dark-700/50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3 text-accent-success" />
                                      Total Acquired
                                    </div>
                                    <div className="text-sm font-mono mt-1">
                                      {totalAcquired > 0 ? (
                                        <span className="text-accent-success">{formatBalance(totalAcquired)}</span>
                                      ) : wallet.uiBalance > 0 ? (
                                        <span className="flex items-center gap-1 text-accent-warning">
                                          <HelpCircle className="h-3 w-3" />
                                          Unknown
                                        </span>
                                      ) : (
                                        <span className="text-gray-500">0</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-dark-700/50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500">Current Balance</div>
                                    <div className="text-sm font-mono text-white mt-1">
                                      {formatBalance(wallet.uiBalance)}
                                    </div>
                                  </div>
                                  <div className="bg-dark-700/50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                      <Send className="h-3 w-3 text-blue-400" />
                                      Transferred Out
                                    </div>
                                    <div className="text-sm font-mono text-blue-400 mt-1">
                                      {transferStats.totalTransferredOut > 0
                                        ? formatBalance(transferStats.totalTransferredOut)
                                        : '0'
                                      }
                                    </div>
                                  </div>
                                  <div className="bg-dark-700/50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                      <TrendingDown className="h-3 w-3 text-accent-danger" />
                                      Sold (Swapped)
                                    </div>
                                    <div className="text-sm font-mono text-accent-danger mt-1">
                                      {transferStats.totalSold > 0
                                        ? formatBalance(transferStats.totalSold)
                                        : '0'
                                      }
                                    </div>
                                  </div>
                                  {transferStats.totalTransferredIn > 0 && (
                                    <div className="bg-dark-700/50 rounded-lg p-3 col-span-2">
                                      <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <Package className="h-3 w-3 text-cyan-400" />
                                        Received (Transfers In)
                                      </div>
                                      <div className="text-sm font-mono text-cyan-400 mt-1">
                                        {formatBalance(transferStats.totalTransferredIn)}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Holding Summary */}
                                <div className="bg-dark-600/50 rounded-lg p-3 mt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">Holding Ratio</span>
                                    <span className={`text-sm font-mono font-medium ${
                                      holdingsPercent !== null
                                        ? holdingsPercent >= 80 ? 'text-accent-success'
                                          : holdingsPercent >= 50 ? 'text-white'
                                          : holdingsPercent >= 20 ? 'text-accent-warning'
                                          : 'text-accent-danger'
                                        : 'text-gray-500'
                                    }`}>
                                      {holdingsPercent !== null
                                        ? `${holdingsPercent.toFixed(1)}%`
                                        : 'N/A'
                                      }
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {totalAcquired > 0 && (
                                      <>
                                        {formatBalance(wallet.uiBalance)} of {formatBalance(totalAcquired)} acquired
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Connected Wallets */}
                                {transferStats.connectedWallets.length > 0 && (
                                  <div className="mt-4">
                                    <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2 mb-2">
                                      <Link2 className="h-4 w-4" />
                                      Connected Wallets
                                    </h4>
                                    <div className="space-y-2">
                                      {transferStats.connectedWallets.map((cw, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-dark-700/50 rounded-lg p-2">
                                          <ArrowRight className="h-3 w-3 text-blue-400" />
                                          <span className="text-sm text-white font-medium">
                                            {cw.name || truncateAddress(cw.address, 4, 4)}
                                          </span>
                                          {cw.isTracked && (
                                            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                              TRACKED
                                            </span>
                                          )}
                                          <span className="text-xs text-gray-500 ml-auto">
                                            {formatBalance(cw.sent || 0)} sent
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* All Token Transactions */}
                              <div className="lg:col-span-2 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-gray-400">
                                    Token Transaction History
                                  </h4>
                                  {walletTxs.length > 0 && (
                                    <span className="text-xs text-gray-500 bg-dark-600 px-2 py-1 rounded">
                                      {walletTxs.length} transactions
                                    </span>
                                  )}
                                </div>
                                {walletTxs.length > 0 ? (
                                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {walletTxs.map((tx, txIndex) => {
                                      // Determine display category and styling
                                      const getCategoryStyle = () => {
                                        switch (tx.category) {
                                          case 'BUY':
                                            return {
                                              bg: 'bg-accent-success/10 text-accent-success',
                                              text: 'text-accent-success',
                                              icon: TrendingUp,
                                              label: 'BUY',
                                            };
                                          case 'TRANSFER_IN':
                                            return {
                                              bg: 'bg-cyan-500/10 text-cyan-400',
                                              text: 'text-cyan-400',
                                              icon: Package,
                                              label: 'RECEIVED',
                                            };
                                          case 'TRANSFER_OUT':
                                            return {
                                              bg: 'bg-blue-500/10 text-blue-400',
                                              text: 'text-blue-400',
                                              icon: Send,
                                              label: 'TRANSFER',
                                            };
                                          case 'SELL':
                                            return {
                                              bg: 'bg-accent-danger/10 text-accent-danger',
                                              text: 'text-accent-danger',
                                              icon: TrendingDown,
                                              label: 'SELL',
                                            };
                                          default:
                                            return {
                                              bg: 'bg-gray-500/10 text-gray-400',
                                              text: 'text-gray-400',
                                              icon: HelpCircle,
                                              label: tx.category || 'UNKNOWN',
                                            };
                                        }
                                      };

                                      const style = getCategoryStyle();
                                      const IconComponent = style.icon;

                                      return (
                                        <div
                                          key={tx.signature || txIndex}
                                          className="flex items-center gap-3 bg-dark-700/50 rounded-lg p-3"
                                        >
                                          <div className={`
                                            flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0
                                            ${style.bg}
                                          `}>
                                            <IconComponent className="h-4 w-4" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`text-sm font-medium ${style.text}`}>
                                                {style.label}
                                              </span>
                                              <span className="text-sm text-white font-mono">
                                                {formatBalance(tx.amount)}
                                              </span>
                                              {/* Show destination for outgoing */}
                                              {tx.toWallet && (tx.category === 'TRANSFER_OUT' || tx.category === 'SELL') && (
                                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                                  <ArrowRight className="h-3 w-3" />
                                                  {tx.toWalletName ? (
                                                    <span className="text-blue-400 font-medium">{tx.toWalletName}</span>
                                                  ) : (
                                                    <span>{truncateAddress(tx.toWallet, 4, 4)}</span>
                                                  )}
                                                </span>
                                              )}
                                              {/* Show source for incoming */}
                                              {tx.fromWallet && tx.category === 'TRANSFER_IN' && (
                                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                                  from
                                                  {tx.fromWalletName ? (
                                                    <span className="text-cyan-400 font-medium">{tx.fromWalletName}</span>
                                                  ) : (
                                                    <span>{truncateAddress(tx.fromWallet, 4, 4)}</span>
                                                  )}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                              {tx.timestamp
                                                ? new Date(tx.timestamp).toLocaleString()
                                                : 'Unknown time'
                                              }
                                            </div>
                                          </div>
                                          {tx.signature && (
                                            <a
                                              href={`https://solscan.io/tx/${tx.signature}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="flex items-center gap-1.5 px-2 py-1.5 bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors flex-shrink-0 text-xs text-gray-400 hover:text-accent-primary"
                                              title="View on Solscan"
                                            >
                                              <ExternalLink className="h-3.5 w-3.5" />
                                              <span className="hidden sm:inline">View TX</span>
                                            </a>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="bg-dark-700/50 rounded-lg p-4 text-center space-y-3">
                                    <div className="flex items-center justify-center gap-2 text-gray-500">
                                      <HelpCircle className="h-4 w-4" />
                                      <span className="text-sm">No token activity found in recent history</span>
                                    </div>

                                    {/* Show deep fetch button if wallet has balance but no transactions */}
                                    {wallet.uiBalance > 0 && onDeepFetchWallet && (
                                      <div className="mt-3 pt-3 border-t border-dark-600">
                                        <p className="text-xs text-gray-500 mb-2">
                                          This wallet has a balance but no visible source. The tokens may have been acquired long ago.
                                        </p>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeepFetch(wallet.address);
                                          }}
                                          disabled={deepFetchingWallets.has(wallet.address)}
                                          className={`
                                            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                            ${deepFetchingWallets.has(wallet.address)
                                              ? 'bg-dark-600 text-gray-400 cursor-not-allowed'
                                              : 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
                                            }
                                          `}
                                        >
                                          {deepFetchingWallets.has(wallet.address) ? (
                                            <>
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                              Searching history...
                                            </>
                                          ) : (
                                            <>
                                              <Search className="h-4 w-4" />
                                              Search Full History
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
