// Mirrors the existing API policy; the server remains authoritative.
export const isValidNewPin = (value: string) => /^\d{6,8}$/.test(value) && !/^(\d)\1+$/.test(value);
