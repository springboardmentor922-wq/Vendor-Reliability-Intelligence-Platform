# VendorIQ DataCo dataset assets

- `DataCoSupplyChainDataset - DataCoSupplyChainDataset.csv` — source DataCo Supply Chain records.
- `DescriptionDataCoSupplyChain.csv` — dataset field descriptions and metadata.

The raw CSV stays in the project as source data. It is imported into PostgreSQL by `backend/import_dataset.py`; the React app uses API summaries instead of loading all rows into the browser.
