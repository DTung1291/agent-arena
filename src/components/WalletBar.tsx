import { ConnectKitButton } from 'connectkit';
import { useAccount, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { getUsdc, requireChain, buildAddressExplorerUrl } from '@/onchain-facts';
import { Amount, usdcDecimalsFor } from '@/onchain-money';
import { formatAddress } from '@/lib/utils';
import { Wifi, WifiOff, ExternalLink } from 'lucide-react';

const ARC_TESTNET_ID = 5042002;
const usdcFact = getUsdc(ARC_TESTNET_ID)!;
const arcChain = requireChain(ARC_TESTNET_ID);

export function WalletBar() {
  const { address, isConnected, chainId } = useAccount();
  const isCorrectChain = chainId === ARC_TESTNET_ID;

  const { data: balance } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  });

  const formattedBalance = balance !== undefined
    ? Amount.fromRaw(balance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
    : null;

  return (
    <div className="flex items-center gap-3">
      {isConnected && (
        <div className="hidden sm:flex items-center gap-2">
          {/* Network badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isCorrectChain
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}>
            {isCorrectChain ? (
              <Wifi size={11} />
            ) : (
              <WifiOff size={11} />
            )}
            <span className="mono">{isCorrectChain ? 'Arc Testnet' : `Chain ${chainId}`}</span>
          </div>

          {/* USDC balance */}
          {formattedBalance !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-medium text-purple-300">
              <span className="tabular-nums">{formattedBalance} USDC</span>
            </div>
          )}

          {/* Explorer link */}
          {address && (
            <a
              href={buildAddressExplorerUrl(ARC_TESTNET_ID, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-slate-200 hover:border-white/20 transition-colors"
            >
              <span className="mono">{formatAddress(address)}</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      <ConnectKitButton
        customTheme={{
          '--ck-font-family': "'DM Sans', sans-serif",
          '--ck-primary-button-background': '#7c3aed',
          '--ck-primary-button-hover-background': '#6d28d9',
          '--ck-body-background': '#0d1b2f',
          '--ck-body-color': '#f9faf3',
          '--ck-border-radius': '12px',
        }}
      />
    </div>
  );
}

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  if (!isConnected || chainId === ARC_TESTNET_ID) return null;

  return (
    <div className="bg-red-900/30 border-b border-red-500/20 px-4 py-2 text-center">
      <p className="text-sm text-red-300">
        Wrong network. Please switch to <strong>Arc Testnet</strong> (chainId {ARC_TESTNET_ID}) to use Agent Arena.
      </p>
    </div>
  );
}

export { arcChain, usdcFact, ARC_TESTNET_ID };
