"""
Comic Single-Issue Scanner Plugin for InvenTree
Focus: Detect and lookup single-issue comic books (floppies) via UPC barcodes.
Dry mode: Logs simulated part data without creating anything.
"""

import logging

from plugin import InvenTreePlugin
from plugin.mixins import SettingsMixin, UrlsMixin, UserInterfaceMixin

logger = logging.getLogger("inventree")


class ComicScanner(
    SettingsMixin,
    UrlsMixin,
    UserInterfaceMixin,
    InvenTreePlugin
):
    ADMIN_SOURCE = "Settings.js:renderPluginSettings"
    AUTHOR = "Just Us Brothers"
    DESCRIPTION = "Lookup comic floppies via UPC using Metron.cloud"
    LICENSE = "MIT"
    NAME = "ComicScanner"
    SETTINGS = {
        'DRY_RUN': {
            'name': 'Dry Run Mode (Default)',
            'description': 'Default state for dry run in panel (can be toggled in UI)',
            'default': True,
            'choices': [(True, 'Enabled'), (False, 'Disabled')],
        },
    }
    SLUG = "comic_scanner"
    TITLE = "Comic Scanner"
    VERSION = "0.0.1"

    def setup_urls(self):
        from django.urls import path
        from .views import (
            ComicLookupAPIView,
            ExampleView,
        )

        return [
            path('comic-lookup/', ComicLookupAPIView.as_view(), name='comic-lookup'),
            # path('plugin/comic_scanner/comic-lookup/', ComicLookupAPIView.as_view(), name='comic-lookup'),
            path("example/", ExampleView.as_view(), name="example-view"),
        ]

    def get_ui_panels(self, request, context: dict, **kwargs):
        panels = []

        if context.get("target_model") in ["part", "part.part"]:
            panels.append({
                "description": "Scan comic UPC, lookup metadata, preview or create part",
                "icon": "ti:barcode",
                "key": "comic_scanner_panel",
                "source": self.plugin_static_file("Panel.js:renderComicScannerPanel"),
                "title": "Comic Scanner",
            })

        return panels

    def shorten_series_name(self, name: str) -> str:
        if not name:
            return "UNKNOWN"
        name = name.strip().upper()
        for prefix in [
            "THE ", "A ", "AN ", "VOL. ", "VOLUME ", "SERIES ", "VOL ", "V ",
            "(2020)", "(2018)", "(2019)", "(2021)", "(2022)", "(2023)", "(2024)", "(2025)",
            "/ ", " /", "THE SHADOW / ", "BATMAN / ",
        ]:
            name = name.replace(prefix, "")
        name = "".join(c for c in name if c.isalnum())
        return name[:20]

    def scan(self, barcode_data):
        return {
            "success": True,
            "message": "Use the Comic Scanner panel on part pages for full functionality.",
        }
