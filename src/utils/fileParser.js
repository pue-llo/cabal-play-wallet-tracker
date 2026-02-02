import * as XLSX from 'xlsx';

/**
 * Valid group types for wallet classification
 */
export const WALLET_GROUPS = {
  PREM: { id: 'PREM', label: 'Premium', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  WIC: { id: 'WIC', label: 'WIC', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  NONE: { id: '', label: '', color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

/**
 * Parse CSV or Excel file and extract wallet data
 * Expected columns: Name, Wallet Address, Group (optional - PREM or WIC)
 */
export async function parseWalletFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          reject(new Error('File must contain at least a header row and one data row'));
          return;
        }

        // Find column indices (flexible header matching)
        const headers = jsonData[0].map(h => String(h).toLowerCase().trim());

        const nameIndex = headers.findIndex(h =>
          h.includes('name') || h.includes('label') || h.includes('holder')
        );

        const addressIndex = headers.findIndex(h =>
          h.includes('address') || h.includes('wallet') || h.includes('pubkey')
        );

        // Look for group column (PREM/WIC classification)
        const groupIndex = headers.findIndex(h =>
          h.includes('group') || h.includes('type') || h.includes('tier') || h.includes('category')
        );

        if (addressIndex === -1) {
          reject(new Error('Could not find wallet address column. Expected: Address, Wallet, or Pubkey'));
          return;
        }

        // Log column detection for debugging
        console.log('[FileParser] Detected columns:', {
          name: nameIndex !== -1 ? headers[nameIndex] : 'not found',
          address: headers[addressIndex],
          group: groupIndex !== -1 ? headers[groupIndex] : 'not found',
        });

        // Parse rows
        const wallets = [];
        let premCount = 0;
        let wicCount = 0;

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const address = row[addressIndex];

          if (address && String(address).trim()) {
            // Parse group value (normalize to uppercase)
            let group = '';
            if (groupIndex !== -1 && row[groupIndex]) {
              const rawGroup = String(row[groupIndex]).trim().toUpperCase();
              // Accept PREM, PREMIUM, WIC variations
              if (rawGroup === 'PREM' || rawGroup === 'PREMIUM' || rawGroup === 'P') {
                group = 'PREM';
                premCount++;
              } else if (rawGroup === 'WIC' || rawGroup === 'W') {
                group = 'WIC';
                wicCount++;
              }
            }

            wallets.push({
              id: crypto.randomUUID(),
              name: nameIndex !== -1 && row[nameIndex]
                ? String(row[nameIndex]).trim()
                : `Wallet ${i}`,
              address: String(address).trim(),
              group, // PREM, WIC, or empty string
              addedAt: new Date().toISOString(),
            });
          }
        }

        if (wallets.length === 0) {
          reject(new Error('No valid wallet addresses found in file'));
          return;
        }

        // Log import summary
        console.log(`[FileParser] Imported ${wallets.length} wallets: ${premCount} PREM, ${wicCount} WIC, ${wallets.length - premCount - wicCount} untagged`);

        resolve(wallets);
      } catch (error) {
        reject(new Error(`Failed to parse file: ${error.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address) {
  // Solana addresses are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Truncate address for display
 */
export function truncateAddress(address, startChars = 4, endChars = 4) {
  if (!address || address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}
