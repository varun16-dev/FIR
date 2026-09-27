export async function generateAesKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(base64);
  return await window.crypto.subtle.importKey(
    "raw",
    buffer,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptFile(file: File, key: CryptoKey): Promise<{ ciphertext: Blob, iv: string, hash: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const buffer = await file.arrayBuffer();
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    buffer
  );

  // Calculate SHA-256 hash of the ciphertext for integrity
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", encryptedBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    ciphertext: new Blob([encryptedBuffer]),
    iv: arrayBufferToBase64(iv.buffer),
    hash: hashHex
  };
}

export async function decryptFile(ciphertext: Blob, key: CryptoKey, ivBase64: string): Promise<Blob> {
  const ivBuffer = base64ToArrayBuffer(ivBase64);
  const encryptedBuffer = await ciphertext.arrayBuffer();
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
    key,
    encryptedBuffer
  );

  return new Blob([decryptedBuffer]);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function importRsaPublicKey(pemBase64: string): Promise<CryptoKey> {
  const pem = atob(pemBase64)
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\n/g, '');
  const buffer = base64ToArrayBuffer(pem);
  return await window.crypto.subtle.importKey(
    "spki",
    buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importRsaPrivateKey(pemBase64: string): Promise<CryptoKey> {
  const pem = atob(pemBase64)
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  const buffer = base64ToArrayBuffer(pem);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function wrapKeyWithRsa(aesKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<string> {
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    rawAesKey
  );
  return arrayBufferToBase64(encryptedKey);
}

export async function unwrapKeyWithRsa(wrappedKeyBase64: string, rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
  const encryptedKeyBuffer = base64ToArrayBuffer(wrappedKeyBase64);
  const rawAesKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    encryptedKeyBuffer
  );
  return await window.crypto.subtle.importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportRsaPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  const base64 = arrayBufferToBase64(exported);
  return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
}

export async function exportRsaPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  const base64 = arrayBufferToBase64(exported);
  return `-----BEGIN PRIVATE KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
}

export async function getOrCreateClientKeyPair(): Promise<{ publicKeyPem: string, privateKeyPem: string }> {
  let priv = localStorage.getItem('e3ee_private_key');
  let pub = localStorage.getItem('e3ee_public_key');
  
  if (priv && pub) {
    return { publicKeyPem: pub, privateKeyPem: priv };
  }
  
  const keyPair = await generateRsaKeyPair();
  pub = await exportRsaPublicKey(keyPair.publicKey);
  priv = await exportRsaPrivateKey(keyPair.privateKey);
  
  localStorage.setItem('e3ee_private_key', priv);
  localStorage.setItem('e3ee_public_key', pub);
  
  return { publicKeyPem: pub, privateKeyPem: priv };
}
