import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

console.log(`JWT_PRIVATE_KEY_BASE64=${Buffer.from(privateKey).toString("base64")}`);
console.log(`JWT_PUBLIC_KEY_BASE64=${Buffer.from(publicKey).toString("base64")}`);
