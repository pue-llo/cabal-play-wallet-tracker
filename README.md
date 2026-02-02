# 🎮 Cabal Play Wallet Tracker

### By Wisemen Alpha

A powerful Solana wallet tracking dashboard for monitoring token holdings, transactions, and whale activity in real-time.

![Version](https://img.shields.io/badge/version-1.0.0-purple)
![Solana](https://img.shields.io/badge/Solana-black?logo=solana)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-yellow?logo=vite)

---

## ✨ Features

### 📊 Real-Time Wallet Tracking
- Track unlimited Solana wallets simultaneously
- Live balance updates with change indicators
- Holdings percentage visualization
- USD value calculations

### 🏷️ Smart Wallet Groups
- **PREM** and **WIC** wallet classification
- Filter wallets by group
- Import wallets from Excel files with automatic group detection

### ⚡ Intelligent Caching System
- **Instant Load** - Data appears immediately on page refresh
- **Stale-While-Revalidate** - See cached data while updates happen in background
- **Incremental Sync** - Only fetches new transactions, not entire history
- **Smart Refresh** - Only updates stale data, preserving API calls

### 📈 Transaction History
- Track buys, sells, and transfers
- Activity status indicators (Active Buyer, Taking Profits, Holder, etc.)
- Historical transaction feed with timestamps

### 🔗 Quick Links Integration
- [Jupiter](https://jup.ag) - Swap tokens
- [Axiom Trade](https://axiom.trade) - Advanced trading
- [DexScreener](https://dexscreener.com) - Charts & analytics
- [HOLDERscan](https://holderscan.io) - Holder analysis
- [Orb by Helius](https://orb.helius.dev) - Token explorer

### 💾 Project Management
- Save multiple tracking projects
- Quick switch between different tokens
- Persistent session state

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CABAL PLAY TRACKER                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Token Panel │  │  Holdings   │  │  Transaction Feed   │ │
│  │             │  │   Table     │  │                     │ │
│  │ • Price     │  │             │  │ • Buy/Sell history  │ │
│  │ • Metadata  │  │ • Balances  │  │ • Activity status   │ │
│  │ • Links     │  │ • Groups    │  │ • Timestamps        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     DATA CACHE LAYER                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Wallet Balances (2 min TTL)                       │   │
│  │ • Transactions (30 sec TTL, incremental sync)       │   │
│  │ • Token Metadata (24 hour TTL)                      │   │
│  │ • Token Price (1 min TTL)                           │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      API LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  Helius RPC  │  │ DexScreener  │  │   Solscan      │   │
│  │  (balances)  │  │   (prices)   │  │   (explorer)   │   │
│  └──────────────┘  └──────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Helius](https://helius.dev) API key (free tier available)

### Installation

```bash
# Clone the repository
git clone https://github.com/pue-llo/cabal-play-wallet-tracker.git

# Navigate to directory
cd cabal-play-wallet-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Or serve with Python (no Node required)
cd dist && python3 -m http.server 5173
```

---

## ⚙️ Configuration

### Helius API Key

1. Get a free API key at [helius.dev](https://helius.dev)
2. Click the ⚙️ Settings icon in the app
3. Enter your API key
4. Enjoy faster data fetching with higher rate limits

### Rate Limiting

| With API Key | Without API Key |
|--------------|-----------------|
| 5 wallets/batch | 3 wallets/batch |
| 2 sec delay | 0.5 sec delay |
| Higher reliability | May hit rate limits |

---

## 📖 Usage

### Adding a Token to Track

1. Paste a Solana token mint address in the input field
2. Token info will auto-populate from Jupiter/DexScreener
3. Click "Track Token"

### Importing Wallets

1. Click the 📥 Import button
2. Select an Excel file (.xlsx) with wallet data
3. Required columns: `wallet` or `address`
4. Optional columns: `name`, `group` (PREM/WIC)

### Understanding Activity Status

| Status | Meaning |
|--------|---------|
| 🟢 Active Buyer | Recent buy transactions |
| 🟡 Taking Profits | Recent sell transactions |
| 🔵 Holder | No recent activity |
| ⚪ New | Just added, no history yet |

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Blockchain**: @solana/web3.js
- **File Parsing**: SheetJS (xlsx)
- **APIs**: Helius RPC, DexScreener, Jupiter

---

## 📁 Project Structure

```
src/
├── components/
│   ├── HoldingsTable.jsx    # Main wallet table with groups
│   ├── TokenPanel.jsx       # Token info and quick links
│   ├── TransactionFeed.jsx  # Activity history
│   ├── SavedProjects.jsx    # Project management
│   └── ...
├── hooks/
│   └── useWalletTracker.js  # Main state management
├── services/
│   ├── solanaApi.js         # Blockchain API calls
│   └── dataCache.js         # Intelligent caching system
├── utils/
│   ├── storage.js           # LocalStorage utilities
│   ├── projectStorage.js    # Project persistence
│   └── fileParser.js        # Excel import parsing
└── App.jsx                  # Main application
```

---

## 🔮 Future Roadmap

- [ ] Custom validator/RPC support
- [ ] Real-time WebSocket updates
- [ ] Portfolio analytics & charts
- [ ] Alert notifications
- [ ] Multi-token tracking
- [ ] Mobile responsive design
- [ ] Export to CSV/PDF

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Credits

**Built by [Wisemen Alpha](https://twitter.com/wisemenalpha)**

Powered by:
- [Helius](https://helius.dev) - Solana RPC & APIs
- [DexScreener](https://dexscreener.com) - Token data
- [Jupiter](https://jup.ag) - Token metadata

---

<p align="center">
  <b>Cabal Play Wallet Tracker v1.0.0</b><br>
  <i>Track smart. Trade smarter.</i>
</p>
