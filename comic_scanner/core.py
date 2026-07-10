import logging
from django.urls import path

from plugin import InvenTreePlugin
from plugin.mixins import UrlsMixin, UserInterfaceMixin

logger = logging.getLogger("inventree")

PLUGIN_VERSION = "1.0.0"


class ComicScannerPlugin(UrlsMixin, UserInterfaceMixin, InvenTreePlugin):
    TITLE = "ComicScanner"
    NAME = "ComicScanner"
    SLUG = "comic_scanner"
    VERSION = PLUGIN_VERSION

    # Optional Metadata
    DESCRIPTION = "Lookup comic floppies via UPC using Metron.cloud"
    AUTHOR = "Just Us Brothers"
    WEBSITE = "https://justusbrothers.shop"
    LICENSE = "MIT"

    def setup_urls(self):
        """
        Register the URLs for the plugin.
        Note: The .views import is kept inside here to avoid
        circular import issues during startup.
        """
        from .views import ComicLookup as ComicLookupView

        return [path("comic-lookup/", ComicLookupView.as_view(), name="comic-lookup")]

    def get_ui_panels(self, request, context: dict, **kwargs):
        panels = []

        if context.get("target_model") in ["part", "part.part"]:
            panels.append({
                "description": "Scan comic UPC, lookup metadata, preview or create part",
                "icon": "ti:mood-smile:outline",
                "key": "comic_scanner_panel",
                "source": self.plugin_static_file("Panel.js:renderComicScannerPanel"),
                "title": "Comic Scanner",
            })
        return panels

    def scan(self, barcode_data):
        return {
            "success": True,
            "message": "Use the Comic Scanner panel on part pages for full functionality.",
        }
