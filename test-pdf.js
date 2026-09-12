// Polyfill
global.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
  }
};
const pdfParse = require('pdf-parse');
console.log("Successfully required pdf-parse!");
