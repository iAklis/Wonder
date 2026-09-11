export const translationService: {
  translateHTML(service: string, source: string, target: string, text: string[][], privateRequest?: boolean, unsorted?: boolean): Promise<string[][]>;
  translateText(service: string, source: string, target: string, text: string[], privateRequest?: boolean): Promise<string[]>;
  translateSingleText(service: string, source: string, target: string, text: string, privateRequest?: boolean): Promise<string>;
};
