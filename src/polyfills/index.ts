export async function loadPolyfills() {
  if (typeof window === 'undefined') return;
  if (!('structuredClone' in globalThis)) await import('core-js/actual/structured-clone');
  // Array.prototype.at
  if (!('at' in Array.prototype)) await import('core-js/actual/array/at');
}
