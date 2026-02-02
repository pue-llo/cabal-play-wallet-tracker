import { useState, useEffect } from 'react';
import {
  Coins,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Save,
  RefreshCw,
  ExternalLink,
  Globe,
  Twitter,
  Search,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { isValidSolanaAddress } from '../utils/fileParser';
import { formatMarketCap } from '../utils/projectStorage';

// Custom icons for trading platforms
const AxiomIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M12 2L2 19h20L12 2zm0 4l6.5 11h-13L12 6z" />
  </svg>
);

const DexScreenerIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const OrbIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const JupiterIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="12" cy="14" r="2" fill="currentColor" />
  </svg>
);

const HolderScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </svg>
);

// Simple in-memory cache for token lookups
const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch with timeout helper
async function fetchWithTimeout(url, timeout = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function TokenPanel({
  tokenMint,
  tokenInfo,
  onTokenChange,
  onSaveProject,
  isLoading,
  hasWallets,
}) {
  const [inputValue, setInputValue] = useState(tokenMint);
  const [isEditing, setIsEditing] = useState(!tokenMint);
  const [jupiterData, setJupiterData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    setInputValue(tokenMint);
    if (tokenMint) {
      setIsEditing(false);
      setPreviewData(null);
    }
  }, [tokenMint]);

  // Fetch Jupiter metadata for social links (when token is already tracked)
  useEffect(() => {
    if (!tokenMint) {
      setJupiterData(null);
      return;
    }

    const fetchJupiterData = async () => {
      try {
        const response = await fetchWithTimeout(`https://tokens.jup.ag/token/${tokenMint}`, 3000);
        if (response.ok) {
          const data = await response.json();
          setJupiterData(data);
        }
      } catch (error) {
        console.log('[Jupiter] Could not fetch token metadata:', error.message);
      }
    };

    fetchJupiterData();
  }, [tokenMint]);

  // Fetch token preview when valid address is entered (before tracking)
  // OPTIMIZED: Parallel fetching, caching, and reduced debounce
  useEffect(() => {
    if (!inputValue || !isValidSolanaAddress(inputValue) || inputValue === tokenMint) {
      setPreviewData(null);
      setPreviewError(null);
      return;
    }

    // Check cache first
    const cached = tokenCache.get(inputValue);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[TokenPreview] Cache hit for', inputValue.slice(0, 8));
      if (cached.data) {
        setPreviewData(cached.data);
        setPreviewError(null);
      } else if (cached.error) {
        setPreviewError(cached.error);
        setPreviewData(null);
      }
      return;
    }

    let isCancelled = false;

    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      setPreviewError(null);

      const startTime = Date.now();

      try {
        // PARALLEL FETCH: Race both APIs for fastest response
        // Jupiter is preferred if both succeed
        const jupiterPromise = fetchWithTimeout(`https://tokens.jup.ag/token/${inputValue}`, 2500)
          .then(async (res) => {
            if (!res.ok) return null;
            const data = await res.json();
            return {
              name: data.name || 'Unknown Token',
              symbol: data.symbol || '???',
              image: data.logoURI || null,
              decimals: data.decimals || 9,
              extensions: data.extensions || {},
              source: 'Jupiter',
            };
          })
          .catch(() => null);

        const dexPromise = fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${inputValue}`, 2500)
          .then(async (res) => {
            if (!res.ok) return null;
            const dexData = await res.json();
            if (!dexData.pairs || dexData.pairs.length === 0) return null;

            const bestPair = dexData.pairs.sort((a, b) =>
              (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];

            return {
              name: bestPair.baseToken?.name || 'Unknown Token',
              symbol: bestPair.baseToken?.symbol || '???',
              image: bestPair.info?.imageUrl || null,
              price: Number(bestPair.priceUsd) || 0,
              marketCap: Number(bestPair.marketCap) || 0,
              source: 'DexScreener',
            };
          })
          .catch(() => null);

        // Wait for both to complete
        const [jupiterResult, dexResult] = await Promise.all([jupiterPromise, dexPromise]);

        if (isCancelled) return;

        const elapsed = Date.now() - startTime;
        console.log(`[TokenPreview] Fetched in ${elapsed}ms`);

        // Prefer Jupiter data, fallback to DexScreener
        const result = jupiterResult || dexResult;

        if (result) {
          setPreviewData(result);
          setPreviewError(null);
          // Cache successful result
          tokenCache.set(inputValue, { data: result, timestamp: Date.now() });
        } else {
          const errorMsg = 'Token not found. It may be a new or unlisted token.';
          setPreviewError(errorMsg);
          setPreviewData(null);
          // Cache the "not found" result too
          tokenCache.set(inputValue, { error: errorMsg, timestamp: Date.now() });
        }
      } catch (error) {
        if (isCancelled) return;
        console.error('[Preview] Error fetching token data:', error);
        setPreviewError('Failed to fetch token data');
        setPreviewData(null);
      } finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    };

    // Reduced debounce for faster response (150ms instead of 300ms)
    const timer = setTimeout(fetchPreview, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [inputValue, tokenMint]);

  const handleSubmit = () => {
    if (isValidSolanaAddress(inputValue)) {
      // Pass preview data so we don't need to re-fetch token info
      onTokenChange(inputValue, previewData);
      setIsEditing(false);
      setPreviewData(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && previewData) {
      handleSubmit();
    }
  };

  const isValid = isValidSolanaAddress(inputValue);
  const hasTokenInfo = tokenInfo && tokenInfo.name && tokenInfo.name !== 'Unknown Token';

  // Generate trading/analytics links
  const links = tokenMint
    ? {
        axiom: `https://axiom.trade/t/${tokenMint}`,
        orb: `https://orb.helius.dev/token/${tokenMint}`,
        dexscreener: `https://dexscreener.com/solana/${tokenMint}`,
        jupiter: `https://jup.ag/swap/SOL-${tokenMint}`,
        holderscan: `https://holderscan.io/solana/token/${tokenMint}`,
        twitter: jupiterData?.extensions?.twitter
          ? `https://twitter.com/${jupiterData.extensions.twitter.replace('@', '')}`
          : null,
        website: jupiterData?.extensions?.website || null,
      }
    : {};

  // Show input mode
  if (isEditing || !tokenMint) {
    return (
      <div className="rounded-xl bg-dark-800 border border-dark-600 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="h-5 w-5 text-accent-secondary" />
            <h3 className="font-semibold text-white">Token to Track</h3>
          </div>

          <div className="space-y-4">
            {/* Input Field */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {isLoadingPreview ? (
                  <Loader2 className="h-5 w-5 text-accent-primary animate-spin" />
                ) : (
                  <Search className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.trim())}
                onKeyDown={handleKeyDown}
                placeholder="Enter Solana token contract address..."
                className={`
                  w-full rounded-xl bg-dark-700 border pl-11 pr-4 py-3.5
                  font-mono text-sm text-white placeholder-gray-500
                  focus:outline-none focus:ring-2 transition-all
                  ${inputValue && !isValid
                    ? 'border-accent-danger focus:ring-accent-danger/30'
                    : isValid && previewData
                      ? 'border-accent-success focus:ring-accent-success/30'
                      : 'border-dark-500 focus:border-accent-primary focus:ring-accent-primary/30'
                  }
                `}
              />
            </div>

            {/* Validation Error */}
            {inputValue && !isValid && (
              <p className="text-sm text-accent-danger flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                Invalid Solana address format
              </p>
            )}

            {/* Preview Error */}
            {previewError && isValid && (
              <div className="flex items-center gap-2 p-3 bg-accent-warning/10 border border-accent-warning/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-accent-warning flex-shrink-0" />
                <p className="text-sm text-accent-warning">{previewError}</p>
              </div>
            )}

            {/* Token Preview Card */}
            {previewData && (
              <div className="animate-slide-up">
                <div className="bg-dark-700/50 border border-dark-500 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    {/* Token Image */}
                    <div className="flex-shrink-0">
                      {previewData.image ? (
                        <img
                          src={previewData.image}
                          alt={previewData.symbol}
                          className="w-14 h-14 rounded-xl object-cover bg-dark-600 border border-dark-500"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-14 h-14 rounded-xl bg-dark-600 border border-dark-500 items-center justify-center ${
                          previewData.image ? 'hidden' : 'flex'
                        }`}
                      >
                        <Coins className="h-7 w-7 text-gray-500" />
                      </div>
                    </div>

                    {/* Token Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-white truncate">
                          {previewData.name}
                        </h4>
                        <span className="text-xs bg-accent-primary/20 text-accent-primary px-1.5 py-0.5 rounded">
                          {previewData.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-accent-primary font-semibold">
                          ${previewData.symbol}
                        </span>
                        {previewData.marketCap > 0 && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span className="text-sm text-gray-400">
                              MCap: {formatMarketCap(previewData.marketCap)}
                            </span>
                          </>
                        )}
                      </div>
                      {previewData.extensions?.twitter && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Twitter className="h-3 w-3" />
                          @{previewData.extensions.twitter.replace('@', '')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Track Button */}
                  <button
                    onClick={handleSubmit}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent-primary hover:bg-accent-primary/80 text-white font-medium transition-all"
                  >
                    <span>Track This Token</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Loading Preview */}
            {isLoadingPreview && (
              <div className="flex items-center justify-center gap-3 py-6">
                <Loader2 className="h-5 w-5 text-accent-primary animate-spin" />
                <span className="text-sm text-gray-400">Looking up token...</span>
              </div>
            )}

            {/* Track anyway button for unrecognized tokens */}
            {previewError && isValid && (
              <button
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-dark-600 hover:bg-dark-500 border border-dark-500 text-gray-300 font-medium transition-all"
              >
                <span>Track Anyway</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show token info mode
  return (
    <div className="rounded-xl bg-dark-800 border border-dark-600 overflow-hidden">
      {/* Token Header with Image */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Token Image */}
          <div className="flex-shrink-0">
            {tokenInfo?.image ? (
              <img
                src={tokenInfo.image}
                alt={tokenInfo.symbol}
                className="w-16 h-16 rounded-xl object-cover bg-dark-600 border border-dark-500"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-dark-600 border border-dark-500 flex items-center justify-center">
                <Coins className="h-8 w-8 text-gray-500" />
              </div>
            )}
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white truncate">
                {tokenInfo?.name || 'Loading...'}
              </h3>
              {isLoading && (
                <RefreshCw className="h-4 w-4 text-accent-primary animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-accent-primary font-semibold">
                ${tokenInfo?.symbol || '???'}
              </span>
              <code className="text-xs text-gray-500 font-mono">
                {tokenMint.slice(0, 8)}...{tokenMint.slice(-6)}
              </code>
            </div>

            {/* Price & Market Cap */}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {/* Price */}
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">
                  ${tokenInfo?.price < 0.0001
                    ? tokenInfo?.price?.toExponential(4)
                    : tokenInfo?.price?.toFixed(6) || '0.00'
                  }
                </span>
                {tokenInfo?.priceChange24h !== undefined && tokenInfo?.priceChange24h !== 0 && (
                  <span className={`
                    flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-md
                    ${tokenInfo.priceChange24h >= 0
                      ? 'text-accent-success bg-accent-success/10'
                      : 'text-accent-danger bg-accent-danger/10'
                    }
                  `}>
                    {tokenInfo.priceChange24h >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(tokenInfo.priceChange24h).toFixed(2)}%
                  </span>
                )}
              </div>

              {/* Market Cap */}
              {tokenInfo?.marketCap > 0 && (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">
                    MCap: <span className="text-white font-medium">{formatMarketCap(tokenInfo.marketCap)}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Links Row */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-dark-600">
          <span className="text-xs text-gray-500 mr-1">Quick Links:</span>

          {/* Axiom Trade */}
          <a
            href={links.axiom}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-accent-primary rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all"
            title="Trade on Axiom"
          >
            <AxiomIcon />
            Axiom
          </a>

          {/* Orb.io */}
          <a
            href={links.orb}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-purple-500 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all"
            title="View on Orb.io"
          >
            <OrbIcon />
            Orb
          </a>

          {/* DexScreener */}
          <a
            href={links.dexscreener}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-green-500 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all"
            title="View on DexScreener"
          >
            <DexScreenerIcon />
            DexScreener
          </a>

          {/* Jupiter */}
          <a
            href={links.jupiter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-orange-500 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all"
            title="Trade on Jupiter"
          >
            <JupiterIcon />
            Jupiter
          </a>

          {/* HOLDERscan */}
          <a
            href={links.holderscan}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-emerald-500 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all"
            title="View on HOLDERscan"
          >
            <HolderScanIcon />
            HOLDERscan
          </a>

          {/* Twitter/X - Only show if available */}
          {links.twitter && (
            <a
              href={links.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-blue-400 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all"
              title="View on X (Twitter)"
            >
              <Twitter className="h-4 w-4" />
              X
            </a>
          )}

          {/* Website - Only show if available */}
          {links.website && (
            <a
              href={links.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-cyan-500 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all"
              title="Visit website"
            >
              <Globe className="h-4 w-4" />
              Website
            </a>
          )}
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-2 px-6 py-3 bg-dark-700/50 border-t border-dark-600">
        <button
          onClick={() => setIsEditing(true)}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
        >
          Change Token
        </button>

        {hasWallets && (
          <button
            onClick={onSaveProject}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 rounded-lg transition-colors ml-auto"
          >
            <Save className="h-4 w-4" />
            Save Project
          </button>
        )}
      </div>
    </div>
  );
}
