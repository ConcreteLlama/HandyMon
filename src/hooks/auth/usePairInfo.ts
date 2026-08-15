// Legacy hook — kept because PairSection imports it for the localhost check.
// The actual pairing flow now uses PairApi.createPairCode() directly.
export const usePairInfo = () => ({ data: true });
