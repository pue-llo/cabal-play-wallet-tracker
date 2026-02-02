import { Connection, PublicKey } from '@solana/web3.js';
import * as XLSX from 'xlsx';

const TOKEN_MINT = 'BNZ1fFBaYLnjaT9LbUdGRXssFbBGjWuNjGrRLqZzpump';

// Random names for the wallets
const RANDOM_NAMES = [
  'Alpha Whale', 'Diamond Hands', 'Moon Walker', 'Crypto King',
  'HODL Master', 'Degen Dave', 'Sol Surfer', 'Pump Hunter',
  'Token Titan', 'Wallet Wizard', 'Chain Chaser', 'Block Boss',
  'Yield Yeti', 'Stake Snake', 'Mint Monster', 'Gas Guru',
  'Swap Shark', 'Pool Prince', 'Farm Fox', 'Liquidity Lion'
];

async function fetchTopHolders() {
  console.log('Fetching top holders for:', TOKEN_MINT);

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  try {
    // Get largest token accounts
    const response = await connection.getTokenLargestAccounts(new PublicKey(TOKEN_MINT));

    if (!response.value || response.value.length === 0) {
      console.log('No holders found');
      return;
    }

    console.log(`Found ${response.value.length} top holders\n`);

    // Get owner addresses for each token account
    const holders = [];

    for (let i = 0; i < Math.min(response.value.length, 20); i++) {
      const account = response.value[i];

      try {
        // Get the account info to find the owner
        const accountInfo = await connection.getParsedAccountInfo(new PublicKey(account.address));

        if (accountInfo.value && accountInfo.value.data.parsed) {
          const owner = accountInfo.value.data.parsed.info.owner;
          holders.push({
            name: RANDOM_NAMES[i] || `Holder ${i + 1}`,
            address: owner,
            balance: account.uiAmount || 0
          });
          console.log(`${i + 1}. ${RANDOM_NAMES[i]}: ${owner.slice(0, 8)}... (${account.uiAmount?.toLocaleString() || 0} tokens)`);
        }
      } catch (e) {
        console.log(`  Error fetching account ${i + 1}:`, e.message);
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    // Create Excel file
    const worksheet = XLSX.utils.json_to_sheet(holders.map(h => ({
      'Name': h.name,
      'Wallet Address': h.address,
      'Balance': h.balance
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Top Holders');

    // Write file
    const filename = 'top-holders-test.xlsx';
    XLSX.writeFile(workbook, filename);

    console.log(`\n✅ Created ${filename} with ${holders.length} wallets`);
    console.log('You can now upload this file to test the dashboard!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

fetchTopHolders();
