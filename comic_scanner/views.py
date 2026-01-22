import logging
import os
import random
import requests
import string

from datetime import date

from requests.auth import HTTPBasicAuth

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from part.models import Part

from .serializers import ExampleSerializer


logger = logging.getLogger(__name__)

DOMAIN = "https://inventree.justusbrothers.shop"


class ExampleView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ExampleSerializer

    def get(self, request, *args, **kwargs):
        response_serializer = self.serializer_class(
            data={
                "random_text": "".join(random.choices(string.ascii_letters, k=50)),
                "part_count": Part.objects.count(),
                "today": date.today(),
            }
        )

        response_serializer.is_valid(raise_exception=True)

        return Response(response_serializer.data, status=200)


class ComicLookupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    PUBLISHER_CODES = {
        "Marvel Comics": "MAR",
        "DC Comics": "DC",
        "Image Comics": "IMG",
    }

    PUBLISHER_UPC_PREFIXES = {
        "759606": "MAR",
        "761941": "DC",
    }

    def shorten_series_name(self, name, max_len=14):
        return "".join(
            c for c in name.upper()
            if c.isalnum()
        )[:max_len]

    def post(self, request, *args, **kwargs):
        barcode = request.data.get("barcode")
        user = os.environ.get("METRON_USER")
        password = os.environ.get("METRON_PASS")

        logger.info("ComicLookupAPIView: Processing barcode %s", barcode)

        if not barcode:
            return Response(
                {"success": False, "message": "No barcode provided"},
                status=400,
            )

        if not user or not password:
            logger.error("ComicLookupAPIView: METRON credentials missing")

            return Response(
                {"success": False, "message": "Metron credentials missing"},
                status=500,
            )

        headers = {
            "Accept": "application/json",
        }
        params = {
            "upc": barcode,
        }
        url = "https://metron.cloud/api/issue/"

        try:
            response = requests.get(
                url,
                params=params,
                auth=HTTPBasicAuth(user, password),
                headers=headers,
                timeout=5,
            )

            if response.status_code == 404:
                return Response(
                    {"success": False, "message": "No comic found for UPC"},
                    status=404,
                )

            response.raise_for_status()
            data = response.json()

        except Exception as e:
            logger.exception("ComicLookupAPIView: Metron API error")

            return Response(
                {"success": False, "message": str(e)},
                status=500,
            )

        results = data.get("results", [])

        if not results:
            return Response(
                {"success": False, "message": "No results from Metron"},
                status=404,
            )

        issue = results[0]

        series_dict = issue.get("series", {})
        publisher_dict = series_dict.get("publisher", {})
        publisher_name = publisher_dict.get("name", "Unknown Publisher").strip()
        series_name = series_dict.get("name", "Unknown Series").strip()
        volume = series_dict.get("volume")
        issue_number = issue.get("number", "?")
        desc = issue.get("desc") or issue.get(
            "description", "No description available."
        )
        image_url = issue.get("image", "")
        variant_name = issue.get("variant", "") or issue.get("cover", "")
        metron_id = issue.get("id")
        issue_url = (
            f"https://metron.cloud/issue/{metron_id}/" if metron_id else ""
        )
        cover_date = issue.get("cover_date", "Unknown")
        store_date = issue.get("store_date", "Unknown")

        pub_code = None
        upc_prefix_used = None

        if publisher_name and publisher_name != "Unknown Publisher":
            pub_code = self.PUBLISHER_CODES.get(
                publisher_name, publisher_name[:3].upper()
            )

        if not pub_code and len(barcode) >= 6:
            upc_prefix = barcode[:6]
            pub_code = self.PUBLISHER_UPC_PREFIXES.get(upc_prefix, "UNK")
            if pub_code != "UNK":
                upc_prefix_used = upc_prefix

        if not pub_code:
            pub_code = "UNK"

        series_short = self.shorten_series_name(series_name)

        try:
            num_clean = "".join(c for c in str(issue_number) if c.isdigit())
            num_int = int(num_clean) if num_clean else 0
            issue_padded = f"{num_int:03d}"
        except Exception:
            issue_padded = str(issue_number).replace(" ", "").upper()[:5]

        ipn = f"CB_{pub_code}_{series_short}-{issue_padded}"
        if volume and str(volume) != "1":
            ipn = f"CB_{pub_code}_{series_short}_V{volume}-{issue_padded}"

        display_name = series_name
        if volume and str(volume) != "1":
            display_name += f" Vol. {volume}"
        display_name += f" #{issue_number}"
        if variant_name:
            display_name += f" ({variant_name})"

        comic_data = {
            "title": display_name,
            "ipn_proposed": ipn,
            "series": series_name,
            "issue": issue_number,
            "volume": volume,
            "publisher": publisher_name,
            "pub_code": pub_code,
            "cover_date": cover_date,
            "store_date": store_date,
            "variant": variant_name or "Standard",
            "description": desc,
            "metron_url": issue_url,
            "metron_id": metron_id,
            "image_url": image_url,
        }

        return Response(
            {
                "success": True,
                "comic_data": comic_data,
                "message": "Comic Book Look-Up",
            },
            status=200,
        )
