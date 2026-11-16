import type { ReactNode } from 'react';

const I = ({ children, cls, vb = '0 0 16 16' }: { children: ReactNode; cls?: string; vb?: string }) => (
  <svg className={cls} viewBox={vb} aria-hidden="true">{children}</svg>
);

export const IcoPlus = () => <I><path d="M8 3v10M3 8h10" /></I>;
export const IcoX = () => <I><path d="m4 4 8 8M12 4l-8 8" /></I>;
export const IcoMore = () => <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.2" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" /><circle cx="12.5" cy="8" r="1.2" fill="currentColor" stroke="none" /></svg>;
export const IcoEdit = () => <I><path d="M10.6 2.9a1.6 1.6 0 0 1 2.5 2.5L5.4 13.1 2 14l.9-3.4z" /><path d="m9.5 4 2.5 2.5" /></I>;
export const IcoCopy = () => <I><rect x="5.5" y="5.5" width="8" height="8" rx="1.8" /><path d="M10.5 3.5v-.2a1.8 1.8 0 0 0-1.8-1.8H3.8a1.8 1.8 0 0 0-1.8 1.8v4.9a1.8 1.8 0 0 0 1.8 1.8h.2" /></I>;
export const IcoCheck = () => <I><path d="m3.5 8.5 3 3 6-7" /></I>;
export const IcoFilter = () => <I><path d="M2 3.5h12M4.5 8h7M7 12.5h2" /></I>;
export const IcoSearch = () => <I><circle cx="7" cy="7" r="4.2" /><path d="m10.2 10.2 3.3 3.3" /></I>;
export const IcoCards = () => <I><rect x="2" y="2" width="5" height="5" rx="1.2" /><rect x="9" y="2" width="5" height="5" rx="1.2" /><rect x="2" y="9" width="5" height="5" rx="1.2" /><rect x="9" y="9" width="5" height="5" rx="1.2" /></I>;
export const IcoList = () => <I><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01" /></I>;
export const IcoUp = () => <I><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></I>;
export const IcoDown = () => <I><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" /></I>;
export const IcoTrashSm = () => <I><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></I>;
export const IcoTrash = () => <I><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.6c0 .5.5.9 1 .9h4.6c.5 0 1-.4 1-.9l.7-8.6" /></I>;
export const IcoMove = () => <I><path d="M2 4.5c0-.8.7-1.5 1.5-1.5h3l1.5 1.5h4.5c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5h-9c-.8 0-1.5-.7-1.5-1.5z" /><path d="M6.5 8.5h4M9 6.5l2 2-2 2" /></I>;
export const IcoArchive = () => <I><rect x="2" y="2.5" width="12" height="3.5" rx="1" /><path d="M3 6v6.5c0 .6.4 1 1 1h8c.6 0 1-.4 1-1V6M6.5 9h3" /></I>;
export const IcoRestore = () => <I><path d="M3 6.5h7a3.5 3.5 0 0 1 0 7H7" /><path d="M5.5 4 3 6.5 5.5 9" /></I>;
export const IcoChevron = () => <I><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></I>;
export const IcoBack = () => <I cls="gear"><path d="M13.5 8h-11M7 3.5 2.5 8 7 12.5" /></I>;
export const IcoGear = () => (
  <I cls="gear"><path d="M6.45 3.24L6.65 1.23L9.35 1.23L9.55 3.24L11.35 4.28L13.19 3.45L14.53 5.78L12.89 6.96L12.89 9.04L14.53 10.22L13.19 12.55L11.35 11.72L9.55 12.76L9.35 14.77L6.65 14.77L6.45 12.76L4.65 11.72L2.81 12.55L1.47 10.22L3.11 9.04L3.11 6.96L1.47 5.78L2.81 3.45L4.65 4.28Z" /><circle cx="8" cy="8" r="1.9" /></I>
);
export const IcoWhats = () => (
  <I cls="fill" vb="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></I>
);
export const IcoTag = () => <I><path d="M2.5 2.5h5.2l5.8 5.8-5.2 5.2-5.8-5.8z" /><path d="M5.3 5.3h.01" /></I>;
export const IcoGallery = () => <I><rect x="1.8" y="2" width="3.4" height="5" rx=".8" /><rect x="6.3" y="2" width="3.4" height="5" rx=".8" /><rect x="10.8" y="2" width="3.4" height="5" rx=".8" /><rect x="1.8" y="9" width="3.4" height="5" rx=".8" /><rect x="6.3" y="9" width="3.4" height="5" rx=".8" /><rect x="10.8" y="9" width="3.4" height="5" rx=".8" /></I>;
export const IcoOpen = () => <I><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M11.5 9.5v3c0 .6-.4 1-1 1h-7c-.6 0-1-.4-1-1v-7c0-.6.4-1 1-1h3" /></I>;
export const IcoUser = () => <I><circle cx="8" cy="5.5" r="2.8" /><path d="M2.8 14c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3" /></I>;
export const IcoPaste = () => <I><rect x="3.5" y="3" width="9" height="11" rx="1.5" /><path d="M6 3V2h4v1M6 7.5h4M6 10h3" /></I>;
export const IcoApp = () => <I><rect x="4" y="1.5" width="8" height="13" rx="1.8" /><path d="M8 4.5v5M6 7.8 8 9.8l2-2M7 12.3h2" /></I>;
