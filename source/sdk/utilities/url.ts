

export function escapeUrl(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}