/* A 64-bit advisory lock id from a readable string, so call sites name what
   they are locking rather than tracking numbers. FNV-1a because it is short,
   dependency-free, and only has to spread names apart — a collision costs two
   unrelated locks waiting on each other, never incorrectness. */
const OFFSET_BASIS = 14695981039346656037n;
const PRIME = 1099511628211n;
const MASK = (1n << 64n) - 1n;

/* Postgres advisory lock ids are signed, so the upper half of the range is
   folded down rather than truncated. */
const SIGNED_LIMIT = 1n << 63n;

export const fnv1aHash = (value: string): bigint => {
  let hash = OFFSET_BASIS;

  for (const byte of Buffer.from(value, 'utf8')) {
    hash = ((hash ^ BigInt(byte)) * PRIME) & MASK;
  }

  return hash >= SIGNED_LIMIT ? hash - (1n << 64n) : hash;
};
