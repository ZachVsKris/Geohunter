#!/usr/bin/env python3
"""Small deterministic smoke test for the FAOSTAT staging and strict gate."""
from __future__ import annotations

import csv
import importlib.util
import sys
import tempfile
import zipfile
from pathlib import Path

import pycountry

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("geostats_faostat_importer", ROOT / "scripts" / "import-faostat.py")
assert SPEC and SPEC.loader
IMPORTER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = IMPORTER
SPEC.loader.exec_module(IMPORTER)


def main() -> None:
    assert "Authorization" not in IMPORTER.SupabaseRest("https://example.supabase.co", "sb_secret_test").headers
    assert "Authorization" in IMPORTER.SupabaseRest("https://example.supabase.co", "legacy.jwt.key").headers
    countries = [country for country in pycountry.countries if country.alpha_3 in IMPORTER.UN_ISO3][:190]
    with tempfile.TemporaryDirectory(prefix="geostats-faostat-test-") as temporary:
        directory = Path(temporary)
        csv_path = directory / "Production_Crops_Livestock_E_All_Data_(Normalized).csv"
        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow([
                "Area Code (M49)", "Area", "Item Code (CPC)", "Item", "Element Code", "Element",
                "Year", "Unit", "Value", "Flag", "Flag Description", "Note",
            ])
            for year in (2024, 2025):
                for index, country in enumerate(countries):
                    writer.writerow([country.numeric, country.name, "0111", "Wheat", "5510", "Production", year, "t", (index + 1) * 100 + year, "A", "Official data", ""])
                    writer.writerow([country.numeric, country.name, "0991", "Clustered crop", "5510", "Production", year, "t", 100, "A", "Official data", ""])
                    writer.writerow([country.numeric, country.name, "0992", "Modeled crop", "5510", "Production", year, "t", index + year, "E", "Estimated data", ""])
            # Aggregate and missing records must not enter the warehouse snapshot.
            writer.writerow(["001", "World", "0111", "Wheat", "5510", "Production", 2025, "t", 999999, "A", "Official data", ""])
            writer.writerow([countries[0].numeric, countries[0].name, "0993", "Missing crop", "5510", "Production", 2025, "t", "", "M", "Missing value", ""])

        archive_path = directory / "qcl.zip"
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.write(csv_path, csv_path.name)
        connection, staged = IMPORTER.build_sqlite(archive_path, directory / "qcl.sqlite")
        candidates = IMPORTER.category_candidates(connection)
        connection.close()

    assert staged == 190 * 2 * 3, staged
    assert len(candidates) == 3, len(candidates)
    by_item = {candidate["item"]: candidate for candidate in candidates}
    assert by_item["Wheat"]["auto_qualified"] is True
    assert by_item["Clustered crop"]["auto_qualified"] is False
    assert by_item["Clustered crop"]["cluster"] < 70
    assert by_item["Modeled crop"]["auto_qualified"] is False
    assert by_item["Modeled crop"]["modeled_share"] == 1
    print("FAOSTAT importer smoke test passed.")


if __name__ == "__main__":
    main()


def test_catalog_never_selects_trade_archive():
    catalog = [
        {
            "dataset": "Crops and livestock products",
            "download": "https://bulks-faostat.fao.org/production/Trade_CropsLivestockIndicators_E_All_Data_(Normalized).zip",
        },
        {
            "dataset": "Production: Crops and livestock products (QCL)",
            "download": "https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip",
        },
    ]
    selected = IMPORTER.locate_qcl_zip(catalog)
    assert "Production_Crops_Livestock" in selected
    assert "Trade_" not in selected


def test_catalog_falls_back_when_only_trade_archive_exists():
    catalog = [{
        "dataset": "Trade crops and livestock indicators",
        "download": "https://bulks-faostat.fao.org/production/Trade_CropsLivestockIndicators_E_All_Data_(Normalized).zip",
    }]
    assert IMPORTER.locate_qcl_zip(catalog) == IMPORTER.FALLBACK_ZIP_URL


test_catalog_never_selects_trade_archive()
test_catalog_falls_back_when_only_trade_archive_exists()
