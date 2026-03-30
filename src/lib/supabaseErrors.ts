export function isMissingSupabaseTableError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === 'PGRST205' || (error?.message || '').includes('Could not find the table');
}

export function isMissingSupabaseColumnError(
  error: { code?: string; message?: string } | null | undefined,
  columnName?: string,
) {
  if (!error) return false;
  if (error.code === '42703') return !columnName || (error.message || '').includes(columnName);
  return Boolean(columnName && (error.message || '').includes(`column`) && (error.message || '').includes(columnName));
}
