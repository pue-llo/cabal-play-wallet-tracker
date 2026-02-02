import { useState, useEffect, useCallback, useRef } from 'react';
import {
  createConnection,
  batchGetBalances,
  getTokenInfo,
  getTokenPriceOnly,
  getTokenMetadata,
  getWalletTransactions,
  deepFetchWalletTransactions,
  clearCache,
} from '../services/solanaApi';
import {
  saveWallets,
  loadWallets,
  saveTokenMint,
  loadTokenMint,
  saveWalletData,
  loadWalletData,
  saveSettings,
  loadSettings,
  saveTransactions,
  loadTransactions,
  saveInitialBalances,
  loadInitialBalances,
  saveActiveProjectId,
  loadActiveProjectId,
} from '../utils/storage';
import {
  getProjects,
  saveProject,
  deleteProject as deleteProjectFromStorage,
  getProject,
  updateProjectCachedData,
  getProjectCachedData,
} from '../utils/projectStorage';
// NEW: Efficient data caching system
import {
  getInstantLoadData,
  getSyncNeeds,
  cacheWalletBalances,
  cacheTransactions,
  cacheTokenMetadata,
  cacheTokenPrice,
  getCachedBalances,
  getCachedTransactions,
  getNewestTransactionTime,
  clearTokenCache,
  CACHE_DURATIONS,
} from '../services/dataCache';

export function useWalletTracker() {
  // Core state
  const [wallets, setWallets] = useState([]);
  const [tokenMint, setTokenMint] = useState('');
  const [walletData, setWalletData] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenMetadata, setTokenMetadata] = useState(null);
  const [previousBalances, setPreviousBalances] = useState({});
  const [initialBalances, setInitialBalances] = useState({});

  // Project state
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [settings, setSettings] = useState({ refreshInterval: 30, heliusApiKey: '' });

  // Detailed loading status for progress indicator
  const [loadingStatus, setLoadingStatus] = useState({
    stage: null, // 'token_info', 'balances', 'transactions'
    message: '',
    progress: 0, // 0-100
    detail: '', // Additional detail like "Wallet 3 of 10"
  });

  // Refs for interval and fetch control
  const refreshIntervalRef = useRef(null);
  const connectionRef = useRef(null);
  const isFetchingRef = useRef(false);  // Prevents overlapping fetches
  const fetchTimeoutRef = useRef(null); // For debouncing
  const abortControllerRef = useRef(null); // For cancelling fetches
  const forceFullFetchRef = useRef(false); // Force full fetch after clearing data

  // Load projects on mount
  useEffect(() => {
    setProjects(getProjects());
  }, []);

  // Initialize from localStorage on mount
  // NEW: Uses efficient caching system for instant loading
  useEffect(() => {
    const savedWallets = loadWallets();
    const savedTokenMint = loadTokenMint();
    const savedSettings = loadSettings();
    const savedActiveProjectId = loadActiveProjectId();

    setWallets(savedWallets);
    setTokenMint(savedTokenMint);
    setSettings(savedSettings);

    // RESTORE ACTIVE PROJECT for session continuity
    if (savedActiveProjectId) {
      setActiveProjectId(savedActiveProjectId);
      console.log('[useWalletTracker] Restored active project:', savedActiveProjectId);
    }

    // INSTANT LOAD: Get cached data immediately using token mint
    if (savedTokenMint) {
      const cachedData = getInstantLoadData(savedTokenMint);

      if (cachedData.hasData) {
        console.log('[useWalletTracker] INSTANT LOAD from cache:', {
          wallets: cachedData.walletData?.length || 0,
          transactions: cachedData.transactions?.length || 0,
          hasTokenInfo: !!cachedData.tokenInfo,
          lastSync: cachedData.lastSync,
        });

        // Set cached wallet data immediately
        if (cachedData.walletData?.length > 0) {
          setWalletData(cachedData.walletData);
          setLastUpdated(cachedData.lastSync.balances);
        }

        // Set cached transactions immediately (CRITICAL for activity display)
        if (cachedData.transactions?.length > 0) {
          setTransactions(cachedData.transactions);
          console.log('[useWalletTracker] Restored', cachedData.transactions.length, 'cached transactions');
        }

        // Set cached token info immediately
        if (cachedData.tokenInfo) {
          setTokenInfo(cachedData.tokenInfo);
        }

        // Load initial balances for change tracking
        const savedInitials = loadInitialBalances(savedTokenMint);
        if (Object.keys(savedInitials).length > 0) {
          setInitialBalances(savedInitials);
        }
      } else {
        // Fallback to old storage if no new cache
        console.log('[useWalletTracker] No data cache, trying legacy storage...');
        const savedWalletData = loadWalletData();
        const savedTransactions = loadTransactions();

        if (savedWalletData?.data) {
          setWalletData(savedWalletData.data);
          setLastUpdated(savedWalletData.timestamp);
          // Migrate to new cache for future instant loads
          cacheWalletBalances(savedTokenMint, savedWalletData.data);
        }

        if (savedTransactions?.length > 0) {
          setTransactions(savedTransactions);
          // Migrate to new cache for future instant loads
          cacheTransactions(savedTokenMint, savedTransactions);
          console.log('[useWalletTracker] Migrated', savedTransactions.length, 'transactions to new cache');
        }
      }
    }

    // Create connection
    connectionRef.current = createConnection(savedSettings.heliusApiKey);
  }, []);

  // Update connection when API key changes
  useEffect(() => {
    connectionRef.current = createConnection(settings.heliusApiKey);
  }, [settings.heliusApiKey]);

  // PERSIST active project ID for session continuity
  useEffect(() => {
    saveActiveProjectId(activeProjectId);
    if (activeProjectId) {
      console.log('[useWalletTracker] Saved active project:', activeProjectId);
    }
  }, [activeProjectId]);

  // Load initial balances when token mint changes
  useEffect(() => {
    if (tokenMint) {
      const stored = loadInitialBalances(tokenMint);
      setInitialBalances(stored);
    } else {
      setInitialBalances({});
    }
  }, [tokenMint]);

  // Cancel ongoing fetch
  const cancelFetch = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('[useWalletTracker] Cancelling fetch...');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isFetchingRef.current = false;
    setIsLoading(false);
    setIsRefreshing(false);
    setLoadingStatus({
      stage: null,
      message: '',
      progress: 0,
      detail: '',
    });
  }, []);

  // Validate wallet address format
  const isValidSolanaAddress = useCallback((address) => {
    if (!address || typeof address !== 'string') return false;
    // Solana addresses are Base58 encoded, 32-44 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address.trim());
  }, []);

  // Fetch all data for tracked wallets
  // With debouncing and overlap prevention
  const fetchData = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (!tokenMint || wallets.length === 0) return;

    // Validate token mint address
    if (!isValidSolanaAddress(tokenMint)) {
      setError('Invalid token mint address');
      return;
    }

    // Filter out invalid wallet addresses and log warnings
    const validWallets = wallets.filter(w => {
      const isValid = isValidSolanaAddress(w.address);
      if (!isValid) {
        console.warn(`[useWalletTracker] Invalid wallet address skipped: ${w.name || 'unnamed'} - ${w.address}`);
      }
      return isValid;
    });

    if (validWallets.length === 0) {
      setError('No valid wallet addresses found. Please check your wallet list.');
      return;
    }

    if (validWallets.length !== wallets.length) {
      console.warn(`[useWalletTracker] ${wallets.length - validWallets.length} invalid wallets were skipped`);
    }

    // Prevent overlapping fetches (unless forced)
    if (isFetchingRef.current && !forceRefresh) {
      console.log('[useWalletTracker] Skipping fetch - already in progress');
      return;
    }

    // Create new abort controller for this fetch
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    isFetchingRef.current = true;

    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    setError(null);

    try {
      // Always ensure connection is fresh with current API key
      connectionRef.current = createConnection(settings.heliusApiKey);
      const connection = connectionRef.current;

      // Check if we have API key for speed optimization
      const hasApiKey = settings.heliusApiKey && settings.heliusApiKey.trim() !== '';

      // Check if cancelled
      if (abortSignal.aborted) throw new Error('Fetch cancelled');

      // ========================================
      // PRIORITY 1: Fetch Token Info First
      // ========================================
      setLoadingStatus({
        stage: 'token_info',
        message: 'Fetching token data...',
        progress: 5,
        detail: 'Getting price and metadata from DexScreener',
      });

      // Token info from DexScreener (free API, no rate limits)
      const info = await getTokenInfo(tokenMint);

      // Update token info immediately so user sees it
      setTokenInfo(prevInfo => {
        if (!info) return prevInfo;
        if (prevInfo?.isPreview) {
          return {
            ...prevInfo,
            ...info,
            image: info.image || prevInfo.image,
            name: (info.name && info.name !== 'Unknown Token') ? info.name : prevInfo.name,
            isPreview: false,
          };
        }
        return info;
      });

      // NEW: Cache token info and price for instant loading
      if (info) {
        cacheTokenMetadata(tokenMint, {
          name: info.name,
          symbol: info.symbol,
          image: info.image,
          decimals: info.decimals,
        });
        if (info.price) {
          cacheTokenPrice(tokenMint, info.price, info.priceChange24h);
        }
      }

      if (abortSignal.aborted) throw new Error('Fetch cancelled');

      // ========================================
      // PRIORITY 2: Fetch Wallet Balances
      // ========================================
      setLoadingStatus({
        stage: 'balances',
        message: 'Scanning wallet balances...',
        progress: 15,
        detail: `Checking ${validWallets.length} wallets (rate limited)`,
      });

      // Calculate rate limit parameters for time estimates
      const BATCH_SIZE = hasApiKey ? 5 : 3;
      const BATCH_DELAY_SEC = hasApiKey ? 2 : 0.5;
      const totalBatches = Math.ceil(validWallets.length / BATCH_SIZE);

      // STALE-WHILE-REVALIDATE: Only show pending placeholders on FULL load
      // During background refresh, keep showing existing data
      if (showLoading) {
        // Full load - show pending placeholders
        const initialPendingWallets = validWallets.map((wallet, index) => {
          const batchIndex = Math.floor(index / BATCH_SIZE);
          const estimatedTime = Math.round(batchIndex * BATCH_DELAY_SEC);
          return {
            ...wallet,
            id: wallet.address,
            status: 'pending',
            queuePosition: index + 1,
            estimatedTime: estimatedTime > 0 ? estimatedTime : null,
            uiBalance: 0,
          };
        });
        setWalletData(initialPendingWallets);
      }
      // Background refresh - keep existing data visible (stale-while-revalidate)

      // Track completed wallets for progressive updates
      let completedWallets = [];

      // Progress callback for balance fetching - updates wallet statuses
      const onBalanceProgress = (progress) => {
        // Update loading status indicator
        setLoadingStatus({
          stage: 'balances',
          message: showLoading ? 'Scanning wallet balances...' : 'Refreshing balances...',
          progress: 15 + Math.round((progress.percent / 100) * 35),
          detail: `Wallet ${progress.completed}/${progress.total}`,
        });

        // STALE-WHILE-REVALIDATE: Only show loading states during full load
        // During background refresh, keep existing data visible
        if (showLoading) {
          // Calculate which wallets are currently loading (in the current batch)
          const currentBatchStart = Math.floor((progress.completed - 1) / BATCH_SIZE) * BATCH_SIZE;
          const currentBatchEnd = Math.min(currentBatchStart + BATCH_SIZE, validWallets.length);

          // Update wallet statuses (only during full load)
          setWalletData(prevData => {
            return prevData.map((wallet, index) => {
              // Already completed - keep as is
              if (index < progress.completed - BATCH_SIZE) {
                return { ...wallet, status: undefined };
              }
              // Currently loading (in active batch)
              if (index >= currentBatchStart && index < currentBatchEnd) {
                return { ...wallet, status: 'loading' };
              }
              // Still pending - update estimated time
              if (index >= currentBatchEnd) {
                const remainingBatches = Math.floor((index - progress.completed) / BATCH_SIZE);
                const estimatedTime = Math.round(remainingBatches * BATCH_DELAY_SEC);
                return {
                  ...wallet,
                  status: 'pending',
                  estimatedTime: estimatedTime > 0 ? estimatedTime : null,
                };
              }
              return wallet;
            });
          });
        }
        // Background refresh: don't touch wallet data, just update loading status
      };

      // Fetch balances with rate limiting
      const balances = await batchGetBalances(
        connection,
        validWallets,
        tokenMint,
        hasApiKey,
        settings.heliusApiKey,
        onBalanceProgress
      );

      // Also fetch token metadata (quick call)
      const metadata = await getTokenMetadata(connection, tokenMint);

      setLoadingStatus({
        stage: 'balances',
        message: 'Processing balances...',
        progress: 55,
        detail: 'Analyzing wallet data',
      });

      // Store previous balances before updating (for change tracking)
      if (walletData.length > 0) {
        const prevBalances = {};
        walletData.forEach(w => {
          prevBalances[w.address] = w.uiBalance || 0;
        });
        setPreviousBalances(prevBalances);
      }

      // Track initial balances for new wallets (first time we see them with balance > 0)
      const currentInitials = loadInitialBalances(tokenMint);
      const newInitials = {};
      let hasNewInitials = false;

      balances.forEach(wallet => {
        const address = wallet.address;
        // Only set initial balance if:
        // 1. We don't have one recorded yet
        // 2. The wallet has a balance > 0
        if (currentInitials[address] === undefined && wallet.uiBalance > 0) {
          newInitials[address] = wallet.uiBalance;
          hasNewInitials = true;
        }
      });

      if (hasNewInitials) {
        saveInitialBalances(tokenMint, newInitials);
        setInitialBalances(prev => ({ ...prev, ...newInitials }));
      }

      // STALE-WHILE-REVALIDATE: Smart update of wallet data
      // Only update wallets that have changed, preserve order and existing data
      setWalletData(prevData => {
        if (!showLoading && prevData.length > 0) {
          // Background refresh - merge new data with existing
          const existingMap = new Map(prevData.map(w => [w.address, w]));

          return balances.map(newWallet => {
            const existing = existingMap.get(newWallet.address);
            if (existing) {
              // Merge: keep existing data, update with new balance
              return {
                ...existing,
                ...newWallet,
                status: undefined, // Clear any loading status
                previousBalance: existing.uiBalance, // Track for change indicator
              };
            }
            return { ...newWallet, status: undefined };
          });
        }
        // Full load - just set the new data
        return balances.map(w => ({ ...w, status: undefined }));
      });

      // Token info already set in Priority 1
      // Just update metadata here
      setTokenMetadata(metadata);
      setLastUpdated(new Date().toISOString());

      // Save to localStorage (legacy)
      saveWalletData(balances);

      // NEW: Cache to efficient data cache system
      const cachedWallets = cacheWalletBalances(tokenMint, balances);
      console.log(`[useWalletTracker] Cached ${cachedWallets.length} wallet balances`);

      // Cache token metadata
      if (metadata) {
        cacheTokenMetadata(tokenMint, metadata);
      }

      // Fetch transactions for ALL valid wallets with rate limiting
      // Fetch on both initial load AND refresh (for incremental updates)
      if (validWallets.length > 0) {
        // INCREMENTAL FETCHING: Only fetch transactions newer than what we have
        const existingTxs = loadTransactions() || [];
        const knownSignatures = new Set(existingTxs.map(tx => tx.signature));

        // Determine if this should be a FULL fetch or INCREMENTAL fetch
        // FULL fetch when:
        // 1. showLoading=true (user-triggered fetch with loading UI)
        // 2. OR no existing transactions in localStorage
        // 3. OR forceFullFetch flag is set (after clearing data)
        // 4. OR transactions state is empty (fresh component state)
        const needsForceFullFetch = forceFullFetchRef.current;
        const shouldDoFullFetch = showLoading || existingTxs.length === 0 || needsForceFullFetch;

        // Clear the force flag after checking it
        if (needsForceFullFetch) {
          console.log('[Transactions] Force full fetch flag was set - doing complete fetch');
          forceFullFetchRef.current = false;
        }

        // Find the most recent transaction timestamp we have (for incremental fetch only)
        let sinceTimestamp = null;
        if (!shouldDoFullFetch && existingTxs.length > 0) {
          // For refreshes, only get transactions newer than our most recent
          const sortedExisting = [...existingTxs].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
          );
          sinceTimestamp = sortedExisting[0]?.timestamp;
          console.log('[Transactions] Incremental fetch since:', sinceTimestamp);
        }

        const isIncremental = !shouldDoFullFetch;
        console.log(`[Transactions] ${isIncremental ? 'Incremental' : 'FULL'} fetch for ${validWallets.length} wallets (showLoading=${showLoading}, existingTxs=${existingTxs.length}, forced=${needsForceFullFetch})`);

        // ========================================
        // PRIORITY 3: Fetch Transaction/Holder Data (Background)
        // ========================================
        // Process wallets in batches with proper rate limiting
        // Helius has 2-5 second rate limits between heavy calls
        const hasApiKeyTx = settings.heliusApiKey && settings.heliusApiKey.trim() !== '';

        // Rate-limited batch configuration
        const TX_BATCH_SIZE = hasApiKeyTx ? 3 : 2;           // Small batches to respect limits
        const TX_BATCH_DELAY = hasApiKeyTx ? 2500 : 1000;   // 2.5 sec delay for Helius, 1 sec for public
        const TX_PER_WALLET = isIncremental ? 10 : 20;       // Transactions per wallet
        const MAX_PAGES = isIncremental ? 1 : 3;             // Signature pages to check

        const allTxResults = [];
        const totalBatches = Math.ceil(validWallets.length / TX_BATCH_SIZE);

        for (let i = 0; i < validWallets.length; i += TX_BATCH_SIZE) {
          // Check if cancelled before each batch
          if (abortSignal.aborted) {
            console.log('[Transactions] Fetch cancelled by user');
            throw new Error('Fetch cancelled');
          }

          const batch = validWallets.slice(i, i + TX_BATCH_SIZE);
          const batchNum = Math.floor(i / TX_BATCH_SIZE) + 1;
          const walletNum = Math.min(i + TX_BATCH_SIZE, validWallets.length);

          // Update loading status with current progress
          const txProgress = 50 + Math.round((batchNum / totalBatches) * 45);
          setLoadingStatus({
            stage: 'transactions',
            message: isIncremental ? 'Checking for new activity...' : 'Fetching transaction history...',
            progress: txProgress,
            detail: `Scanning wallet ${walletNum} of ${validWallets.length}`,
          });

          const batchPromises = batch.map(wallet =>
            getWalletTransactions(
              connection,
              wallet.address,
              tokenMint,
              TX_PER_WALLET,
              MAX_PAGES,
              false,
              sinceTimestamp,    // Stop when reaching known txs
              knownSignatures    // Skip signatures we already have
            )
          );

          const batchResults = await Promise.all(batchPromises);

          // Check if cancelled after batch completes
          if (abortSignal.aborted) {
            console.log('[Transactions] Fetch cancelled by user');
            throw new Error('Fetch cancelled');
          }

          // Log results per wallet for debugging - show transaction types
          batchResults.forEach((txs, idx) => {
            const walletName = batch[idx]?.name || 'Unknown';
            if (txs.length > 0) {
              // Count by type
              const typeCounts = txs.reduce((acc, tx) => {
                acc[tx.type] = (acc[tx.type] || 0) + 1;
                return acc;
              }, {});
              const typeStr = Object.entries(typeCounts)
                .map(([type, count]) => `${type}: ${count}`)
                .join(', ');
              console.log(`[Transactions] ${walletName}: ${txs.length} txs (${typeStr})`);
            }
          });

          allTxResults.push(...batchResults);

          // Add delay between batches (except for last batch)
          if (i + TX_BATCH_SIZE < validWallets.length) {
            await new Promise(resolve => setTimeout(resolve, TX_BATCH_DELAY));
          }
        }

        setLoadingStatus({
          stage: 'transactions',
          message: 'Processing transactions...',
          progress: 98,
          detail: 'Organizing activity data',
        });

        const newTxs = allTxResults.flat();

        if (newTxs.length > 0) {
          // NEW: Use efficient caching system with automatic deduplication
          const cacheResult = cacheTransactions(tokenMint, newTxs);
          console.log(`[Transactions] Cached: ${cacheResult.added} new, ${cacheResult.total} total`);

          // Get merged transactions from cache (already deduplicated and sorted)
          const cachedTxs = getCachedTransactions(tokenMint);
          setTransactions(cachedTxs.transactions);

          // Also save to legacy storage for compatibility
          saveTransactions(cachedTxs.transactions);
        } else if (!isIncremental) {
          // Full fetch with no results
          setTransactions([]);
          saveTransactions([]);
        }
        // For incremental with no new txs, keep existing data (already loaded)
      }

      // Cache data to active project for faster future loading
      if (activeProjectId && balances.length > 0) {
        updateProjectCachedData(activeProjectId, {
          walletData: balances,
          transactions: loadTransactions(),
          tokenInfo: tokenInfo,
          initialBalances: initialBalances,
        });
      }

    } catch (err) {
      // Don't show error for cancelled fetches
      if (err.message === 'Fetch cancelled') {
        console.log('[useWalletTracker] Fetch was cancelled');
        return; // Exit without setting error state
      }

      setError(err.message);
      setLoadingStatus({
        stage: 'error',
        message: 'Error loading data',
        progress: 0,
        detail: err.message,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
      // Clear loading status after a brief delay to show completion
      setTimeout(() => {
        setLoadingStatus({
          stage: null,
          message: '',
          progress: 100,
          detail: '',
        });
      }, 500);
    }
  }, [wallets, tokenMint, settings.heliusApiKey, isValidSolanaAddress]);

  // Debounced fetch - waits 300ms before executing
  const debouncedFetch = useCallback((showLoading = true) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchData(showLoading);
    }, 300);
  }, [fetchData]);

  // Set up auto-refresh interval
  // STALE-WHILE-REVALIDATE: Show cached data immediately, fetch updates in background
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    if (tokenMint && wallets.length > 0 && settings.refreshInterval > 0) {
      // IMPORTANT: Check localStorage directly because state might not be updated yet
      // This ensures stale-while-revalidate works correctly on initial load
      const cachedWalletData = loadWalletData();
      const cachedTransactions = loadTransactions();
      const hasCachedData = (cachedWalletData?.data?.length > 0) || (cachedTransactions?.length > 0);

      // Initial fetch:
      // - If we have cached data, do a BACKGROUND refresh (stale-while-revalidate)
      // - If no cached data, show loading state (first time load)
      const showLoadingState = !hasCachedData;
      console.log(`[Fetch] Initial fetch - cached data: ${hasCachedData}, showing loading: ${showLoadingState}`);
      fetchData(showLoadingState);

      // Set up interval for background refreshes
      refreshIntervalRef.current = setInterval(() => {
        fetchData(false); // Always background refresh on interval
      }, settings.refreshInterval * 1000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [tokenMint, wallets.length, settings.refreshInterval, fetchData]);

  // Auto-save project when fresh token data comes in
  // This keeps the saved project up-to-date with latest price/marketCap
  useEffect(() => {
    // Only auto-save if:
    // 1. We have an active project
    // 2. Token info is loaded (not preview)
    // 3. We have real data (price > 0 or marketCap > 0)
    if (
      activeProjectId &&
      tokenMint &&
      tokenInfo &&
      !tokenInfo.isPreview &&
      (tokenInfo.price > 0 || tokenInfo.marketCap > 0)
    ) {
      console.log('[Auto-save] Updating project with fresh token data');
      const updatedProject = saveProject({
        id: activeProjectId,
        tokenMint,
        tokenName: tokenInfo.name,
        tokenSymbol: tokenInfo.symbol,
        tokenImage: tokenInfo.image,
        marketCap: tokenInfo.marketCap,
        wallets,
      });

      if (updatedProject) {
        setProjects(getProjects());
      }
    }
  }, [activeProjectId, tokenMint, tokenInfo, wallets]);

  // Add wallets from file upload
  const addWallets = useCallback((newWallets) => {
    setWallets(prev => {
      // Filter duplicates by address
      const existingAddresses = new Set(prev.map(w => w.address.toLowerCase()));
      const uniqueNew = newWallets.filter(
        w => !existingAddresses.has(w.address.toLowerCase())
      );
      const updated = [...prev, ...uniqueNew];
      saveWallets(updated);
      return updated;
    });
  }, []);

  // Replace all wallets (for re-importing Excel)
  const replaceWallets = useCallback((newWallets) => {
    // Clear API cache first
    clearCache();

    setWallets(newWallets);
    saveWallets(newWallets);
    // Clear old wallet data AND transactions from BOTH state and localStorage
    setWalletData([]);
    setTransactions([]);
    saveWalletData([]); // Clear wallet data from localStorage
    saveTransactions([]); // Clear transactions from localStorage
    // Reset other state
    setPreviousBalances({});
    setInitialBalances({});
    // Force next fetch to be a full fetch
    forceFullFetchRef.current = true;
    console.log('[replaceWallets] Cleared all data and set forceFullFetch flag');
  }, []);

  // Remove a wallet
  const removeWallet = useCallback((walletId) => {
    setWallets(prev => {
      const updated = prev.filter(w => w.id !== walletId);
      saveWallets(updated);
      return updated;
    });
    setWalletData(prev => prev.filter(w => w.id !== walletId));
  }, []);

  // Update token mint
  // Now accepts optional previewData to show token info immediately
  const updateTokenMint = useCallback((mint, previewData = null) => {
    // Clear API cache when switching tokens
    clearCache();

    setTokenMint(mint);
    saveTokenMint(mint);
    setActiveProjectId(null);
    // Clear old data from BOTH state AND localStorage to force full fetch
    setWalletData([]);
    setTransactions([]);
    saveWalletData([]); // Clear wallet data from localStorage
    saveTransactions([]); // Clear transactions from localStorage

    // If we have preview data, use it immediately instead of waiting for fetch
    if (previewData) {
      console.log('[updateTokenMint] Using preview data for instant display');
      setTokenInfo({
        name: previewData.name || 'Unknown Token',
        symbol: previewData.symbol || '???',
        image: previewData.image || null,
        price: previewData.price || 0,
        marketCap: previewData.marketCap || 0,
        // Mark as preview so we know to refresh it
        isPreview: true,
      });
    } else {
      setTokenInfo(null);
    }

    setTokenMetadata(null);
    // Reset tracking state
    setPreviousBalances({});
    setInitialBalances({});
    // Force next fetch to be a full fetch
    forceFullFetchRef.current = true;
    console.log('[updateTokenMint] Cleared all data and set forceFullFetch flag');
  }, []);

  // Save current state as a project
  const saveCurrentProject = useCallback(() => {
    if (!tokenMint || !tokenInfo) return null;

    const project = saveProject({
      id: activeProjectId,
      tokenMint,
      tokenName: tokenInfo.name,
      tokenSymbol: tokenInfo.symbol,
      tokenImage: tokenInfo.image,
      marketCap: tokenInfo.marketCap,
      wallets,
    });

    if (project) {
      setActiveProjectId(project.id);
      setProjects(getProjects());
    }

    return project;
  }, [tokenMint, tokenInfo, wallets, activeProjectId]);

  // Load a saved project
  const loadProject = useCallback((project) => {
    // Clear API cache when switching projects
    clearCache();

    setActiveProjectId(project.id);
    setTokenMint(project.tokenMint);
    saveTokenMint(project.tokenMint);

    // Load project's wallets
    setWallets(project.wallets || []);
    saveWallets(project.wallets || []);

    // PRIORITY 1: Check new efficient data cache first (instant loading)
    const instantData = getInstantLoadData(project.tokenMint);

    if (instantData.hasData && instantData.walletData?.length > 0) {
      console.log('[loadProject] INSTANT LOAD from dataCache:', {
        wallets: instantData.walletData.length,
        transactions: instantData.transactions?.length || 0,
        hasTokenInfo: !!instantData.tokenInfo,
      });

      setWalletData(instantData.walletData);
      saveWalletData(instantData.walletData);

      if (instantData.transactions?.length > 0) {
        setTransactions(instantData.transactions);
        saveTransactions(instantData.transactions);
      }

      if (instantData.tokenInfo) {
        setTokenInfo(instantData.tokenInfo);
      }

      setLastUpdated(instantData.lastSync.balances);

      // Data is cached - just refresh stale data in background
      forceFullFetchRef.current = false;
    } else {
      // PRIORITY 2: Fallback to old project cache
      const cachedData = getProjectCachedData(project.id);

      if (cachedData?.walletData && cachedData.walletData.length > 0) {
        console.log('[loadProject] Using project cache for instant display');
        setWalletData(cachedData.walletData);
        saveWalletData(cachedData.walletData);

        // Also populate new data cache for future instant loads
        cacheWalletBalances(project.tokenMint, cachedData.walletData);

        if (cachedData.transactions) {
          setTransactions(cachedData.transactions);
          saveTransactions(cachedData.transactions);
          cacheTransactions(project.tokenMint, cachedData.transactions);
        }

        if (cachedData.initialBalances) {
          setInitialBalances(cachedData.initialBalances);
        }

        if (cachedData.lastScanned) {
          setLastUpdated(cachedData.lastScanned);
        }

        forceFullFetchRef.current = false;
      } else {
        // No cached data anywhere - force full fetch
        setWalletData([]);
        setTransactions([]);
        saveWalletData([]);
        saveTransactions([]);
        setPreviousBalances({});
        setInitialBalances({});
        forceFullFetchRef.current = true;
        console.log('[loadProject] No cached data, will do full fetch');
      }
    }

    // Use saved token info immediately for instant display
    if (instantData?.tokenInfo) {
      // Already set above
    } else if (project.tokenName || project.tokenSymbol || project.tokenImage) {
      console.log('[loadProject] Using saved token info for instant display');
      setTokenInfo({
        name: project.tokenName || 'Unknown Token',
        symbol: project.tokenSymbol || '???',
        image: project.tokenImage || null,
        price: 0, // Will be updated
        marketCap: project.marketCap || 0,
        isPreview: true, // Mark as preview so fresh data will merge
      });
    }

    setTokenMetadata(null);
  }, []);

  // Delete a project
  const deleteProject = useCallback((projectId) => {
    deleteProjectFromStorage(projectId);
    setProjects(getProjects());

    // If deleting active project, clear state
    if (projectId === activeProjectId) {
      setActiveProjectId(null);
    }
  }, [activeProjectId]);

  // Update settings
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Manual refresh (always does a full fetch)
  const manualRefresh = useCallback(() => {
    // Set force flag to ensure full transaction history is fetched
    forceFullFetchRef.current = true;
    console.log('[manualRefresh] Set forceFullFetch flag for complete refresh');
    fetchData(true);
  }, [fetchData]);

  // Deep fetch transactions for a specific wallet (to find source of funds)
  const deepFetchWalletHistory = useCallback(async (walletAddress) => {
    if (!tokenMint) return [];

    const connection = connectionRef.current;
    console.log(`[Deep Fetch] Starting deep history fetch for ${walletAddress}`);

    try {
      const deepTxs = await deepFetchWalletTransactions(connection, walletAddress, tokenMint);
      console.log(`[Deep Fetch] Found ${deepTxs.length} transactions for ${walletAddress}`);

      if (deepTxs.length > 0) {
        // Merge with existing transactions (avoiding duplicates)
        setTransactions(prev => {
          const existingSignatures = new Set(prev.map(tx => tx.signature));
          const newTxs = deepTxs.filter(tx => !existingSignatures.has(tx.signature));

          if (newTxs.length > 0) {
            const merged = [...prev, ...newTxs].sort((a, b) =>
              new Date(b.timestamp) - new Date(a.timestamp)
            );
            saveTransactions(merged);
            return merged;
          }
          return prev;
        });
      }

      return deepTxs;
    } catch (err) {
      console.error('[Deep Fetch] Error:', err);
      return [];
    }
  }, [tokenMint]);

  // Clear all data (but preserve settings like API key)
  const clearAll = useCallback(() => {
    clearCache(); // Clear API cache

    // Preserve settings before clearing
    const currentSettings = loadSettings();

    // Delete active project if there is one
    if (activeProjectId) {
      console.log('[clearAll] Deleting active project:', activeProjectId);
      deleteProjectFromStorage(activeProjectId);
    }

    // NEW: Clear data cache for current token
    if (tokenMint) {
      clearTokenCache(tokenMint);
      console.log('[clearAll] Cleared data cache for:', tokenMint.slice(0, 8) + '...');
    }

    // Clear ALL state
    setWallets([]);
    setTokenMint('');
    setWalletData([]);
    setTransactions([]);
    setTokenInfo(null);
    setTokenMetadata(null);
    setActiveProjectId(null);
    setPreviousBalances({});
    setInitialBalances({});
    setLastUpdated(null);
    setError(null);

    // Clear localStorage for wallet/token data but preserve projects and settings
    saveWallets([]);
    saveTokenMint('');
    saveWalletData([]);
    saveTransactions([]);

    // Restore settings
    if (currentSettings) {
      saveSettings(currentSettings);
    }

    // Refresh projects list
    setProjects(getProjects());

    // Force next fetch to be a full fetch
    forceFullFetchRef.current = true;
    console.log('[clearAll] Cleared all data and deleted active project');
  }, [activeProjectId, tokenMint]);

  // Computed values
  const totalHoldings = walletData.reduce((sum, w) => sum + (w.uiBalance || 0), 0);
  const tokenPrice = tokenInfo?.price || 0;
  const totalValue = totalHoldings * tokenPrice;

  return {
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
  };
}
