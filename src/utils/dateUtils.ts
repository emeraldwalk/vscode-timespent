export function now() {
  return new Date().valueOf();
}

/**
 * Convert date / time value to date only value.
 */
export function date(dateTimeValue: number): number {
  const dateTime = new Date(dateTimeValue);

  return new Date(
    dateTime.getFullYear(),
    dateTime.getMonth(),
    dateTime.getDate(),
  ).valueOf();
}

export function dateStr(dateTimeValue: unknown): string {
  if (dateTimeValue == null) {
    return '';
  }
  return new Date(Number(dateTimeValue)).toISOString().substring(0, 10);
}

export function timeStr(dateTimeValue: unknown): string {
  if (dateTimeValue == null) {
    return '';
  }
  return new Date(Number(dateTimeValue)).toISOString().substring(11, 19);
}
