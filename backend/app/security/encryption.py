"""Fernet symmetric encryption for evidence files.

The key is loaded from ENCRYPTION_KEY in .env. If missing, a key is generated
and persisted so encrypted files remain decryptable across restarts.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_fernet: Optional[Fernet] = None


def _persist_key(key: str) -> None:
    env_path = Path(settings.BASE_DIR) / ".env"
    if not env_path.exists():
        env_path.write_text(f"ENCRYPTION_KEY={key}\n", encoding="utf-8")
        return
    text = env_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    updated = False
    out = []
    for line in lines:
        if line.startswith("ENCRYPTION_KEY="):
            out.append(f"ENCRYPTION_KEY={key}")
            updated = True
        else:
            out.append(line)
    if not updated:
        out.append(f"ENCRYPTION_KEY={key}")
    env_path.write_text("\n".join(out) + "\n", encoding="utf-8")


def get_encryption_key() -> bytes:
    key = (settings.ENCRYPTION_KEY or "").strip()
    if not key:
        key = Fernet.generate_key().decode()
        settings.ENCRYPTION_KEY = key
        try:
            _persist_key(key)
        except OSError:
            pass
    if isinstance(key, bytes):
        return key
    return key.encode()


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_encryption_key())
    return _fernet


def encrypt_file(data: bytes) -> bytes:
    """Encrypt raw file bytes with Fernet. Returns ciphertext."""
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError("encrypt_file expects bytes")
    return get_fernet().encrypt(bytes(data))


def decrypt_file(data: bytes) -> bytes:
    """Decrypt Fernet ciphertext back to original file bytes."""
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError("decrypt_file expects bytes")
    try:
        return get_fernet().decrypt(bytes(data))
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt file: invalid key or tampered ciphertext") from exc


def encrypt_and_store(data: bytes, dest_path: str) -> str:
    """Encrypt bytes and write to dest_path. Returns the basename only."""
    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
    encrypted = encrypt_file(data)
    with open(dest_path, "wb") as fh:
        fh.write(encrypted)
    return os.path.basename(dest_path)


def load_and_decrypt(storage_path: str) -> bytes:
    """Read an encrypted file from disk and decrypt it."""
    with open(storage_path, "rb") as fh:
        return decrypt_file(fh.read())
