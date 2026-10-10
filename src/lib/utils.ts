import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatUSDC(raw: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole.toLocaleString()}.${fracStr}` : `${whole.toLocaleString()}`;
}

export function formatDeadline(ts: bigint): string {
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeUntil(ts: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(ts) - now;
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function isExpired(ts: bigint): boolean {
  return Number(ts) < Math.floor(Date.now() / 1000);
}

export function hashString(s: string): `0x${string}` {
  // Simple keccak-like via TextEncoder + Web Crypto for deterministic proof hashes
  // Returns a bytes32 hex for display
  const bytes = new TextEncoder().encode(s);
  let hash = 0n;
  for (let i = 0; i < bytes.length; i++) {
    hash = (hash * 31n + BigInt(bytes[i])) % (2n ** 256n);
  }
  return `0x${hash.toString(16).padStart(64, '0')}`;
}

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? '';
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.';
  if (msg.includes('insufficient')) return 'Insufficient balance. Please add USDC and try again.';
  if (msg.includes('reverted')) {
    const match = msg.match(/reason="([^"]+)"/);
    return match ? `Transaction failed: ${match[1]}` : 'Transaction failed. Please try again.';
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Check connection and retry.';
  return 'Something went wrong. Please try again.';
}
