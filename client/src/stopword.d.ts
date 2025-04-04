declare module 'stopword' {
    const stopword: {
      [lang: string]: string[];
      removeStopwords: (words: string[], stopwords?: string[]) => string[];
    };
    export = stopword;
  }