const STORAGE_KEYS = {
  WALLETS: 'cwt_wallets',
  TOKEN_MINT: 'cwt_token_mint',
  SETTINGS: 'cwt_settings',
  WALLET_DATA: 'cwt_wallet_data',
  TRANSACTIONS: 'cwt_transactions',
  INITIAL_BALANCES: 'cwt_initial_balances',
  ACTIVE_PROJECT_ID: 'cwt_active_project_id',
};

/**
 * Save wallets to localStorage
 */
export function saveWallets(wallets) {
  try {
    localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));
    return true;
  } catch (error) {
    console.error('Failed to save wallets:', error);
    return false;
  }
}

/**
 * Load wallets from localStorage
 */
export function loadWallets() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WALLETS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load wallets:', error);
    return [];
  }
}

/**
 * Save token mint address
 */
export function saveTokenMint(mint) {
  try {
    localStorage.setItem(STORAGE_KEYS.TOKEN_MINT, mint);
    return true;
  } catch (error) {
    console.error('Failed to save token mint:', error);
    return false;
  }
}

/**
 * Load token mint address
 */
export function loadTokenMint() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN_MINT) || '';
  } catch (error) {
    return '';
  }
}

/**
 * Save wallet data (balances, etc.)
 */
export function saveWalletData(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.WALLET_DATA, JSON.stringify({
      data,
      timestamp: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('Failed to save wallet data:', error);
    return false;
  }
}

/**
 * Load wallet data
 */
export function loadWalletData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.WALLET_DATA);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    return null;
  }
}

/**
 * Save transactions
 */
export function saveTransactions(transactions) {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify({
      data: transactions,
      timestamp: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('Failed to save transactions:', error);
    return false;
  }
}

/**
 * Load transactions
 */
export function loadTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed.data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Save settings
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Load settings
 */
export function loadSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      refreshInterval: 30, // seconds
      heliusApiKey: '',
    };
  } catch (error) {
    return {
      refreshInterval: 30,
      heliusApiKey: '',
    };
  }
}

/**
 * Save initial balances (first-seen balance for each wallet)
 * Key: tokenMint, Value: { walletAddress: initialBalance }
 */
export function saveInitialBalances(tokenMint, balances) {
  try {
    const allInitialBalances = loadAllInitialBalances();
    allInitialBalances[tokenMint] = {
      ...allInitialBalances[tokenMint],
      ...balances,
    };
    localStorage.setItem(STORAGE_KEYS.INITIAL_BALANCES, JSON.stringify(allInitialBalances));
    return true;
  } catch (error) {
    console.error('Failed to save initial balances:', error);
    return false;
  }
}

/**
 * Load initial balances for a specific token
 */
export function loadInitialBalances(tokenMint) {
  try {
    const all = loadAllInitialBalances();
    return all[tokenMint] || {};
  } catch (error) {
    return {};
  }
}

/**
 * Load all initial balances
 */
export function loadAllInitialBalances() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.INITIAL_BALANCES);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    return {};
  }
}

/**
 * Clear initial balances for a specific token
 */
export function clearInitialBalances(tokenMint) {
  try {
    const all = loadAllInitialBalances();
    delete all[tokenMint];
    localStorage.setItem(STORAGE_KEYS.INITIAL_BALANCES, JSON.stringify(all));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Save active project ID for session persistence
 */
export function saveActiveProjectId(projectId) {
  try {
    if (projectId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, projectId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
    }
    return true;
  } catch (error) {
    console.error('Failed to save active project ID:', error);
    return false;
  }
}

/**
 * Load active project ID
 */
export function loadActiveProjectId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT_ID) || null;
  } catch (error) {
    return null;
  }
}

/**
 * Clear all stored data
 */
export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
