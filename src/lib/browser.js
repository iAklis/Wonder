// Firefox's chrome compatibility namespace uses callbacks; browser uses Promises.
// Keep the callback controllers intact and route new async infrastructure here.
export const asyncApi = typeof browser === 'undefined' ? chrome : browser;
