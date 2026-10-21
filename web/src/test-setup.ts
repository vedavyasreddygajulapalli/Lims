import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
if (!Blob.prototype.arrayBuffer)
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(this);
    });
  };
