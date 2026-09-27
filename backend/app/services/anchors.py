import os
import json
from datetime import datetime

class ExternalAnchorProvider:
    def anchor_checkpoint(self, checkpoint_data: dict) -> str:
        raise NotImplementedError
        
    def verify_anchor(self, anchor_id: str) -> dict:
        raise NotImplementedError

class DevelopmentAnchorProvider(ExternalAnchorProvider):
    """Simulates a WORM storage by writing to a local immutable-like directory."""
    def __init__(self, storage_dir: str = "/tmp/evidence_vault_anchors"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        
    def anchor_checkpoint(self, checkpoint_data: dict) -> str:
        anchor_id = f"ANC-{int(datetime.utcnow().timestamp())}-{checkpoint_data.get('checkpoint_id', 'unknown')}"
        file_path = os.path.join(self.storage_dir, f"{anchor_id}.json")
        
        # Simulate WORM - only write if it doesn't exist
        if os.path.exists(file_path):
            raise Exception("Anchor already exists")
            
        with open(file_path, "w") as f:
            json.dump(checkpoint_data, f)
            
        return anchor_id
        
    def verify_anchor(self, anchor_id: str) -> dict:
        file_path = os.path.join(self.storage_dir, f"{anchor_id}.json")
        if not os.path.exists(file_path):
            return None
        with open(file_path, "r") as f:
            return json.load(f)

# Global instance
anchor_provider = DevelopmentAnchorProvider()
