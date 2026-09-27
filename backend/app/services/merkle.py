import hashlib
import json
from typing import List

def compute_leaf_hash(event_data: dict) -> str:
    """Compute deterministic hash for a leaf node."""
    event_str = json.dumps(event_data, sort_keys=True)
    return hashlib.sha256(event_str.encode()).hexdigest()

def compute_parent_hash(left_hash: str, right_hash: str) -> str:
    """Compute deterministic hash for a parent node from two children."""
    combined = left_hash + right_hash
    return hashlib.sha256(combined.encode()).hexdigest()

class MerkleTree:
    def __init__(self, leaves: List[str]):
        self.leaves = leaves
        self.tree = self._build_tree(leaves)

    def _build_tree(self, leaves: List[str]) -> List[List[str]]:
        if not leaves:
            return []
        
        tree = [leaves]
        current_level = leaves
        
        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                if i + 1 < len(current_level):
                    right = current_level[i + 1]
                else:
                    right = left  # Duplicate last element if odd
                next_level.append(compute_parent_hash(left, right))
            tree.append(next_level)
            current_level = next_level
            
        return tree

    @property
    def root(self) -> str:
        if not self.tree:
            return ""
        return self.tree[-1][0]
