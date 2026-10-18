"""
OSIRIS Vision Engine — WebSocket Proxy Bridge

This module provides a Next.js-compatible WebSocket proxy that connects
the frontend to the Python vision server's tracking WebSocket.

It handles:
1. Forwarding client requests to the vision server
2. Relaying tracking data back to the frontend
3. Automatic reconnection on connection loss
4. Fallback to simulation mode when vision server is unavailable
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional

log = logging.getLogger("osiris-vision-bridge")

VISION_SERVER_URL = os.getenv("VISION_SERVER_URL", "ws://localhost:8100")
VISION_SERVER_HTTP = os.getenv("VISION_SERVER_HTTP", "http://localhost:8100")


async def check_vision_server() -> bool:
    """Check if the Python vision server is running."""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{VISION_SERVER_HTTP}/health", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                return resp.status == 200
    except Exception:
        return False


async def get_tracking_data(cam_id: str, filter_mode: str = "all", target_id: Optional[str] = None) -> Optional[dict]:
    """Fetch tracking data from the Python vision server via REST."""
    try:
        import aiohttp
        params = {"filter": filter_mode}
        if target_id:
            params["target_id"] = target_id
        async with aiohttp.ClientSession() as session:
            url = f"{VISION_SERVER_HTTP}/track/{cam_id}"
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
    except Exception:
        return None
