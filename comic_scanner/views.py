import logging
import os
import random
import re
import requests
import string

from datetime import date

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from part.models import Part

logger = logging.getLogger("inventree")


def strip_html(text: str) -> str:
    """Convert HTML to clean text while preserving <p> and <br> formatting."""
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<.*?>", "", text, flags=re.DOTALL)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"&#39;", "'", text)
    text = re.sub(r"&[a-zA-Z0-9#]+;", " ", text)
    text = re.sub(r"\n\s*\n", "\n\n", text)
    text = re.sub(r" +", " ", text)
    return text.strip()


try:
    import mokkari

    MOKKARI_AVAILABLE = True
    logger.info("ComicScanner: Mokkari integrated successfully")
except ImportError:
    logger.warning(
        "ComicScanner: Mokkari library absent, applying direct fallback calls"
    )
    MOKKARI_AVAILABLE = False


class ExampleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response(
            {
                "random_text": "".join(random.choices(string.ascii_letters, k=50)),
                "part_count": Part.objects.count(),
                "today": str(date.today()),
            },
            status=200,
        )


class ComicLookup(APIView):
    permission_classes = [IsAuthenticated]

    # --- BLOWN OUT CODES & SHIT ---
    PUBLISHER_CODES = {
        "Archie Comics": "ARCH",
        "Bad Idea Comics": "BAD",
        "Boom! Studios": "BOOM",
        "DC Comics": "DC",
        "Dark Horse Comics": "DHC",
        "Dynamite Comics": "DYN",
        "IDW Publishing": "IDW",
        "Image Comics": "IMG",
        "Indie Comics": "IND",
        "Mad Cave Comics": "MAD",
        "Marvel Comics": "MAR",
        "Oni Press": "ONI",
        "Valiant Entertainment": "VAL",
        "Vault Comics": "VAU",
        "Vertigo Comics": "VER",
    }

    PUBLISHER_PART_CATEGORIES = {
        "ARCH": 1,
        "BAD": 22,
        "BOOM": 1,
        "DC": 3,
        "DHC": 2,
        "DYN": 105,
        "IDW": 24,
        "IMG": 4,
        "IND": 22,
        "MAD": 108,
        "MAR": 5,
        "ONI": 107,
        "VAL": 23,
        "VAU": 109,
        "VER": 26,
    }

    PUBLISHER_UPC_PREFIXES = {
        "070989": "DC",
        "071486": "MAR",
        "59606": "MAR",
        "60196": "MAD",
        "64985": "ONI",
        "704": "IMG",
        "709": "IMG",
        "70985": "IMG",
        "72513": "DYN",
        "759606": "MAR",
        "761568": "DHC",
        "761941": "DC",
        "827": "IDW",
        "85001": "BAD",
        "85005": "VAU",
    }
    # ------------------------------

    def shorten_series_name(self, name, max_len=14):
        return "".join(c for c in name.upper() if c.isalnum())[:max_len]

    def normalize_publisher_name(self, name: str) -> str:
        if not name:
            return ""
        name = name.strip().lower()
        for suffix in [
            "entertainment",
            "publishing",
            "comics",
            "group",
            "inc",
            "llc",
            "skybound",
        ]:
            name = name.replace(suffix, "").strip()
        return " ".join(name.split())

    def post(self, request, *args, **kwargs):
        barcode = request.data.get("barcode", "")
        query = request.data.get("query", "")
        metron_id_str = request.data.get("metron_id", "")
        comic_vine_key = os.environ.get("COMICVINE_API_KEY")

        if barcode:
            barcode = "".join(c for c in str(barcode) if c.isdigit())

        if metron_id_str:
            metron_id_str = metron_id_str.strip()
            if not metron_id_str.isdigit():
                return Response(
                    {"success": False, "message": "Metron ID must be numeric"},
                    status=400,
                )
            metron_id = int(metron_id_str)
        else:
            metron_id = None

        query = query.strip() if query else ""
        mode = "none"
        if barcode:
            mode = "barcode"
        elif metron_id:
            mode = "metron_id"
        elif query:
            mode = "query"
        else:
            return Response(
                {
                    "success": False,
                    "message": "Provide either a barcode, search query, or Metron issue ID",
                },
                status=400,
            )

        user_agent = (
            "InvenTree-ComicScanner/1.0 (info@justusbrothers.shop; custom plugin)"
        )

        if mode == "barcode":
            logger.info("ComicScanner: Processing barcode %s", barcode)
            if len(barcode) < 12:
                return Response(
                    {"success": False, "message": "Invalid barcode length"}, status=400
                )

            metron_user = os.environ.get("METRON_USER")
            metron_pass = os.environ.get("METRON_PASS")
            if not metron_user or not metron_pass:
                return Response(
                    {"success": False, "message": "Metron credentials missing"},
                    status=500,
                )

            headers = {"Accept": "application/json"}
            auth = requests.auth.HTTPBasicAuth(metron_user, metron_pass)

            try:
                original_barcode = barcode
                standard_barcode = original_barcode
                base_upc = original_barcode[:12]

                if len(original_barcode) >= 17:
                    standard_barcode = original_barcode[:-2] + "11"

                test_upcs = [standard_barcode, base_upc, original_barcode]
                full_anchor = None
                issue_id = None

                if MOKKARI_AVAILABLE:
                    try:
                        api = mokkari.api(metron_user, metron_pass)
                        for test_upc in test_upcs:
                            issues = api.issues_list({"upc": test_upc})
                            if not issues:
                                issues = api.issues_list({"sku": test_upc})
                            if issues:
                                issue_id = issues[0].id
                                issue = api.issue(issue_id)
                                full_anchor = {
                                    "id": issue.id,
                                    "series": {
                                        "name": getattr(issue.series, "name", "Unknown")
                                        if issue.series
                                        else "Unknown",
                                        "volume": getattr(issue.series, "volume", None)
                                        if issue.series
                                        else None,
                                        "publisher": {
                                            "name": getattr(
                                                getattr(
                                                    issue.series, "publisher", None
                                                ),
                                                "name",
                                                "Unknown",
                                            )
                                        }
                                        if issue.series
                                        and getattr(issue.series, "publisher", None)
                                        else {},
                                    },
                                    "number": issue.number,
                                    "cover_date": issue.cover_date,
                                    "store_date": issue.store_date,
                                    "variant": getattr(issue, "variant", "")
                                    or getattr(issue, "cover", ""),
                                    "image": getattr(issue, "image", ""),
                                    "desc": getattr(issue, "desc", "")
                                    or getattr(issue, "description", ""),
                                }
                                break
                    except Exception as mk_err:
                        logger.warning(
                            "Mokkari lookup failed, falling back: %s", mk_err
                        )

                if not issue_id:
                    for test_upc in test_upcs:
                        for param in ["upc", "sku"]:
                            resp = requests.get(
                                "https://metron.cloud/api/issue/",
                                params={param: test_upc},
                                auth=auth,
                                headers=headers,
                                timeout=15,
                            )
                            if resp.status_code == 200:
                                results = resp.json().get("results", [])
                                if results:
                                    issue_id = results[0].get("id")
                                    detail_resp = requests.get(
                                        f"https://metron.cloud/api/issue/{issue_id}/",
                                        auth=auth,
                                        headers=headers,
                                        timeout=15,
                                    )
                                    detail_resp.raise_for_status()
                                    full_anchor = detail_resp.json()
                                    break
                        if issue_id:
                            break

                if not issue_id or not full_anchor:
                    return Response(
                        {
                            "success": False,
                            "message": "No issue records found for targeted barcode",
                        },
                        status=404,
                    )

                series_dict = full_anchor.get("series", {})
                series_name = series_dict.get("name", "").strip()
                volume = series_dict.get("volume")
                issue_number = full_anchor.get("number", "?")
                cover_date = full_anchor.get("cover_date")
                store_date = full_anchor.get("store_date")

                publisher_dict = series_dict.get("publisher", {})
                raw_publisher_name = publisher_dict.get("name", "Unknown Publisher")
                normalized_name = self.normalize_publisher_name(raw_publisher_name)

                pub_code = self.PUBLISHER_CODES.get(raw_publisher_name, "UNK")
                if pub_code == "UNK":
                    for known_name, code in self.PUBLISHER_CODES.items():
                        if normalized_name in self.normalize_publisher_name(known_name):
                            pub_code = code
                            break

                if pub_code == "UNK" and len(original_barcode) >= 6:
                    for prefix in sorted(
                        self.PUBLISHER_UPC_PREFIXES.keys(), key=len, reverse=True
                    ):
                        if original_barcode.startswith(prefix):
                            pub_code = self.PUBLISHER_UPC_PREFIXES[prefix]
                            break

                category = self.PUBLISHER_PART_CATEGORIES.get(pub_code, 1)
                raw_variant = (
                    full_anchor.get("variant") or full_anchor.get("cover") or ""
                ).strip()
                variant_val = (
                    raw_variant
                    if raw_variant
                    and raw_variant.lower() not in ["standard", "none", ""]
                    else "Standard"
                )
                display_suffix = (
                    f" ({raw_variant})"
                    if raw_variant
                    and raw_variant.lower() not in ["standard", "none", ""]
                    else ""
                )

                clean_description = strip_html(
                    full_anchor.get("desc") or full_anchor.get("description", "")
                )

                main_variant = {
                    "metron_id": int(full_anchor.get("id")),  # Ensure ID is an integer
                    "variant": variant_val,
                    "display_name": f"{series_name} #{issue_number}{display_suffix}",
                    "image_url": str(full_anchor.get("image", "")),
                    "description": clean_description,
                    "cover_date": str(cover_date or "Unknown"),
                    "store_date": str(store_date or "Unknown"),
                    "upc": original_barcode,
                    "is_scanned_match": True,
                }

                ipn = f"CB_{pub_code}_{self.shorten_series_name(series_name)}-{issue_number.zfill(3)}"
                if volume and str(volume) != "1":
                    ipn = f"CB_{pub_code}_{self.shorten_series_name(series_name)}_V{volume}-{issue_number.zfill(3)}"

                comic_data = {
                    "title": f"{series_name} #{issue_number}{display_suffix}",
                    "ipn_proposed": ipn,
                    "series": series_name,
                    "issue": str(issue_number),  # Ensure issue is string
                    "volume": str(volume) if volume else None,
                    "publisher": raw_publisher_name,
                    "default_category": category,
                    "pub_code": pub_code,
                    "cover_date": str(cover_date or "Unknown"),
                    "store_date": str(store_date or "Unknown"),
                    "variant": variant_val,
                    "description": clean_description,
                    "metron_url": str(
                        f"https://metron.cloud/issue/{full_anchor.get('id')}/"
                    ),
                    "metron_id": int(full_anchor.get("id")),
                    "image_url": str(full_anchor.get("image", "")),
                    "part_link": str(
                        f"https://metron.cloud/issue/{full_anchor.get('id')}/"
                    ),
                    "listed_on_whatnot": False,
                    "whatnot_price": "",
                }

                return Response(
                    {
                        "success": True,
                        "comic_data": comic_data,
                        "variants": [main_variant],
                        "scanned_barcode": original_barcode,
                        "standard_barcode_used": standard_barcode,
                        "message": "Matched base issue",
                    },
                    status=200,
                )

            except Exception as e:
                logger.exception("ComicScanner: Barcode lookup failed")
                return Response({"success": False, "message": str(e)}, status=500)

        elif mode == "metron_id":
            return Response(
                {"success": False, "message": "Metron ID execution mode absent"},
                status=400,
            )

        else:  # mode == "query"
            if not comic_vine_key:
                return Response(
                    {
                        "success": False,
                        "message": "Comic Vine API key configuration absent",
                    },
                    status=500,
                )

            try:
                search_url = "https://comicvine.gamespot.com/api/search/"
                params = {
                    "api_key": comic_vine_key,
                    "format": "json",
                    "query": query,
                    "resources": "issue",
                    "field_list": "id,name,issue_number,volume,image,description,cover_date,store_date,deck",
                    "limit": 50,
                }

                resp = requests.get(
                    search_url,
                    params=params,
                    headers={"User-Agent": user_agent},
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get("status_code") != 1 or not data.get("results"):
                    return Response(
                        {
                            "success": False,
                            "message": f"No results found for query criteria: '{query}'",
                        },
                        status=404,
                    )

                cv_issues = data["results"]
                variants_list = []
                main_variant = None

                for cv_issue in cv_issues:
                    volume_info = cv_issue.get("volume") or {}
                    series_name = volume_info.get("name", "Unknown Series").strip()
                    publisher_info = volume_info.get("publisher") or {}
                    raw_publisher_name = publisher_info.get("name", "Unknown Publisher")
                    normalized_name = self.normalize_publisher_name(raw_publisher_name)

                    pub_code = self.PUBLISHER_CODES.get(raw_publisher_name, "UNK")
                    if pub_code == "UNK":
                        for known_name, code in self.PUBLISHER_CODES.items():
                            if normalized_name in self.normalize_publisher_name(
                                known_name
                            ):
                                pub_code = code
                                break

                    issue_number = cv_issue.get("issue_number", "?")
                    raw_variant = cv_issue.get("name") or ""
                    variant_val = (
                        raw_variant
                        if raw_variant
                        and raw_variant.lower() not in ["standard", "none", ""]
                        else "Standard"
                    )
                    display_suffix = (
                        f" ({raw_variant})"
                        if raw_variant
                        and raw_variant.lower() not in ["standard", "none", ""]
                        else ""
                    )
                    display_name = f"{series_name} #{issue_number}{display_suffix}"

                    image_url = (
                        cv_issue.get("image", {}).get("medium_url")
                        or cv_issue.get("image", {}).get("small_url")
                        or ""
                    )
                    clean_desc = strip_html(
                        cv_issue.get("description") or cv_issue.get("deck") or ""
                    )

                    variant = {
                        "metron_id": cv_issue.get("id"),
                        "variant": variant_val,
                        "display_name": display_name,
                        "image_url": image_url,
                        "description": clean_desc,
                        "cover_date": cv_issue.get("cover_date") or "Unknown",
                        "store_date": cv_issue.get("store_date") or "Unknown",
                        "upc": None,
                        "is_scanned_match": False,
                    }
                    variants_list.append(variant)

                    if main_variant is None:
                        main_variant = variant
                        main_series = series_name
                        main_issue_number = issue_number
                        main_pub_code = pub_code
                        main_publisher = raw_publisher_name
                        main_cover_date = variant["cover_date"]
                        main_store_date = variant["store_date"]
                        main_description = clean_desc
                        main_image_url = image_url

                ipn = f"CB_{main_pub_code}_{self.shorten_series_name(main_series)}-{main_issue_number.zfill(3)}"

                comic_data = {
                    "title": main_variant["display_name"],
                    "ipn_proposed": ipn,
                    "series": main_series,
                    "issue": main_issue_number,
                    "volume": None,
                    "publisher": main_publisher,
                    "pub_code": main_pub_code,
                    "cover_date": main_cover_date,
                    "store_date": main_store_date,
                    "variant": main_variant["variant"],
                    "description": main_description,
                    "metron_url": "",
                    "metron_id": None,
                    "image_url": main_image_url,
                    "part_link": "",
                    "listed_on_whatnot": False,
                    "whatnot_price": "",
                }

                return Response(
                    {
                        "success": True,
                        "comic_data": comic_data,
                        "variants": variants_list,
                        "scanned_barcode": "",
                        "message": "Collected search returns for target string via Comic Vine",
                    },
                    status=200,
                )

            except Exception as e:
                logger.exception("ComicScanner: Title search failed")
                return Response({"success": False, "message": str(e)}, status=500)
