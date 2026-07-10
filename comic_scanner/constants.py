# comic_scanner/constants.py

# Abstract Studio
    # "Abstract Studio": "ABS",
    # "89317": "ABS",
    # "ABS": 22,

# Action Lab Comics
    # "Action Lab Comics": "ALC",
    # "78430": "ALC",
    # "ALC": 22,

# Iron Age Comics
    # "Iron Age Comics": "IAC",
    # "60554": "IAC",
    # "IAC": 22,

# Midnight Factory
    # "Midnight Factory": "MID",
    # "78200": "MID",
    # "MID": 22,

PUBLISHER_CODES = {
    "Abstract Studio": "ABS",
    "Action Lab Comics": "ALC",
    "Archie Comics": "ARCH",
    "Bad Idea Comics": "BAD",
    "Boom! Studios": "BOOM",
    "DC Comics": "DC",
    "Devil's Due Comics": "DD",
    "Dark Horse Comics": "DHC",
    "Dynamite Comics": "DYN",
    "IDW Publishing": "IDW",
    "Image Comics": "IMG",
    "Indie Comics": "IND",
    "Iron Age Comics": "IAC",
    "Keenspot": "KS",
    "Mad Cave Comics": "MAD",
    "Marvel Comics": "MAR",
    "Midnight Factory": "MID",
    "Oni Press": "ONI",
    "Valiant Entertainment": "VAL",
    "Vault Comics": "VAU",
    "Vertigo Comics": "VER",
}

PUBLISHER_UPC_PREFIXES = {
    "070989": "DC",
    "071486": "MAR",
    "59606": "MAR",
    "60196": "MAD",
    "60283": "KS",
    "60554": "IAC",
    "64985": "ONI",
    "68267": "DD",
    "704": "IMG",
    "709": "IMG",
    "70985": "IMG",
    "72513": "DYN",
    "759606": "MAR",
    "761568": "DHC",
    "761941": "DC",
    "78200": "MID",
    "78430": "ALC",
    "827": "IDW",
    "85001": "BAD",
    "85005": "VAU",
    "89317": "ABS",
}

PUBLISHER_PART_CATEGORIES = {
    "ABS": 22,
    "ALC": 22,
    "ARCH": 1,
    "BAD": 22,
    "BOOM": 1,
    "DC": 3,
    "DD": 22,
    "DHC": 2,
    "DYN": 105,
    "IAC": 22,
    "IDW": 24,
    "IMG": 4,
    "IND": 22,
    "KS": 110,
    "MAD": 108,
    "MAR": 5,
    "MID": 22,
    "ONI": 107,
    "VAL": 23,
    "VAU": 109,
    "VER": 26,
}

# Used to cleanly build lists for UI dropdowns dynamically
CATEGORIES_LIST = [
    {"id": 1, "name": "Archie Comics (ARCH)"},
    {"id": 2, "name": "Dark Horse Comics (DHC)"},
    {"id": 3, "name": "DC Comics (DC)"},
    {"id": 4, "name": "Image Comics (IMG)"},
    {"id": 5, "name": "Marvel Comics (MAR)"},
    {"id": 22, "name": "Indie / Bad Idea / Devil's Due (IND/BAD/DD)"},
    {"id": 23, "name": "Valiant Entertainment (VAL)"},
    {"id": 24, "name": "IDW Publishing (IDW)"},
    {"id": 26, "name": "Vertigo Comics (VER)"},
    {"id": 105, "name": "Dynamite Entertainment (DYN)"},
    {"id": 107, "name": "Oni Press (ONI)"},
    {"id": 108, "name": "Mad Cave Comics (MAD)"},
    {"id": 109, "name": "Vault Comics (VAU)"},
    {"id": 110, "name": "Keenspot (KS)"}
]

LOCATIONS_LIST = [
    {"id": 66, "name": "Marvel Bin (66)"},
    {"id": 70, "name": "Image Bin (70)"},
    {"id": 73, "name": "Dark Horse Bin (73)"},
    {"id": 76, "name": "IDW Bin (76)"},
    {"id": 80, "name": "Valiant Bin (80)"},
    {"id": 82, "name": "Indie / Studio Boxes (82)"},
    {"id": 84, "name": "Vertigo Storage (84)"},
    {"id": 91, "name": "DC Bin (91)"},
    {"id": 94, "name": "Dynamite Bin (94)"},
    {"id": 97, "name": "Oni Press Bin (97)"},
    {"id": 98, "name": "Mad Cave Bin (98)"},
    {"id": 99, "name": "Vault Bin (99)"},
    {"id": 100, "name": "Keenspot Bin (100)"}
]
