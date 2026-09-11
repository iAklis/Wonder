const userAgent = navigator.userAgent;
const isMobile = {
  Android: /Android/i.test(userAgent), BlackBerry: /BlackBerry/i.test(userAgent),
  iOS: /iPhone|iPad|iPod/i.test(userAgent), Opera: /Opera Mini/i.test(userAgent),
  Windows: /IEMobile|WPDesktop/i.test(userAgent),
};
export const platformInfo = {
  isMac: /Mac/.test(navigator.platform || userAgent),
  isMobile: {...isMobile, any: Object.values(isMobile).some(Boolean)},
  isDesktop: {any: !Object.values(isMobile).some(Boolean)},
};
