"""
Comic Single-Issue Scanner Plugin for InvenTree
Focus: Detect and lookup single-issue comic books (floppies) via UPC barcodes.
Dry mode: Logs simulated part data without creating anything.
"""

import logging
import os
import requests
from requests.auth import HTTPBasicAuth

from plugin import InvenTreePlugin
from plugin.mixins import BarcodeMixin, SettingsMixin, UserInterfaceMixin

logger = logging.getLogger("inventree")


class ComicScanner(UserInterfaceMixin, BarcodeMixin, SettingsMixin, InvenTreePlugin):
    NAME = "ComicScanner"
    SLUG = "comic_scanner"
    TITLE = "Comic Scanner (Metron)"
    DESCRIPTION = "Lookup comic floppies via UPC using Metron.cloud"
    AUTHOR = "Just Us Brothers"
    VERSION = "0.0.1"

    """
    def get_ui_features(self, feature_type=None, context=None, request=None, **kwargs):
        return [
            {
                "key": "comic_discovery_modal",
                "feature": "barcode_handler",
                "title": "Comic Scanner Handler",
                "source": self.plugin_static_file('comic_scanner/comic_ui.js:handleComicScan'),
            }
        ]
    """

    def scan(self, barcode_data):
        logger.info(f"ComicScanner: Starting scan for barcode: {barcode_data}")
        
        user = os.environ.get("METRON_USER")
        password = os.environ.get("METRON_PASS")

        if not user or not password:
            logger.error("ComicScanner: METRON_USER or METRON_PASS not found in environment.")
            return {"error": "Metron credentials missing"}

        params = {"upc": barcode_data}
        url = "https://metron.cloud/api/issue/"
        headers = {"Accept": "application/json"}

        try:
            logger.debug(f"ComicScanner: Querying Metron API at {url}")
            response = requests.get(
                url,
                params=params,
                auth=HTTPBasicAuth(user, password),
                headers=headers,
                timeout=5,
            )
            
            logger.debug(f"ComicScanner: Metron Response Code: {response.status_code}")

            if response.status_code == 404:
                logger.warning(f"ComicScanner: No comic found for UPC {barcode_data}")
                return None

            data = response.json()
        except Exception as e:
            logger.exception("ComicScanner: Metron connection error")
            return {"error": str(e)}

        results = data.get("results", [])
        if not results:
            logger.info(f"ComicScanner: API returned 0 results for UPC {barcode_data}")
            return None

        issue = results[0]
        series = issue.get("series", {}).get("name", "Unknown Series")
        number = issue.get("number", "?")
        
        logger.info(f"ComicScanner: Successfully matched {series} #{number}")

        payload = {
            "success": f"Found: {series} #{number}",
            "action": "create_part",
            "part_data": {
                "name": f"{series} #{number}",
                "description": issue.get("description", "No description found."),
                "IPN": f"COMIC-{barcode_data}",
                "revision": number,
                "link": f"https://metron.cloud{issue.get('id')}/",
                "image": issue.get("image", ""),
            }
        }
        
        logger.debug(f"ComicScanner: Returning payload: {payload}")
        return payload
