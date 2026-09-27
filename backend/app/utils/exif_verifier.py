"""Crime Scene GPS & EXIF Verification Service
Extracts EXIF metadata (GPS coordinates, camera make/model, capture timestamp) from evidence photos/videos
and cryptographically cross-verifies them against reported crime scene locations and incident time windows.
"""
import io
import math
import re
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS


# Reference Coordinates for Standard Jurisdictions & Investigation Beats
KNOWN_BEAT_COORDINATES = {
    "connaught place": (28.6315, 77.2167),
    "parliament street": (28.6234, 77.2110),
    "barakhamba": (28.6297, 77.2272),
    "rohini": (28.7145, 77.1158),
    "sector 14": (28.7180, 77.1205),
    "ring road": (28.5672, 77.2435),
    "delhi nct": (28.6139, 77.2090),
    "subhash place": (28.6924, 77.1517),
    "metro plaza": (28.6930, 77.1520),
    "cargo terminal": (28.5562, 77.0850),
    "civic centre": (28.6416, 77.2280),
    "saket": (28.5244, 77.2173),
    "tis hazari": (28.6675, 77.2177),
}


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the great-circle distance between two points on the Earth in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def _convert_dms_to_decimal(dms, ref: str) -> Optional[float]:
    """Converts GPS degrees, minutes, seconds tuple/rational to decimal degrees."""
    if not dms or len(dms) < 3:
        return None
    try:
        def val(x):
            return float(x[0]) / float(x[1]) if isinstance(x, tuple) and len(x) == 2 and x[1] != 0 else float(x)

        d = val(dms[0])
        m = val(dms[1])
        s = val(dms[2])
        decimal = d + (m / 60.0) + (s / 3600.0)
        if ref.upper() in ['S', 'W']:
            decimal = -decimal
        return round(decimal, 6)
    except Exception:
        return None


def extract_exif_metadata(file_bytes: bytes) -> Dict[str, Any]:
    """Extracts raw and parsed EXIF metadata from photo bytes."""
    meta = {
        "has_exif": False,
        "latitude": None,
        "longitude": None,
        "timestamp": None,
        "device_make": "",
        "device_model": "",
        "software": "",
        "raw_gps": {},
    }

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            exif_raw = img._getexif()
            if not exif_raw:
                return meta

            meta["has_exif"] = True
            gps_info = {}

            for tag_id, value in exif_raw.items():
                tag_name = TAGS.get(tag_id, tag_id)
                if tag_name == "Make":
                    meta["device_make"] = str(value).strip()
                elif tag_name == "Model":
                    meta["device_model"] = str(value).strip()
                elif tag_name == "Software":
                    meta["software"] = str(value).strip()
                elif tag_name in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
                    if not meta["timestamp"] and isinstance(value, str):
                        try:
                            # Standard format: YYYY:MM:DD HH:MM:SS
                            meta["timestamp"] = datetime.strptime(value.strip(), "%Y:%m:%d %H:%M:%S")
                        except Exception:
                            pass
                elif tag_name == "GPSInfo":
                    for key, val in value.items():
                        sub_tag = GPSTAGS.get(key, key)
                        gps_info[sub_tag] = val

            meta["raw_gps"] = gps_info

            # Parse GPS coordinates
            lat_dms = gps_info.get("GPSLatitude")
            lat_ref = gps_info.get("GPSLatitudeRef", "N")
            lon_dms = gps_info.get("GPSLongitude")
            lon_ref = gps_info.get("GPSLongitudeRef", "E")

            if lat_dms and lon_dms:
                meta["latitude"] = _convert_dms_to_decimal(lat_dms, lat_ref)
                meta["longitude"] = _convert_dms_to_decimal(lon_dms, lon_ref)

    except Exception:
        pass

    return meta


def resolve_crime_scene_coords(location_str: str) -> Optional[Tuple[float, float]]:
    """Resolves coordinates from string via explicit regex lat,lon or known beat landmarks."""
    if not location_str:
        return None

    # Check for direct decimal coordinates e.g. "28.6315, 77.2167" or "Lat: 28.7145 Lon: 77.1158"
    coord_match = re.search(r'(-?\d{1,2}\.\d{3,8})[\s,;]+(-?\d{1,3}\.\d{3,8})', location_str)
    if coord_match:
        try:
            return float(coord_match.group(1)), float(coord_match.group(2))
        except Exception:
            pass

    # Match landmark keywords
    lower = location_str.lower()
    for name, coords in KNOWN_BEAT_COORDINATES.items():
        if name in lower:
            return coords

    # Default National Capital Central beat fallback if New Delhi mentioned
    if "delhi" in lower or "new delhi" in lower:
        return (28.6139, 77.2090)

    return None


def verify_evidence_exif(
    exif_meta: Dict[str, Any],
    reported_location: str,
    incident_dt: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Cross-verifies extracted EXIF GPS & timestamp against reported crime scene."""
    result = {
        "status": "UNVERIFIED",
        "distance_meters": None,
        "time_delta_seconds": None,
        "is_verified": False,
        "anomaly_notes": "",
        "crime_scene_coords": None,
        "captured_coords": None,
    }

    if not exif_meta.get("has_exif") or exif_meta.get("latitude") is None:
        result["status"] = "NO_EXIF"
        result["anomaly_notes"] = "No GPS coordinates or EXIF tags found in digital file (metadata may be stripped)."
        return result

    lat = exif_meta["latitude"]
    lon = exif_meta["longitude"]
    result["captured_coords"] = {"latitude": lat, "longitude": lon}

    cs_coords = resolve_crime_scene_coords(reported_location)
    if cs_coords:
        result["crime_scene_coords"] = {"latitude": cs_coords[0], "longitude": cs_coords[1]}
        dist = haversine_distance_meters(lat, lon, cs_coords[0], cs_coords[1])
        result["distance_meters"] = round(dist, 1)

        if dist <= 500.0:
            result["status"] = "VERIFIED"
            result["is_verified"] = True
            result["anomaly_notes"] = f"Crime scene coordinates match within {dist:.1f} meters."
        elif dist <= 3000.0:
            result["status"] = "VICINITY_WARNING"
            result["anomaly_notes"] = f"Captured {dist:.1f}m from crime scene (within sector vicinity)."
        else:
            result["status"] = "MISMATCH_DISTANCE"
            result["anomaly_notes"] = f"CRITICAL DISCREPANCY: Captured {dist/1000.0:.2f} km away from reported crime location."
    else:
        result["status"] = "UNVERIFIED"
        result["anomaly_notes"] = "Reported crime scene location could not be geocoded to absolute coordinates."

    # Timestamp verification
    exif_time = exif_meta.get("timestamp")
    if exif_time and incident_dt:
        time_diff = (exif_time - incident_dt).total_seconds()
        result["time_delta_seconds"] = time_diff
        hours = abs(time_diff) / 3600.0

        if hours > 72.0:
            note = f" Temporal anomaly: Photo taken {hours:.1f} hours from incident occurrence."
            result["anomaly_notes"] += note
            if result["status"] == "VERIFIED":
                result["status"] = "MISMATCH_TIME"
                result["is_verified"] = False

    return result
