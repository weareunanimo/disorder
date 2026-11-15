export const uid = () => Math.random().toString(36).slice(2, 10);
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : n + ' ' + many);
export const hashN = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
