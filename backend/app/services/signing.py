"""Signing Service Abstraction"""
import json
import hashlib
import base64
from datetime import datetime

class SigningService:
    def sign(self, payload: dict) -> str:
        raise NotImplementedError

    def verify(self, payload: dict, signature: str) -> bool:
        raise NotImplementedError

class DevelopmentSigner(SigningService):
    def __init__(self, secret: str = "dev_secret_key_123"):
        self.secret = secret

    def sign(self, payload: dict) -> str:
        # Development mock: HMAC-SHA256 using a static secret.
        # Production requires KMS/HSM.
        payload_str = json.dumps(payload, sort_keys=True)
        mac = hashlib.hmac.new(self.secret.encode(), payload_str.encode(), hashlib.sha256).digest() if hasattr(hashlib, 'hmac') else b''
        
        # Fallback if hmac not directly available
        if not mac:
            import hmac
            mac = hmac.new(self.secret.encode(), payload_str.encode(), hashlib.sha256).digest()

        return base64.b64encode(mac).decode('utf-8')

    def verify(self, payload: dict, signature: str) -> bool:
        expected = self.sign(payload)
        return expected == signature

# Global instance for use in prototype
signer = DevelopmentSigner()

def create_canonical_payload(operation: str, requester_id: int, target_id: str, reason: str, **kwargs) -> dict:
    """Creates a standardized dict payload to sign for critical operations."""
    payload = {
        "operation": operation,
        "requester_id": requester_id,
        "target_id": target_id,
        "reason": reason,
    }
    payload.update(kwargs)
    return payload
