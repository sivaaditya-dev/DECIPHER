global.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
  }
};
const pdfParse = require('pdf-parse');
const fs = require('fs');

async function run() {
  // Create a minimal fake PDF or just check if the function exists
  console.log("Extract function type:", typeof pdfParse);
  process.exit(0);
}
run();
