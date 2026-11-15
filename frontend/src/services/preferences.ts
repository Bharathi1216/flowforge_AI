export function readSelection(userId: string): string[] | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`flowforge-repositories:${userId}`) || 'null',
    );
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : null;
  } catch {
    return null;
  }
}

export function saveSelection(userId: string, ids: string[]) {
  try {
    localStorage.setItem(`flowforge-repositories:${userId}`, JSON.stringify(ids));
  } catch {
    /* Storage is optional. */
  }
}
