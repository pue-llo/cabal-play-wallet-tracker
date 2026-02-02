import { useState } from 'react';
import { Settings, Key, RefreshCw, X, Save, Info } from 'lucide-react';

export function SettingsPanel({ settings, onUpdate, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onUpdate(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-2xl border border-dark-600 w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-600 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Refresh Interval */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <RefreshCw className="h-4 w-4" />
              Auto-refresh Interval
            </label>
            <select
              value={localSettings.refreshInterval}
              onChange={(e) => setLocalSettings(prev => ({
                ...prev,
                refreshInterval: Number(e.target.value)
              }))}
              className="w-full rounded-xl bg-dark-700 border border-dark-500 px-4 py-3
                text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/30
                focus:border-accent-primary transition-all"
            >
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={0}>Disabled</option>
            </select>
          </div>

          {/* Helius API Key */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Key className="h-4 w-4" />
              Helius API Key (Optional)
            </label>
            <input
              type="password"
              value={localSettings.heliusApiKey}
              onChange={(e) => setLocalSettings(prev => ({
                ...prev,
                heliusApiKey: e.target.value.trim()
              }))}
              placeholder="Enter your Helius API key..."
              className="w-full rounded-xl bg-dark-700 border border-dark-500 px-4 py-3
                text-white placeholder-gray-500 font-mono text-sm
                focus:outline-none focus:ring-2 focus:ring-accent-primary/30
                focus:border-accent-primary transition-all"
            />
            <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-dark-700/50">
              <Info className="h-4 w-4 text-accent-secondary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400">
                A Helius API key improves rate limits and transaction data quality.
                Get one free at{' '}
                <a
                  href="https://helius.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:underline"
                >
                  helius.dev
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-600">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80
              text-white font-medium rounded-xl transition-colors"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
