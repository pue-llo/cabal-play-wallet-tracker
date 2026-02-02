/**
 * DataCache Service
 * Efficient data persistence and incremental sync system
 *
 * Architecture:
 * - Instant load: Show cached data immediately
 * - Smart sync: Only fetch new/changed data
 * - Background updates: Progressive updates as data comes in
 * - API agnostic: Ready for custom validator/API in future
 */

const CACHE_KEYS = {
  WALLET_BALANCES: 'cwt_cache_balances',      // Per-wallet balance data
  TRANSACTIONS: 'cwt_cache_transactions',      // All transaction history
  TOKEN_METADATA: 'cwt_cache_token_meta',      // Token info (name, symbol, image)
  TOKEN_PRICES: 'cwt_cache_token_prices',      // Price history
  SYNC_STATE: 'cwt_cache_sync_state',          // Last sync timestamps
};

// Cache duration settings (in milliseconds)
const CACHE_TTL = {
  TOKEN_METADATA: 24 * 60 * 60 * 1000,  // 24 hours - rarely changes
  TOKEN_PRICE: 60 * 1000,                // 1 minute - changes frequently
  WALLET_BALANCE: 2 * 60 * 1000,         // 2 minutes - moderate refresh
  TRANSACTIONS: 30 * 1000,               // 30 seconds - for new txs
};

/**
 * ============================================
 * SYNC STATE MANAGEMENT
 * Tracks when each data type was last synced
 * ============================================
 */
function getSyncState() {
  try {
    const data = localStorage.getItem(CACHE_KEYS.SYNC_STATE);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function updateSyncState(tokenMint, dataType, timestamp = new Date().toISOString()) {
  try {
    const state = getSyncState();
    if (!state[tokenMint]) state[tokenMint] = {};
    state[tokenMint][dataType] = timestamp;
    localStorage.setItem(CACHE_KEYS.SYNC_STATE, JSON.stringify(state));
  } catch (error) {
    console.error('[DataCache] Failed to update sync state:', error);
  }
}

function getLastSyncTime(tokenMint, dataType) {
  const state = getSyncState();
  return state[tokenMint]?.[dataType] || null;
}

/**
 * Check if cached data is stale
 */
function isStale(lastSync, ttl) {
  if (!lastSync) return true;
  const age = Date.now() - new Date(lastSync).getTime();
  return age > ttl;
}

/**
 * ============================================
 * WALLET BALANCE CACHE
 * Stores per-wallet balances with timestamps
 * ============================================
 */
function getBalanceCache() {
  try {
    const data = localStorage.getItem(CACHE_KEYS.WALLET_BALANCES);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveBalanceCache(cache) {
  try {
    localStorage.setItem(CACHE_KEYS.WALLET_BALANCES, JSON.stringify(cache));
  } catch (error) {
    console.error('[DataCache] Failed to save balance cache:', error);
  }
}

/**
 * Get cached balances for a token
 * Returns: { wallets: [...], lastSync, hasData }
 */
export function getCachedBalances(tokenMint) {
  const cache = getBalanceCache();
  const tokenCache = cache[tokenMint];

  if (!tokenCache || !tokenCache.wallets) {
    return { wallets: [], lastSync: null, hasData: false };
  }

  return {
    wallets: tokenCache.wallets,
    lastSync: tokenCache.lastSync,
    hasData: tokenCache.wallets.length > 0,
    isStale: isStale(tokenCache.lastSync, CACHE_TTL.WALLET_BALANCE),
  };
}

/**
 * Save wallet balances to cache
 * Merges with existing data, preserving history
 */
export function cacheWalletBalances(tokenMint, walletData) {
  const cache = getBalanceCache();
  const now = new Date().toISOString();

  // Get existing cache for this token
  const existing = cache[tokenMint]?.wallets || [];
  const existingMap = new Map(existing.map(w => [w.address, w]));

  // Merge new data with existing (new data takes priority)
  walletData.forEach(wallet => {
    const prev = existingMap.get(wallet.address);
    existingMap.set(wallet.address, {
      ...wallet,
      previousBalance: prev?.uiBalance,
      balanceHistory: [
        ...(prev?.balanceHistory || []).slice(-9), // Keep last 10
        { balance: wallet.uiBalance, timestamp: now }
      ],
      firstSeen: prev?.firstSeen || now,
      lastUpdated: now,
    });
  });

  cache[tokenMint] = {
    wallets: Array.from(existingMap.values()),
    lastSync: now,
  };

  saveBalanceCache(cache);
  updateSyncState(tokenMint, 'balances', now);

  console.log(`[DataCache] Cached ${walletData.length} wallet balances for ${tokenMint.slice(0, 8)}...`);
  return cache[tokenMint].wallets;
}

/**
 * Get wallets that need balance refresh (stale data)
 */
export function getStaleWallets(tokenMint, allWallets, maxAge = CACHE_TTL.WALLET_BALANCE) {
  const cached = getCachedBalances(tokenMint);
  const cachedMap = new Map(cached.wallets.map(w => [w.address, w]));
  const now = Date.now();

  return allWallets.filter(wallet => {
    const cachedWallet = cachedMap.get(wallet.address);
    if (!cachedWallet) return true; // Not cached, needs fetch

    const age = now - new Date(cachedWallet.lastUpdated).getTime();
    return age > maxAge; // Stale, needs refresh
  });
}

/**
 * ============================================
 * TRANSACTION CACHE
 * Stores all transactions with deduplication
 * ============================================
 */
function getTransactionCache() {
  try {
    const data = localStorage.getItem(CACHE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveTransactionCache(cache) {
  try {
    localStorage.setItem(CACHE_KEYS.TRANSACTIONS, JSON.stringify(cache));
  } catch (error) {
    console.error('[DataCache] Failed to save transaction cache:', error);
  }
}

/**
 * Get cached transactions for a token
 */
export function getCachedTransactions(tokenMint) {
  const cache = getTransactionCache();
  const tokenCache = cache[tokenMint];

  if (!tokenCache) {
    return { transactions: [], lastSync: null, hasData: false };
  }

  return {
    transactions: tokenCache.transactions || [],
    lastSync: tokenCache.lastSync,
    hasData: (tokenCache.transactions?.length || 0) > 0,
    newestSignature: tokenCache.newestSignature,
    oldestSignature: tokenCache.oldestSignature,
  };
}

/**
 * Cache new transactions (merges with existing, deduplicates)
 * Returns: { added: number, total: number }
 */
export function cacheTransactions(tokenMint, newTransactions) {
  const cache = getTransactionCache();
  const now = new Date().toISOString();

  // Get existing transactions
  const existing = cache[tokenMint]?.transactions || [];
  const existingSignatures = new Set(existing.map(tx => tx.signature));

  // Filter out duplicates
  const uniqueNew = newTransactions.filter(tx => !existingSignatures.has(tx.signature));

  // Merge and sort by timestamp (newest first)
  const merged = [...uniqueNew, ...existing].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Find newest and oldest signatures for incremental fetching
  const newestSignature = merged[0]?.signature || null;
  const oldestSignature = merged[merged.length - 1]?.signature || null;

  cache[tokenMint] = {
    transactions: merged,
    lastSync: now,
    newestSignature,
    oldestSignature,
  };

  saveTransactionCache(cache);
  updateSyncState(tokenMint, 'transactions', now);

  console.log(`[DataCache] Cached ${uniqueNew.length} new transactions (total: ${merged.length}) for ${tokenMint.slice(0, 8)}...`);

  return { added: uniqueNew.length, total: merged.length };
}

/**
 * Get the newest transaction timestamp for incremental fetching
 */
export function getNewestTransactionTime(tokenMint) {
  const cached = getCachedTransactions(tokenMint);
  if (!cached.hasData) return null;

  // Return the timestamp of the newest transaction
  return cached.transactions[0]?.timestamp || null;
}

/**
 * ============================================
 * TOKEN METADATA CACHE
 * Stores token info (name, symbol, image, etc.)
 * ============================================
 */
function getTokenMetadataCache() {
  try {
    const data = localStorage.getItem(CACHE_KEYS.TOKEN_METADATA);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveTokenMetadataCache(cache) {
  try {
    localStorage.setItem(CACHE_KEYS.TOKEN_METADATA, JSON.stringify(cache));
  } catch (error) {
    console.error('[DataCache] Failed to save token metadata cache:', error);
  }
}

/**
 * Get cached token metadata
 */
export function getCachedTokenMetadata(tokenMint) {
  const cache = getTokenMetadataCache();
  const tokenCache = cache[tokenMint];

  if (!tokenCache) {
    return { metadata: null, hasData: false };
  }

  return {
    metadata: tokenCache.metadata,
    lastSync: tokenCache.lastSync,
    hasData: !!tokenCache.metadata,
    isStale: isStale(tokenCache.lastSync, CACHE_TTL.TOKEN_METADATA),
  };
}

/**
 * Cache token metadata
 */
export function cacheTokenMetadata(tokenMint, metadata) {
  const cache = getTokenMetadataCache();
  const now = new Date().toISOString();

  cache[tokenMint] = {
    metadata: {
      ...metadata,
      cachedAt: now,
    },
    lastSync: now,
  };

  saveTokenMetadataCache(cache);
  console.log(`[DataCache] Cached metadata for ${metadata.name || tokenMint.slice(0, 8)}...`);
}

/**
 * ============================================
 * TOKEN PRICE CACHE
 * Stores price history for charting
 * ============================================
 */
function getTokenPriceCache() {
  try {
    const data = localStorage.getItem(CACHE_KEYS.TOKEN_PRICES);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveTokenPriceCache(cache) {
  try {
    localStorage.setItem(CACHE_KEYS.TOKEN_PRICES, JSON.stringify(cache));
  } catch (error) {
    console.error('[DataCache] Failed to save token price cache:', error);
  }
}

/**
 * Get cached token price
 */
export function getCachedTokenPrice(tokenMint) {
  const cache = getTokenPriceCache();
  const tokenCache = cache[tokenMint];

  if (!tokenCache) {
    return { price: null, hasData: false };
  }

  return {
    price: tokenCache.currentPrice,
    priceHistory: tokenCache.priceHistory || [],
    lastSync: tokenCache.lastSync,
    hasData: tokenCache.currentPrice !== null,
    isStale: isStale(tokenCache.lastSync, CACHE_TTL.TOKEN_PRICE),
  };
}

/**
 * Cache token price (with history)
 */
export function cacheTokenPrice(tokenMint, price, priceChange24h = 0) {
  const cache = getTokenPriceCache();
  const now = new Date().toISOString();

  const existing = cache[tokenMint] || { priceHistory: [] };

  cache[tokenMint] = {
    currentPrice: price,
    priceChange24h,
    priceHistory: [
      ...existing.priceHistory.slice(-99), // Keep last 100 prices
      { price, timestamp: now }
    ],
    lastSync: now,
  };

  saveTokenPriceCache(cache);
}

/**
 * ============================================
 * UNIFIED CACHE INTERFACE
 * High-level functions for the app to use
 * ============================================
 */

/**
 * Get all cached data for instant loading
 * Call this on app start to immediately show cached data
 */
export function getInstantLoadData(tokenMint) {
  const balances = getCachedBalances(tokenMint);
  const transactions = getCachedTransactions(tokenMint);
  const metadata = getCachedTokenMetadata(tokenMint);
  const price = getCachedTokenPrice(tokenMint);

  return {
    hasData: balances.hasData || transactions.hasData || metadata.hasData,
    walletData: balances.wallets,
    transactions: transactions.transactions,
    tokenInfo: metadata.metadata ? {
      ...metadata.metadata,
      price: price.price,
      priceChange24h: price.priceHistory?.[0]?.priceChange24h,
    } : null,
    lastSync: {
      balances: balances.lastSync,
      transactions: transactions.lastSync,
      metadata: metadata.lastSync,
      price: price.lastSync,
    },
    staleness: {
      balances: balances.isStale,
      transactions: isStale(transactions.lastSync, CACHE_TTL.TRANSACTIONS),
      metadata: metadata.isStale,
      price: price.isStale,
    },
  };
}

/**
 * Determine what needs to be synced (smart refresh)
 */
export function getSyncNeeds(tokenMint, wallets = []) {
  const balances = getCachedBalances(tokenMint);
  const transactions = getCachedTransactions(tokenMint);
  const metadata = getCachedTokenMetadata(tokenMint);
  const price = getCachedTokenPrice(tokenMint);

  // Get stale wallets that need refresh
  const staleWallets = getStaleWallets(tokenMint, wallets);

  return {
    needsMetadata: !metadata.hasData || metadata.isStale,
    needsPrice: !price.hasData || price.isStale,
    needsBalances: staleWallets.length > 0,
    staleWallets,
    freshWallets: wallets.filter(w => !staleWallets.find(s => s.address === w.address)),
    needsTransactions: isStale(transactions.lastSync, CACHE_TTL.TRANSACTIONS),
    newestTxTime: getNewestTransactionTime(tokenMint),
  };
}

/**
 * Clear all cached data for a token
 */
export function clearTokenCache(tokenMint) {
  // Clear balances
  const balanceCache = getBalanceCache();
  delete balanceCache[tokenMint];
  saveBalanceCache(balanceCache);

  // Clear transactions
  const txCache = getTransactionCache();
  delete txCache[tokenMint];
  saveTransactionCache(txCache);

  // Clear metadata
  const metaCache = getTokenMetadataCache();
  delete metaCache[tokenMint];
  saveTokenMetadataCache(metaCache);

  // Clear prices
  const priceCache = getTokenPriceCache();
  delete priceCache[tokenMint];
  saveTokenPriceCache(priceCache);

  // Clear sync state
  const syncState = getSyncState();
  delete syncState[tokenMint];
  localStorage.setItem(CACHE_KEYS.SYNC_STATE, JSON.stringify(syncState));

  console.log(`[DataCache] Cleared all cache for ${tokenMint.slice(0, 8)}...`);
}

/**
 * Clear all cached data
 */
export function clearAllCache() {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('[DataCache] All cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const balances = getBalanceCache();
  const transactions = getTransactionCache();
  const metadata = getTokenMetadataCache();
  const prices = getTokenPriceCache();

  const tokenCount = new Set([
    ...Object.keys(balances),
    ...Object.keys(transactions),
    ...Object.keys(metadata),
    ...Object.keys(prices),
  ]).size;

  let totalWallets = 0;
  let totalTransactions = 0;

  Object.values(balances).forEach(b => {
    totalWallets += b.wallets?.length || 0;
  });

  Object.values(transactions).forEach(t => {
    totalTransactions += t.transactions?.length || 0;
  });

  return {
    tokenCount,
    totalWallets,
    totalTransactions,
    storageUsed: JSON.stringify({ balances, transactions, metadata, prices }).length,
  };
}

// Export cache TTL for external use
export const CACHE_DURATIONS = CACHE_TTL;
