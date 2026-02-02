import { Connection, PublicKey } from '@solana/web3.js';

// Free public RPC endpoints that support browser CORS
// Ordered by reliability
const PUBLIC_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
];

const HELIUS_RPC_TEMPLATE = 'https://mainnet.helius-rpc.com/?api-key=';

// Current RPC index for fallback
let currentRpcIndex = 0;

// ============================================
// CACHING & DEDUPLICATION LAYER
// ============================================

// Cache configuration (TTL in milliseconds)
const CACHE_TTL = {
  tokenMetadata: 5 * 60 * 1000,  // 5 minutes - name, symbol, image rarely change
  tokenPrice: 30 * 1000,          // 30 seconds - prices update frequently
  walletBalance: 15 * 1000,       // 15 seconds - balances can change
};

// Helius API rate limiting configuration
const HELIUS_RATE_LIMIT = {
  minDelayMs: 2000,      // Minimum 2 seconds between batches
  maxDelayMs: 5000,      // Maximum 5 seconds between batches
  batchSize: 5,          // Process 5 wallets per batch
  txBatchSize: 3,        // Process 3 wallets for transactions per batch (heavier calls)
  txDelayMs: 3000,       // 3 seconds between transaction batches
};

// In-memory cache
const cache = new Map();

// In-flight request tracking (for deduplication)
const pendingRequests = new Map();

/**
 * Get cached data if still valid
 */
function getCached(key, ttl) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
}

/**
 * Set cache data
 */
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Deduplicated fetch - prevents duplicate in-flight requests
 * If a request for the same key is already pending, return that promise
 */
async function deduplicatedFetch(key, fetchFn) {
  // Check if request is already in flight
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Create new request promise
  const promise = fetchFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Clear all caches (useful when switching tokens)
 */
export function clearCache() {
  cache.clear();
  pendingRequests.clear();
}

/**
 * Validate a Solana address format
 */
function isValidAddress(address) {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Solana addresses are Base58 encoded, 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(trimmed);
}

/**
 * Create Solana connection with optional Helius API key
 * Falls back to free public RPCs if no API key provided
 */
export function createConnection(heliusApiKey = null) {
  if (heliusApiKey && heliusApiKey.trim() !== '') {
    console.log('[Connection] Using Helius RPC with API key');
    return new Connection(`${HELIUS_RPC_TEMPLATE}${heliusApiKey}`, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  // Fallback to public RPC - may have rate limits
  const rpcUrl = PUBLIC_RPCS[currentRpcIndex % PUBLIC_RPCS.length];
  console.log(`[Connection] No Helius API key - using public RPC: ${rpcUrl}`);
  console.warn('[Connection] ⚠️ Public RPCs have rate limits. For best results, add a Helius API key in Settings.');
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
 * Get token account balance for a specific token mint
 * With caching and deduplication
 */
export async function getTokenBalance(connection, walletAddress, tokenMint) {
  // Validate addresses first
  if (!isValidAddress(walletAddress)) {
    console.warn(`[getTokenBalance] Invalid wallet address: ${walletAddress}`);
    return {
      balance: 0,
      decimals: 9,
      uiBalance: 0,
      error: 'Invalid wallet address format',
    };
  }

  if (!isValidAddress(tokenMint)) {
    console.warn(`[getTokenBalance] Invalid token mint: ${tokenMint}`);
    return {
      balance: 0,
      decimals: 9,
      uiBalance: 0,
      error: 'Invalid token mint format',
    };
  }

  const cacheKey = `balance:${walletAddress}:${tokenMint}`;

  // Check cache
  const cached = getCached(cacheKey, CACHE_TTL.walletBalance);
  if (cached) {
    return cached;
  }

  // Deduplicated fetch
  return deduplicatedFetch(cacheKey, async () => {
    try {
      const walletPubkey = new PublicKey(walletAddress.trim());
      const mintPubkey = new PublicKey(tokenMint.trim());

      // Get all token accounts for this wallet
      console.log(`[getTokenBalance] Fetching balance for ${walletAddress.slice(0, 8)}...`);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { mint: mintPubkey }
      ).catch(err => {
        console.error(`[getTokenBalance] RPC Error for ${walletAddress.slice(0, 8)}...:`, err.message);
        throw err;
      });

      if (tokenAccounts.value.length === 0) {
        const result = {
          balance: 0,
          decimals: 9,
          uiBalance: 0,
        };
        setCache(cacheKey, result);
        return result;
      }

      // Sum all token accounts (usually just one)
      let totalBalance = 0;
      let decimals = 9;

      for (const account of tokenAccounts.value) {
        const info = account.account.data.parsed.info;
        totalBalance += Number(info.tokenAmount.amount);
        decimals = info.tokenAmount.decimals;
      }

      const result = {
        balance: totalBalance,
        decimals,
        uiBalance: totalBalance / Math.pow(10, decimals),
      };

      setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`[getTokenBalance] FAILED for ${walletAddress.slice(0, 8)}...:`, error.message);
      // Check if it's a rate limit error
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        console.warn('[getTokenBalance] Rate limited! Consider adding a Helius API key.');
      }
      return {
        balance: 0,
        decimals: 9,
        uiBalance: 0,
        error: error.message || 'RPC request failed',
      };
    }
  });
}

/**
 * Get token metadata (name, symbol, decimals)
 * Uses Solana token program
 */
export async function getTokenMetadata(connection, tokenMint) {
  if (!isValidAddress(tokenMint)) {
    console.warn(`[getTokenMetadata] Invalid token mint: ${tokenMint}`);
    return { decimals: 9, supply: '0', error: 'Invalid token mint format' };
  }

  try {
    const mintPubkey = new PublicKey(tokenMint.trim());
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

    if (!mintInfo.value) {
      throw new Error('Token mint not found');
    }

    const data = mintInfo.value.data;
    if (data.parsed) {
      return {
        decimals: data.parsed.info.decimals,
        supply: data.parsed.info.supply,
        mintAuthority: data.parsed.info.mintAuthority,
      };
    }

    return { decimals: 9, supply: '0' };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return { decimals: 9, supply: '0', error: error.message };
  }
}

/**
 * Get transaction signatures for a wallet (filtered by token)
 * OPTIMIZED: Uses parallel batched fetching for 5-10x speed improvement
 * INCREMENTAL: Can stop fetching when it reaches already-known transactions
 *
 * @param {Connection} connection - Solana connection
 * @param {string} walletAddress - Wallet address to fetch transactions for
 * @param {string} tokenMint - Token mint address to filter by
 * @param {number} targetCount - Target number of token transactions to find
 * @param {number} maxPages - Maximum pages to fetch (each page = 50 signatures)
 * @param {boolean} deepFetch - If true, keep fetching until no more signatures found
 * @param {string} sinceTimestamp - ISO timestamp; stop when reaching txs older than this
 * @param {Set} knownSignatures - Set of already-known tx signatures to skip
 */
export async function getWalletTransactions(
  connection,
  walletAddress,
  tokenMint,
  targetCount = 15,
  maxPages = 3,
  deepFetch = false,
  sinceTimestamp = null,
  knownSignatures = null
) {
  // Validate addresses
  if (!isValidAddress(walletAddress) || !isValidAddress(tokenMint)) {
    console.warn(`[getWalletTransactions] Invalid address - wallet: ${walletAddress}, mint: ${tokenMint}`);
    return [];
  }

  // DEBUG: Log fetch start
  console.log(`[DEBUG] Fetching txs for wallet: ${walletAddress.slice(0, 8)}... token: ${tokenMint.slice(0, 8)}... (maxPages: ${maxPages}, targetCount: ${targetCount})`);

  try {
    const walletPubkey = new PublicKey(walletAddress.trim());
    const transactions = [];
    let lastSignature = null;
    let pagesSearched = 0;
    let reachedKnownData = false;
    let totalSignaturesChecked = 0;
    let totalTxsFetched = 0;
    let totalTxsFailed = 0;
    const SIGS_PER_PAGE = 100; // Increased for speed
    const PARALLEL_BATCH_SIZE = 15; // More parallel requests

    // Convert sinceTimestamp to Date for comparison
    const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : null;

    // Keep fetching pages until we have enough token transactions or hit limits
    while ((pagesSearched < maxPages || deepFetch) && !reachedKnownData) {
      // Fetch a page of signatures
      const options = { limit: SIGS_PER_PAGE };
      if (lastSignature) {
        options.before = lastSignature;
      }

      const signatures = await connection.getSignaturesForAddress(walletPubkey, options);

      if (signatures.length === 0) {
        console.log(`[DEBUG] No more signatures for wallet ${walletAddress.slice(0, 8)}... (page ${pagesSearched})`);
        break;
      }

      totalSignaturesChecked += signatures.length;
      pagesSearched++;

      // OPTIMIZATION: Check if we've reached known data before fetching tx details
      // This saves RPC calls when doing incremental updates
      if (sinceDate) {
        const oldestSigTime = signatures[signatures.length - 1].blockTime;
        if (oldestSigTime && new Date(oldestSigTime * 1000) < sinceDate) {
          // Filter signatures to only those after sinceDate
          const newSigs = signatures.filter(sig =>
            sig.blockTime && new Date(sig.blockTime * 1000) >= sinceDate
          );

          if (newSigs.length === 0) {
            // All signatures are old, we're done
            reachedKnownData = true;
            break;
          }

          // Only process new signatures
          signatures.length = 0;
          signatures.push(...newSigs);
          reachedKnownData = true; // Mark to stop after this batch
        }
      }

      // OPTIMIZATION: Fetch transactions in parallel batches instead of sequentially
      for (let i = 0; i < signatures.length; i += PARALLEL_BATCH_SIZE) {
        const batch = signatures.slice(i, i + PARALLEL_BATCH_SIZE);

        // Skip signatures we already know about
        const filteredBatch = knownSignatures
          ? batch.filter(sig => !knownSignatures.has(sig.signature))
          : batch;

        if (filteredBatch.length === 0) continue;

        // Fetch batch in parallel
        const txPromises = filteredBatch.map(sig =>
          connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          }).catch((err) => {
            totalTxsFailed++;
            return null;
          })
        );

        const txResults = await Promise.all(txPromises);

        // Process results
        for (let j = 0; j < txResults.length; j++) {
          const tx = txResults[j];
          if (!tx) continue;

          totalTxsFetched++;
          const sig = filteredBatch[j];
          const tokenTransfer = parseTokenTransfer(tx, walletAddress, tokenMint);

          if (tokenTransfer) {
            const txTimestamp = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null;

            transactions.push({
              signature: sig.signature,
              timestamp: txTimestamp,
              walletAddress,
              ...tokenTransfer,
            });

            // Early exit if we have enough (and not deep fetching)
            if (!deepFetch && transactions.length >= targetCount) {
              console.log(`[DEBUG] Wallet ${walletAddress.slice(0, 8)}... - Found ${transactions.length} token txs (checked ${totalSignaturesChecked} sigs, fetched ${totalTxsFetched} txs, ${totalTxsFailed} failed)`);
              return transactions;
            }
          }
        }
      }

      // Update last signature for pagination
      lastSignature = signatures[signatures.length - 1].signature;

      // Safety limit for deep fetch
      if (deepFetch && pagesSearched >= 15) {
        break;
      }

      // Check if we should continue
      if (!deepFetch && pagesSearched >= maxPages) {
        break;
      }
    }

    // DEBUG: Final summary for this wallet
    console.log(`[DEBUG] Wallet ${walletAddress.slice(0, 8)}... COMPLETE - Found ${transactions.length} token txs | Checked ${totalSignaturesChecked} sigs | Fetched ${totalTxsFetched} txs | ${totalTxsFailed} RPC failures | ${pagesSearched} pages`);

    return transactions;
  } catch (error) {
    console.error(`[DEBUG] ERROR fetching transactions for ${walletAddress.slice(0, 8)}...:`, error.message);
    return [];
  }
}

/**
 * Deep fetch all token transactions for a wallet
 * Used when we need to find the full history of how tokens were acquired
 */
export async function deepFetchWalletTransactions(connection, walletAddress, tokenMint) {
  return getWalletTransactions(connection, walletAddress, tokenMint, 100, 20, true);
}

/**
 * Parse a transaction for token transfers
 * Distinguishes between: BUY, SELL (swap), TRANSFER_OUT, TRANSFER_IN
 *
 * Detection logic:
 * - BUY: Tokens increased + SOL decreased significantly (swap on DEX)
 * - SELL: Tokens decreased + SOL increased significantly (swap on DEX)
 * - TRANSFER_OUT: Tokens decreased + SOL stayed same or decreased slightly (just tx fee)
 * - TRANSFER_IN: Tokens increased + SOL stayed same or increased (received tokens)
 */
function parseTokenTransfer(tx, walletAddress, tokenMint) {
  try {
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    // DEBUG: Check if tx has any token balances at all
    if (preTokenBalances.length === 0 && postTokenBalances.length === 0) {
      // No token activity in this tx - this is normal for SOL-only txs
      return null;
    }

    // Normalize addresses for comparison (Solana addresses are Base58, case-sensitive)
    // But we use toLowerCase for map keys to handle any inconsistencies
    const walletNormalized = walletAddress.trim();
    const mintNormalized = tokenMint.trim();

    let preAmount = 0;
    let postAmount = 0;
    let decimals = 9;
    let foundWallet = false;
    let foundMint = false;

    // Track all wallets involved in this token transfer
    const walletChanges = new Map();

    // Process pre-balances
    for (const bal of preTokenBalances) {
      // Compare mint addresses (case-insensitive for safety)
      if (bal.mint && bal.mint.toLowerCase() === mintNormalized.toLowerCase() && bal.owner) {
        foundMint = true;
        const ownerKey = bal.owner.toLowerCase();
        const amount = Number(bal.uiTokenAmount?.amount || 0);
        walletChanges.set(ownerKey, {
          pre: amount,
          post: walletChanges.get(ownerKey)?.post || 0,
          decimals: bal.uiTokenAmount?.decimals || 9,
          address: bal.owner, // Keep original case
        });

        // Check if this is our wallet
        if (bal.owner.toLowerCase() === walletNormalized.toLowerCase()) {
          preAmount = amount;
          decimals = bal.uiTokenAmount?.decimals || 9;
          foundWallet = true;
        }
      }
    }

    // Process post-balances
    for (const bal of postTokenBalances) {
      if (bal.mint && bal.mint.toLowerCase() === mintNormalized.toLowerCase() && bal.owner) {
        foundMint = true;
        const ownerKey = bal.owner.toLowerCase();
        const amount = Number(bal.uiTokenAmount?.amount || 0);
        const existing = walletChanges.get(ownerKey) || { pre: 0, decimals: 9, address: bal.owner };
        walletChanges.set(ownerKey, {
          ...existing,
          post: amount,
        });

        if (bal.owner.toLowerCase() === walletNormalized.toLowerCase()) {
          postAmount = amount;
          decimals = bal.uiTokenAmount?.decimals || 9;
          foundWallet = true;
        }
      }
    }

    // If this token wasn't involved in this transaction at all, skip
    if (!foundMint) {
      return null;
    }

    const tokenChange = postAmount - preAmount;

    // No change in token balance for this wallet
    if (tokenChange === 0) return null;

    // Check SOL balance change to detect swaps vs transfers
    let solChange = 0;
    const accountKeys = tx.transaction?.message?.accountKeys || [];
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];

    // Find our wallet's index in the account keys
    for (let i = 0; i < accountKeys.length; i++) {
      // Handle both parsed and unparsed account key formats
      let keyStr = '';
      if (accountKeys[i]?.pubkey) {
        keyStr = accountKeys[i].pubkey.toString();
      } else if (typeof accountKeys[i] === 'string') {
        keyStr = accountKeys[i];
      } else if (accountKeys[i]?.toString) {
        keyStr = accountKeys[i].toString();
      }

      if (keyStr && keyStr.toLowerCase() === walletNormalized.toLowerCase()) {
        const preSol = preBalances[i] || 0;
        const postSol = postBalances[i] || 0;
        solChange = postSol - preSol;
        break;
      }
    }

    // Convert SOL change from lamports to SOL (1 SOL = 1e9 lamports)
    const solChangeInSol = solChange / 1e9;

    // Determine transaction type
    let type;
    let toWallet = null;
    let fromWallet = null;

    if (tokenChange < 0) {
      // Tokens DECREASED (outgoing)
      // Find destination wallet (the one that received tokens)
      for (const [ownerKey, data] of walletChanges) {
        if (ownerKey !== walletNormalized.toLowerCase()) {
          const walletTokenChange = data.post - data.pre;
          if (walletTokenChange > 0) {
            toWallet = data.address;
            break;
          }
        }
      }

      // Check if this is a SELL (swap) or TRANSFER_OUT
      // SELL: SOL increased significantly (received payment from DEX)
      // TRANSFER_OUT: SOL didn't increase (just tx fee deducted, ~0.000005 SOL)
      // Threshold: 0.001 SOL to account for fee variations
      if (solChangeInSol > 0.001) {
        type = 'SELL';
      } else {
        type = 'TRANSFER_OUT';
      }
    } else {
      // Tokens INCREASED (incoming)
      // Find source wallet (the one that sent tokens)
      for (const [ownerKey, data] of walletChanges) {
        if (ownerKey !== walletNormalized.toLowerCase()) {
          const walletTokenChange = data.post - data.pre;
          if (walletTokenChange < 0) {
            fromWallet = data.address;
            break;
          }
        }
      }

      // Check if this is a BUY (swap) or TRANSFER_IN
      // BUY: SOL decreased significantly (paid DEX for tokens)
      // TRANSFER_IN: SOL didn't decrease much (received tokens for free, or tiny fee)
      // Threshold: -0.01 SOL (use larger threshold since buys usually cost more than 0.01 SOL)
      if (solChangeInSol < -0.01) {
        type = 'BUY';
      } else {
        type = 'TRANSFER_IN';
      }
    }

    // DEBUG: Log transfer details
    const amount = Math.abs(tokenChange) / Math.pow(10, decimals);
    if (type === 'TRANSFER_OUT' || type === 'TRANSFER_IN') {
      console.log(`[parseTokenTransfer] ${type}: ${amount.toFixed(4)} tokens | SOL change: ${solChangeInSol.toFixed(6)} | To: ${toWallet?.slice(0, 8) || 'N/A'}... | From: ${fromWallet?.slice(0, 8) || 'N/A'}...`);
    }

    return {
      type,
      amount,
      rawAmount: Math.abs(tokenChange),
      decimals,
      toWallet,      // Destination wallet for outgoing transfers
      fromWallet,    // Source wallet for incoming transfers
      solChange: solChangeInSol, // For debugging/display
    };
  } catch (error) {
    console.error('[parseTokenTransfer] Error:', error);
    return null;
  }
}

/**
 * Internal: Fetch raw data from DexScreener
 */
async function fetchDexScreenerData(tokenMint) {
  const cacheKey = `dexscreener:${tokenMint}`;

  // Check cache first (short TTL since this has price data)
  const cached = getCached(cacheKey, CACHE_TTL.tokenPrice);
  if (cached) {
    return cached;
  }

  // Deduplicated fetch
  return deduplicatedFetch(cacheKey, async () => {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`
    );
    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      // Get the pair with highest liquidity
      const bestPair = data.pairs.sort((a, b) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      setCache(cacheKey, bestPair);
      return bestPair;
    }

    return null;
  });
}

/**
 * Fetch full token info from DexScreener API (free, no auth required)
 * Uses caching: metadata cached for 5min, price data for 30sec
 */
export async function getTokenInfo(tokenMint) {
  try {
    // Check metadata cache first (long TTL)
    const metadataCacheKey = `metadata:${tokenMint}`;
    const cachedMetadata = getCached(metadataCacheKey, CACHE_TTL.tokenMetadata);

    // Fetch fresh data for price (or full data if no metadata cached)
    const bestPair = await fetchDexScreenerData(tokenMint);

    if (!bestPair) {
      return {
        name: 'Unknown Token',
        symbol: '???',
        address: tokenMint,
        price: 0,
        marketCap: 0,
        image: null,
        source: null,
      };
    }

    const baseToken = bestPair.baseToken;

    // Build result - use cached metadata if available
    const result = {
      // Basic info (from cache or fresh)
      name: cachedMetadata?.name || baseToken?.name || 'Unknown',
      symbol: cachedMetadata?.symbol || baseToken?.symbol || '???',
      address: tokenMint,
      image: cachedMetadata?.image || bestPair.info?.imageUrl || null,

      // Price data (always fresh)
      price: Number(bestPair.priceUsd) || 0,
      priceChange24h: Number(bestPair.priceChange?.h24) || 0,

      // Market data (always fresh)
      marketCap: Number(bestPair.marketCap) || 0,
      fdv: Number(bestPair.fdv) || 0,
      liquidity: Number(bestPair.liquidity?.usd) || 0,
      volume24h: Number(bestPair.volume?.h24) || 0,

      // Additional info
      pairAddress: bestPair.pairAddress,
      dexId: bestPair.dexId,
      url: bestPair.url,

      // Metadata
      source: 'DexScreener',
      lastUpdated: new Date().toISOString(),
    };

    // Cache the metadata separately (long TTL)
    if (!cachedMetadata) {
      setCache(metadataCacheKey, {
        name: result.name,
        symbol: result.symbol,
        image: result.image,
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching token info:', error);
    return {
      name: 'Error',
      symbol: '???',
      address: tokenMint,
      price: 0,
      marketCap: 0,
      image: null,
      error: error.message,
    };
  }
}

/**
 * Fetch ONLY price data (faster, uses same cache)
 * Use this for frequent price updates
 */
export async function getTokenPriceOnly(tokenMint) {
  try {
    const bestPair = await fetchDexScreenerData(tokenMint);

    if (!bestPair) {
      return { price: 0, priceChange24h: 0 };
    }

    return {
      price: Number(bestPair.priceUsd) || 0,
      priceChange24h: Number(bestPair.priceChange?.h24) || 0,
      marketCap: Number(bestPair.marketCap) || 0,
      volume24h: Number(bestPair.volume?.h24) || 0,
    };
  } catch (error) {
    console.error('Error fetching token price:', error);
    return { price: 0, priceChange24h: 0, error: error.message };
  }
}

/**
 * Fetch token price (simplified version for quick price checks)
 */
export async function getTokenPrice(tokenMint) {
  const info = await getTokenInfo(tokenMint);
  return {
    price: info.price,
    priceChange24h: info.priceChange24h,
    volume24h: info.volume24h,
    source: info.source,
  };
}

/**
 * Rate-limited delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch balances using Helius DAS API (much faster - single call for all wallets)
 */
async function fetchBalancesHeliusDAS(apiKey, wallets, tokenMint) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  // Helius DAS: getAssetsByOwner for each wallet (can batch these)
  const results = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: wallet.address,
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: wallet.address,
              page: 1,
              limit: 100,
              displayOptions: { showFungible: true },
            },
          }),
        });

        const data = await response.json();
        const assets = data.result?.items || [];

        // Find the token we're looking for
        const tokenAsset = assets.find(a =>
          a.id?.toLowerCase() === tokenMint.toLowerCase() ||
          a.token_info?.mint?.toLowerCase() === tokenMint.toLowerCase()
        );

        if (tokenAsset) {
          const balance = tokenAsset.token_info?.balance || 0;
          const decimals = tokenAsset.token_info?.decimals || 9;
          return {
            ...wallet,
            balance,
            decimals,
            uiBalance: balance / Math.pow(10, decimals),
            lastUpdated: new Date().toISOString(),
          };
        }

        return {
          ...wallet,
          balance: 0,
          decimals: 9,
          uiBalance: 0,
          lastUpdated: new Date().toISOString(),
        };
      } catch (error) {
        console.error(`[Helius DAS] Error for ${wallet.address.slice(0, 8)}...:`, error.message);
        return {
          ...wallet,
          balance: 0,
          uiBalance: 0,
          error: error.message,
          lastUpdated: new Date().toISOString(),
        };
      }
    })
  );

  return results;
}

/**
 * Batch fetch balances for multiple wallets
 * Uses Helius DAS API if available (faster), falls back to RPC
 * OPTIMIZED: Respects Helius rate limits (2-5 sec between batches)
 *
 * @param {boolean} hasApiKey - If true, use Helius DAS API
 * @param {string} apiKey - Helius API key for DAS endpoint
 * @param {Function} onProgress - Optional callback for progress updates
 */
export async function batchGetBalances(connection, wallets, tokenMint, hasApiKey = false, apiKey = null, onProgress = null) {
  const BATCH_SIZE = hasApiKey ? HELIUS_RATE_LIMIT.batchSize : 3;
  const BATCH_DELAY = hasApiKey ? HELIUS_RATE_LIMIT.minDelayMs : 500;

  console.log(`[batchGetBalances] Starting fetch for ${wallets.length} wallets (batch size: ${BATCH_SIZE}, delay: ${BATCH_DELAY}ms)`);

  const results = [];
  let completedCount = 0;

  // Process in batches to respect Helius rate limits
  for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
    const batch = wallets.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(wallets.length / BATCH_SIZE);

    console.log(`[batchGetBalances] Processing batch ${batchNumber}/${totalBatches} (${batch.length} wallets)`);

    let batchResults;

    if (hasApiKey && apiKey) {
      // Use Helius DAS API for this batch
      batchResults = await fetchBalancesBatchHelius(apiKey, batch, tokenMint);
    } else {
      // Use standard RPC
      batchResults = await Promise.allSettled(
        batch.map(wallet => getTokenBalance(connection, wallet.address, tokenMint))
      );
      batchResults = batchResults.map((result, idx) => {
        if (result.status === 'fulfilled') {
          return { ...batch[idx], ...result.value, id: batch[idx].address, lastUpdated: new Date().toISOString() };
        }
        return { ...batch[idx], id: batch[idx].address, balance: 0, uiBalance: 0, error: result.reason?.message, lastUpdated: new Date().toISOString() };
      });
    }

    results.push(...batchResults);
    completedCount += batch.length;

    // Report progress
    if (onProgress) {
      onProgress({
        completed: completedCount,
        total: wallets.length,
        percent: Math.round((completedCount / wallets.length) * 100),
      });
    }

    // Add delay between batches (except for last batch) to respect rate limits
    if (i + BATCH_SIZE < wallets.length) {
      console.log(`[batchGetBalances] Rate limit pause: ${BATCH_DELAY}ms before next batch`);
      await delay(BATCH_DELAY);
    }
  }

  console.log(`[batchGetBalances] Completed: ${results.length} wallets processed`);
  return results;
}

/**
 * Fetch balances for a batch using Helius DAS API
 * Single batch - called by batchGetBalances
 */
async function fetchBalancesBatchHelius(apiKey, wallets, tokenMint) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  const results = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: wallet.address,
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: wallet.address,
              page: 1,
              limit: 100,
              displayOptions: { showFungible: true },
            },
          }),
        });

        const data = await response.json();
        const assets = data.result?.items || [];

        // Find the token we're looking for
        const tokenAsset = assets.find(a =>
          a.id?.toLowerCase() === tokenMint.toLowerCase() ||
          a.token_info?.mint?.toLowerCase() === tokenMint.toLowerCase()
        );

        if (tokenAsset) {
          const balance = tokenAsset.token_info?.balance || 0;
          const decimals = tokenAsset.token_info?.decimals || 9;
          return {
            ...wallet,
            id: wallet.address,
            balance,
            decimals,
            uiBalance: balance / Math.pow(10, decimals),
            lastUpdated: new Date().toISOString(),
          };
        }

        return {
          ...wallet,
          id: wallet.address,
          balance: 0,
          decimals: 9,
          uiBalance: 0,
          lastUpdated: new Date().toISOString(),
        };
      } catch (error) {
        console.error(`[Helius] Error for ${wallet.address.slice(0, 8)}...:`, error.message);
        return {
          ...wallet,
          id: wallet.address,
          balance: 0,
          uiBalance: 0,
          error: error.message,
          lastUpdated: new Date().toISOString(),
        };
      }
    })
  );

  return results;
}

