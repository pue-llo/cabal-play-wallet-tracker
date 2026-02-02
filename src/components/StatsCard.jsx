import { TrendingUp, Wallet, DollarSign, Clock } from 'lucide-react';

export function StatsCard({ walletData, totalHoldings, totalValue, tokenPrice, lastUpdated }) {
  const formatNumber = (num) => {
    if (!num || num === 0) return '0';
    if (num < 0.0001) return num.toExponential(4);
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    if (num < 1000000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return (num / 1000000).toFixed(2) + 'M';
  };

  const formatUSD = (value) => {
    if (!value || value === 0) return '$0.00';
    if (value < 0.01) return '<$0.01';
    if (value < 1000) return `$${value.toFixed(2)}`;
    if (value < 1000000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return `$${(value / 1000000).toFixed(2)}M`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const stats = [
    {
      label: 'Total Holdings',
      value: formatNumber(totalHoldings),
      icon: Wallet,
      color: 'accent-primary',
    },
    {
      label: 'Total Value',
      value: formatUSD(totalValue),
      icon: DollarSign,
      color: 'accent-success',
    },
    {
      label: 'Token Price',
      value: tokenPrice > 0 ? `$${tokenPrice < 0.0001 ? tokenPrice.toExponential(4) : tokenPrice.toFixed(6)}` : '-',
      icon: TrendingUp,
      color: 'accent-secondary',
    },
    {
      label: 'Wallets Tracked',
      value: walletData.length.toString(),
      icon: Wallet,
      color: 'accent-warning',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl bg-dark-800 border border-dark-600 p-5 animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-${stat.color}/10`}>
                <Icon className={`h-5 w-5 text-${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold text-white mt-0.5">{stat.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
