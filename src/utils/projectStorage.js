/**
 * Project Storage Utility
 * Handles saving/loading projects (token + wallets) to localStorage
 */

const STORAGE_KEY = 'cwt_projects';

/**
 * Generate a unique ID for projects
 */
function generateId() {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all saved projects
 */
export function getProjects() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}

/**
 * Save a new project or update existing one
 * Now includes cached wallet data for faster loading
 */
export function saveProject(project) {
  try {
    const projects = getProjects();

    // Check if project with this token already exists
    const existingIndex = projects.findIndex(
      p => p.tokenMint.toLowerCase() === project.tokenMint.toLowerCase()
    );

    const projectData = {
      id: project.id || generateId(),
      tokenMint: project.tokenMint,
      tokenName: project.tokenName || 'Unknown',
      tokenSymbol: project.tokenSymbol || '???',
      tokenImage: project.tokenImage || null,
      marketCap: project.marketCap || 0,
      wallets: project.wallets || [],
      // Enhanced: Cache wallet data for faster loading
      cachedWalletData: project.cachedWalletData || null,
      cachedTransactions: project.cachedTransactions || null,
      cachedTokenInfo: project.cachedTokenInfo || null,
      cachedInitialBalances: project.cachedInitialBalances || null,
      createdAt: project.createdAt || new Date().toISOString(),
      lastScanned: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing project
      projects[existingIndex] = {
        ...projects[existingIndex],
        ...projectData,
        createdAt: projects[existingIndex].createdAt, // Keep original creation date
      };
    } else {
      // Add new project
      projects.unshift(projectData); // Add to beginning
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return projectData;
  } catch (error) {
    console.error('Error saving project:', error);
    return null;
  }
}

/**
 * Get a specific project by ID or token mint
 */
export function getProject(idOrMint) {
  const projects = getProjects();
  return projects.find(
    p => p.id === idOrMint || p.tokenMint.toLowerCase() === idOrMint.toLowerCase()
  );
}

/**
 * Delete a project
 */
export function deleteProject(projectId) {
  try {
    const projects = getProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

/**
 * Update project wallets
 */
export function updateProjectWallets(projectId, wallets) {
  try {
    const projects = getProjects();
    const index = projects.findIndex(p => p.id === projectId);

    if (index >= 0) {
      projects[index].wallets = wallets;
      projects[index].lastScanned = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating project wallets:', error);
    return false;
  }
}

/**
 * Update project cached data for faster loading
 * Call this after fetching wallet data to cache it with the project
 */
export function updateProjectCachedData(projectId, cachedData) {
  try {
    const projects = getProjects();
    const index = projects.findIndex(p => p.id === projectId);

    if (index >= 0) {
      projects[index] = {
        ...projects[index],
        cachedWalletData: cachedData.walletData || projects[index].cachedWalletData,
        cachedTransactions: cachedData.transactions || projects[index].cachedTransactions,
        cachedTokenInfo: cachedData.tokenInfo || projects[index].cachedTokenInfo,
        cachedInitialBalances: cachedData.initialBalances || projects[index].cachedInitialBalances,
        lastScanned: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      console.log(`[ProjectStorage] Cached data updated for project ${projectId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating project cached data:', error);
    return false;
  }
}

/**
 * Get cached data from a project for instant loading
 */
export function getProjectCachedData(projectId) {
  try {
    const project = getProject(projectId);
    if (!project) return null;

    return {
      walletData: project.cachedWalletData,
      transactions: project.cachedTransactions,
      tokenInfo: project.cachedTokenInfo,
      initialBalances: project.cachedInitialBalances,
      lastScanned: project.lastScanned,
    };
  } catch (error) {
    console.error('Error getting project cached data:', error);
    return null;
  }
}

/**
 * Clear all projects
 */
export function clearAllProjects() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing projects:', error);
    return false;
  }
}

/**
 * Format market cap for display
 */
export function formatMarketCap(value) {
  if (!value || value === 0) return '$0';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
