import { ArrowUpRight, ArrowDownLeft, ExternalLink, Clock } from 'lucide-react';
import { truncateAddress } from '../utils/fileParser';

export function TransactionFeed({ transactions, isLoading }) {
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
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
  };

  const formatAmount = (amount) => {
    if (!amount) return '0';
    if (amount < 0.0001) return amount.toExponential(2);
    if (amount < 1) return amount.toFixed(6);
    if (amount < 1000) return amount.toFixed(4);
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl bg-dark-800 border border-dark-600 p-8 text-center">
        <Clock className="h-10 w-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No transactions yet</p>
        <p className="text-gray-500 text-sm mt-1">
          Recent buy/sell activity will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-dark-800 border border-dark-600 overflow-hidden">
      <div className="px-6 py-4 border-b border-dark-600 flex items-center justify-between">
        <h3 className="font-semibold text-white">Recent Transactions</h3>
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-dark-500 border-t-accent-primary" />
        )}
      </div>

      <div className="divide-y divide-dark-600 max-h-[400px] overflow-y-auto">
        {transactions.map((tx, index) => {
          const isBuy = tx.type === 'BUY';

          return (
            <div
              key={tx.signature || index}
              className="px-6 py-4 hover:bg-dark-700/50 transition-colors animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0
                    ${isBuy ? 'bg-accent-success/10' : 'bg-accent-danger/10'}
                  `}
                >
                  {isBuy ? (
                    <ArrowDownLeft className="h-5 w-5 text-accent-success" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 text-accent-danger" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className={`font-semibold ${isBuy ? 'text-accent-success' : 'text-accent-danger'}`}>
                      {isBuy ? 'Buy' : 'Sell'}
                    </span>
                    <span className="text-gray-500 text-sm flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(tx.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 mt-1">
                    <span className="font-mono text-white">
                      {isBuy ? '+' : '-'}{formatAmount(tx.amount)}
                    </span>
                    {tx.signature && (
                      <a
                        href={`https://solscan.io/tx/${tx.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-accent-primary text-xs flex items-center gap-1 transition-colors"
                      >
                        {truncateAddress(tx.signature, 4, 4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
