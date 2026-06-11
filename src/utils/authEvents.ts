type Listener = () => void;

let sessionExpiredListener: Listener | null = null;

export const setSessionExpiredListener = (listener: Listener) => {
    sessionExpiredListener = listener;
};

export const notifySessionExpired = () => {
    sessionExpiredListener?.();
};