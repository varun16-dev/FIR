"""DPDP Act 2023 (Digital Personal Data Protection Act) Automated PII Redaction Engine
Protects citizen, victim, and witness identities before public or media release.
"""
import re
from typing import Dict, List, Tuple, Any


class DPDPRedactor:
    """Automated PII detection and masking conforming to India's DPDP Act, 2023
    and Supreme Court guidelines on victim privacy protection.
    """

    # Regex patterns for Indian identifiers
    AADHAAR_REGEX = re.compile(r'\b([2-9]\d{3})[\s-]?(\d{4})[\s-]?(\d{4})\b')
    PHONE_REGEX = re.compile(r'(?:\+?91[\s-]?)?([6-9]\d{4})[\s-]?(\d{5})\b')
    EMAIL_REGEX = re.compile(r'\b([A-Za-z0-9._%+-]{1,3})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b')
    PAN_REGEX = re.compile(r'\b([A-Z]{5})([0-9]{4})([A-Z])\b')
    VOTER_REGEX = re.compile(r'\b([A-Z]{3})([0-9]{7})\b')
    VEHICLE_REG_REGEX = re.compile(r'\b([A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4})\b')

    @classmethod
    def redact_text(
        cls,
        text: str,
        victim_names: List[str] = None,
        custom_sensitive_terms: List[str] = None,
        mask_style: str = "PARTIAL" # "PARTIAL" (XXXX-XXXX-1234) or "FULL" ([REDACTED AADHAAR])
    ) -> Tuple[str, List[Dict[str, Any]], Dict[str, int]]:
        """Redacts sensitive PII from a given string.
        Returns (redacted_text, detected_pii_items, summary_stats).
        """
        if not text:
            return "", [], {"total_redacted": 0}

        redacted = text
        detected_items = []
        stats = {
            "aadhaar": 0,
            "phone": 0,
            "email": 0,
            "pan": 0,
            "voter_id": 0,
            "victim_name": 0,
            "total_redacted": 0,
        }

        # 1. Aadhaar Redaction
        def aadhaar_sub(match):
            stats["aadhaar"] += 1
            stats["total_redacted"] += 1
            last4 = match.group(3)
            val = match.group(0)
            replacement = f"[AADHAAR: XXXX-XXXX-{last4}]" if mask_style == "PARTIAL" else "[REDACTED AADHAAR]"
            detected_items.append({
                "type": "AADHAAR_NUMBER",
                "original_masked": f"XXXX-XXXX-{last4}",
                "replacement": replacement,
                "statutory_basis": "DPDP Act 2023 Sec 4 & UIDAI Aadhaar Act Sec 29",
            })
            return replacement

        redacted = cls.AADHAAR_REGEX.sub(aadhaar_sub, redacted)

        # 2. Phone Numbers
        def phone_sub(match):
            stats["phone"] += 1
            stats["total_redacted"] += 1
            last4 = match.group(2)[-4:]
            replacement = f"[PHONE: +91-XXXXX-X{last4}]" if mask_style == "PARTIAL" else "[REDACTED PHONE]"
            detected_items.append({
                "type": "PHONE_NUMBER",
                "original_masked": f"+91-XXXXX-X{last4}",
                "replacement": replacement,
                "statutory_basis": "DPDP Act 2023 Sec 6",
            })
            return replacement

        redacted = cls.PHONE_REGEX.sub(phone_sub, redacted)

        # 3. Email Addresses
        def email_sub(match):
            stats["email"] += 1
            stats["total_redacted"] += 1
            prefix = match.group(1)
            domain = match.group(2)
            replacement = f"[EMAIL: {prefix}***@{domain}]" if mask_style == "PARTIAL" else "[REDACTED EMAIL]"
            detected_items.append({
                "type": "EMAIL_ADDRESS",
                "original_masked": f"{prefix}***@{domain}",
                "replacement": replacement,
                "statutory_basis": "DPDP Act 2023 Sec 6",
            })
            return replacement

        redacted = cls.EMAIL_REGEX.sub(email_sub, redacted)

        # 4. PAN Number
        def pan_sub(match):
            stats["pan"] += 1
            stats["total_redacted"] += 1
            last2 = match.group(3)
            replacement = f"[PAN: XXXXX***{last2}]" if mask_style == "PARTIAL" else "[REDACTED PAN]"
            detected_items.append({
                "type": "PAN_IDENTIFIER",
                "original_masked": f"XXXXX***{last2}",
                "replacement": replacement,
                "statutory_basis": "Income Tax Act / DPDP Act 2023",
            })
            return replacement

        redacted = cls.PAN_REGEX.sub(pan_sub, redacted)

        # 5. Voter ID
        def voter_sub(match):
            stats["voter_id"] += 1
            stats["total_redacted"] += 1
            last3 = match.group(2)[-3:]
            replacement = f"[VOTER-ID: ***{last3}]" if mask_style == "PARTIAL" else "[REDACTED VOTER ID]"
            detected_items.append({
                "type": "VOTER_ID",
                "original_masked": f"***{last3}",
                "replacement": replacement,
                "statutory_basis": "Election Commission of India / DPDP Act 2023",
            })
            return replacement

        redacted = cls.VOTER_REGEX.sub(voter_sub, redacted)

        # 6. Specific Victim/Informant/Minor Names Protection
        v_list = victim_names or []
        for v in v_list:
            clean_v = v.strip()
            if len(clean_v) > 2:
                pattern = re.compile(rf'\b{re.escape(clean_v)}\b', re.IGNORECASE)
                matches = pattern.findall(redacted)
                if matches:
                    initial = clean_v[0].upper()
                    replacement = f"[PROTECTED VICTIM/WITNESS: {initial}***]"
                    redacted = pattern.sub(replacement, redacted)
                    stats["victim_name"] += len(matches)
                    stats["total_redacted"] += len(matches)
                    detected_items.append({
                        "type": "PROTECTED_PERSON_NAME",
                        "original_masked": f"{initial}***",
                        "replacement": replacement,
                        "statutory_basis": "Section 72 BNS 2023 / POCSO / DPDP Act 2023",
                    })

        # 7. Custom sensitive terms (e.g. precise victim residential flat/house numbers)
        if custom_sensitive_terms:
            for term in custom_sensitive_terms:
                clean_term = term.strip()
                if len(clean_term) > 3:
                    pattern = re.compile(rf'\b{re.escape(clean_term)}\b', re.IGNORECASE)
                    matches = pattern.findall(redacted)
                    if matches:
                        replacement = "[REDACTED ADDRESS / SENSITIVE DETAIL]"
                        redacted = pattern.sub(replacement, redacted)
                        stats["total_redacted"] += len(matches)

        return redacted, detected_items, stats
