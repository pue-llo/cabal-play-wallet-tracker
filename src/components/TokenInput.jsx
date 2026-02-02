import { useState, useEffect } from 'react';
import { Coins, Check, AlertCircle, Loader } from 'lucide-react';
import { isValidSolanaAddress } from '../utils/fileParser';

export function TokenInput({ value, onChange, tokenMetadata, tokenPrice }) {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  useEffect(() => {
    setInputValue(value);
    setIsValid(isValidSolanaAddress(value));
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value.trim();
    setInputValue(newValue);
    setIsTouched(true);

    if (isValidSolanaAddress(newValue)) {
      setIsValid(true);
      onChange(newValue);
    } else {
      setIsValid(false);
    }
  };

  const handleBlur = () => {
    setIsTouched(true);
  };

  const showError = isTouched && inputValue && !isValid;
  const showSuccess = isValid && inputValue;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">
        Token Contract Address (CA)
      </label>

      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Coins className="h-5 w-5 text-gray-500" />
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Enter Solana token mint address..."
          className={`
            w-full rounded-xl bg-dark-700 border pl-12 pr-12 py-3.5
            font-mono text-sm text-white placeholder-gray-500
            focus:outline-none focus:ring-2 transition-all
            ${showError
              ? 'border-accent-danger focus:ring-accent-danger/30'
              : showSuccess
                ? 'border-accent-success focus:ring-accent-success/30'
                : 'border-dark-500 focus:border-accent-primary focus:ring-accent-primary/30'
            }
          `}
        />

        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {showSuccess && <Check className="h-5 w-5 text-accent-success" />}
          {showError && <AlertCircle className="h-5 w-5 text-accent-danger" />}
        </div>
      </div>

      {showError && (
        <p className="text-sm text-accent-danger flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" />
          Invalid Solana address format
        </p>
      )}

      {/* Token info display */}
      {showSuccess && (tokenMetadata || tokenPrice > 0) && (
        <div className="flex flex-wrap gap-4 text-sm animate-slide-up">
          {tokenMetadata?.decimals !== undefined && (
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-gray-500">Decimals:</span>
              <span className="text-white font-mono">{tokenMetadata.decimals}</span>
            </div>
          )}
          {tokenPrice > 0 && (
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-gray-500">Price:</span>
              <span className="text-accent-success font-mono">
                ${tokenPrice < 0.01 ? tokenPrice.toExponential(4) : tokenPrice.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
