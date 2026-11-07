# pyarrow's parquet DLL can be blocked by Windows Application Control; fall back to fastparquet.
try:
    import pyarrow.parquet  # noqa: F401
except Exception:  # pragma: no cover
    import pandas as _pd
    _pd.set_option("io.parquet.engine", "fastparquet")
