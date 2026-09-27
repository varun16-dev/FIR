import base64
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
import os

class KeyManagementService:
    """Base interface for key management."""
    pass

class DevelopmentKeyProvider(KeyManagementService):
    """
    Prototype implementation simulating a KMS/HSM.
    DO NOT USE IN PRODUCTION.
    Production should use AWS KMS, HashiCorp Vault, or physical HSM.
    """
    @staticmethod
    def generate_user_keypair():
        """Generates an RSA-2048 keypair. Returns (private_key_b64, public_key_b64)"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        private_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        public_key = private_key.public_key()
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return base64.b64encode(private_bytes).decode('utf-8'), base64.b64encode(public_bytes).decode('utf-8')

    @staticmethod
    def wrap_key(public_key_b64: str, aes_key_bytes: bytes) -> str:
        """Wraps (encrypts) an AES key using a recipient's public RSA key."""
        public_bytes = base64.b64decode(public_key_b64)
        public_key = serialization.load_pem_public_key(public_bytes)
        ciphertext = public_key.encrypt(
            aes_key_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return base64.b64encode(ciphertext).decode('utf-8')

    @staticmethod
    def unwrap_key(private_key_b64: str, wrapped_key_b64: str) -> bytes:
        """Unwraps (decrypts) an AES key using the recipient's private RSA key."""
        private_bytes = base64.b64decode(private_key_b64)
        private_key = serialization.load_pem_private_key(private_bytes, password=None)
        ciphertext = base64.b64decode(wrapped_key_b64)
        plaintext = private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return plaintext
