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
