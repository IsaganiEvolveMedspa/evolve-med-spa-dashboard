"""
SQL filter helpers for SQL Server (T-SQL / pymssql).

All functions return (clause_string, params_list) tuples for use in f-string SQL.
Date values are inlined as safe string literals (they originate from Python's
datetime objects or FastAPI query params validated by the routers).
Location values are always parameterised with %s (user-supplied strings).
"""

from typing import Optional


def build_date_filter(
    start: Optional[str],
    end: Optional[str],
    locations: Optional[list[str]],
    date_col: str = "sale_date",
    loc_col:  str = "center_name",
) -> tuple[str, list]:
    """
    Build a WHERE clause for sales / appointment queries.

    Returns (where_clause, params).
    Dates are inlined; location values use %s placeholders.
    """
    conditions: list[str] = []
    params:     list      = []

    if start:
        conditions.append(f"CAST({date_col} AS DATE) >= '{start}'")
    if end:
        conditions.append(f"CAST({date_col} AS DATE) <= '{end}'")
    if locations:
        placeholders = ", ".join(["%s"] * len(locations))
        conditions.append(f"{loc_col} IN ({placeholders})")
        params.extend(locations)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    return where, params


def build_sched_filter(
    s: Optional[str],
    e: Optional[str],
    locations: Optional[list[str]],
    _unused=None,
) -> tuple[str, list]:
    """
    Build a self-contained WHERE block for the employee_schedule table.

    Dates are inlined; location values use %s placeholders.
    The role + hours guard is always appended.

    Returns (filter_block_string, params_list).
    """
    conds:  list[str] = []
    params: list      = []

    if s:
        conds.append(f"CAST(date AS DATE) >= '{s}'")
    if e:
        conds.append(f"CAST(date AS DATE) <= '{e}'")
    if locations:
        placeholders = ", ".join(["%s"] * len(locations))
        conds.append(f"center_name IN ({placeholders})")
        params.extend(locations)

    conds.append("job_name IN ('Treatment Provider', 'Esthetician')")
    conds.append(is_positive_duration("scheduled_hours"))

    return "WHERE " + " AND ".join(conds), params


def hhmm_to_hours(col: str) -> str:
    """SQL expression: convert an HH:MM or HH:MM:SS varchar column to decimal hours (FLOAT).

    Robust to seconds and to non-numeric/blank cells: every component uses TRY_CAST
    (so a malformed cell contributes 0 instead of erroring the whole query — the old
    plain-CAST version threw a conversion error on any HH:MM:SS value like '1:30:00').
    Hours = text before the first ':'; minutes = the two chars after it; seconds = the
    two chars after 'MM:' (NULLIF drops an absent seconds segment for plain HH:MM)."""
    return (
        f"(CASE "
        f"WHEN {col} IS NULL OR {col} = '' THEN 0 "
        f"WHEN CHARINDEX(':', {col}) > 0 THEN "
        f"COALESCE(TRY_CAST(LEFT({col}, CHARINDEX(':', {col}) - 1) AS FLOAT), 0) "
        f"+ COALESCE(TRY_CAST(SUBSTRING({col}, CHARINDEX(':', {col}) + 1, 2) AS FLOAT), 0) / 60.0 "
        f"+ COALESCE(TRY_CAST(NULLIF(SUBSTRING({col}, CHARINDEX(':', {col}) + 4, 2), '') AS FLOAT), 0) / 3600.0 "
        f"ELSE COALESCE(TRY_CAST({col} AS FLOAT), 0) END)"
    )


def is_positive_duration(col: str) -> str:
    """SQL condition: TRUE when col is a non-null, non-zero HH:MM or numeric duration."""
    return f"({col} IS NOT NULL AND {col} NOT IN ('', '0', '0:00', '00:00'))"


def build_join_where(where: str) -> str:
    """
    Scope a sales WHERE clause to the 'sa' alias used in JOIN queries.

    Rewrites:
      CAST(sale_date AS DATE)  →  CAST(sa.sale_date AS DATE)
      center_name              →  sa.center_name
    """
    if not where:
        return ""
    return (
        where
        .replace("CAST(sale_date AS DATE)", "CAST(sa.sale_date AS DATE)")
        .replace("center_name",             "sa.center_name")
    )


def merge_params(base: list, *extra_lists: list) -> list:
    """Concatenate positional param lists (SQL Server uses %s, no dedup needed)."""
    result = list(base)
    for lst in extra_lists:
        result.extend(lst)
    return result


def loc_in(locations: Optional[list[str]], col: str = "center_name") -> tuple[str, list]:
    """
    Build an AND ... IN (%s, ...) snippet for an existing WHERE block.
    Returns ("", []) when no locations are given.
    """
    if not locations:
        return "", []
    placeholders = ", ".join(["%s"] * len(locations))
    return f"AND {col} IN ({placeholders})", list(locations)
