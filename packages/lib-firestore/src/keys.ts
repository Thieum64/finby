export function compoundId(parts: string[]): string {
  if (!parts.length) {
    throw new Error('compoundId requires at least one part');
  }
  for (const p of parts) {
    if (p.includes('_')) {
      throw new Error(`compoundId part cannot contain "_": ${p}`);
    }
  }
  return parts.join('_');
}

export function membershipKey(tenantId: string, uid: string): string {
  return compoundId([tenantId, uid]);
}
