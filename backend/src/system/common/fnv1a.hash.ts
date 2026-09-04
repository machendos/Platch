const OFFSET_BASIS = 14695981039346656037n;
const PRIME = 1099511628211n;
const MASK = (1n << 64n) - 1n;

const SIGNED_LIMIT = 1n << 63n;

export const fnv1aHash = (value: string): bigint => {
  let hash = OFFSET_BASIS;

  for (const byte of Buffer.from(value, 'utf8')) {
    hash = ((hash ^ BigInt(byte)) * PRIME) & MASK;
  }

  return hash >= SIGNED_LIMIT ? hash - (1n << 64n) : hash;
};
