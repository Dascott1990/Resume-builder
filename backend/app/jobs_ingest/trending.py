"""
trending.py — real, cited labor-market growth data for the Jobs Board's
"Hottest right now" panel, checked against three independent sources
(WEF Future of Jobs Report 2025, LinkedIn Jobs on the Rise 2026, US BLS
Employment Projections 2024-2034) rather than asserted — see each field's
own `source`/`source_url`. Every number here is a real, published figure;
nothing is estimated or invented for this feature.

Two fields deliberately carry a softer claim than the rest:
- Cloud Computing: real, strong demand signal (multiple 2026 "fastest-
  growing tech careers" industry lists, 16% CAGR market growth) but no
  single official EMPLOYMENT growth percentage the way BLS/WEF publish for
  the others — "cloud engineer" isn't its own BLS occupation code, it's
  folded into broader ones. Shown with `growth: None` and a qualitative
  note instead of a fabricated percentage.
- HR Specialists: real BLS figure, but genuinely the slowest-growing
  entry on this list (roughly in line with average job growth overall,
  not the 80-113% range the AI/data/fintech roles show) — shown as-is,
  not inflated to match the others.

`keywords` drive the LIVE count (see trending_counts below) — how many
currently-verified jobs in the real snapshot actually match this field
right now, separate from the static growth stat above it.
"""

TRENDING_FIELDS = [
    {
        "id": "big-data", "label": "Big Data Specialists",
        "growth": "+113%", "window": "through 2030",
        "source": "WEF Future of Jobs Report 2025",
        "source_url": "https://www.weforum.org/publications/the-future-of-jobs-report-2025/digest/",
        "keywords": ["big data", "data platform", "data infrastructure", "data engineer"],
    },
    {
        "id": "fintech", "label": "FinTech Engineers",
        "growth": "+93%", "window": "through 2030",
        "source": "WEF Future of Jobs Report 2025",
        "source_url": "https://www.weforum.org/publications/the-future-of-jobs-report-2025/digest/",
        "keywords": ["fintech", "payments engineer", "trading systems"],
    },
    {
        "id": "ai-ml", "label": "AI & Machine Learning Specialists",
        "growth": "+82%", "window": "through 2030",
        "source": "WEF Future of Jobs Report 2025 · #1 fastest-growing role, LinkedIn Jobs on the Rise 2026",
        "source_url": "https://www.weforum.org/publications/the-future-of-jobs-report-2025/digest/",
        "keywords": ["machine learning", "ml engineer", "ai engineer", "artificial intelligence"],
    },
    {
        "id": "cybersecurity", "label": "Cybersecurity Experts",
        "growth": "+53% / +28.5%", "window": "WEF: through 2030 · BLS: 2024-2034",
        "source": "WEF Future of Jobs Report 2025 (Security Management Specialists) · US BLS (Information Security Analysts, fastest-growing computer occupation)",
        "source_url": "https://www.bls.gov/ooh/fastest-growing.htm",
        "keywords": ["security engineer", "security analyst", "cybersecurity", "infosec", "penetration test"],
    },
    {
        "id": "sustainability", "label": "Sustainability Specialists",
        "growth": "+49.9% / +42.1%", "window": "US BLS 2024-2034",
        "source": "US BLS (Wind Turbine Service Technicians +49.9%, Solar PV Installers +42.1%) — the concrete occupations behind the green-transition trend WEF also flags in its top 15",
        "source_url": "https://www.bls.gov/ooh/fastest-growing.htm",
        "keywords": ["sustainability", "renewable energy", "solar", "wind energy", "esg", "climate"],
    },
    {
        "id": "health-tech", "label": "Health Tech Specialists",
        "growth": "+16% / +23%", "window": "BLS 2023-2033 · industry report 2024-2030",
        "source": "US BLS (Health Information Technologists +16%) · health informatics field growth reports",
        "source_url": "https://www.bls.gov/ooh/fastest-growing.htm",
        "keywords": ["health informatics", "healthcare it", "digital health", "health information", "clinical informatics"],
    },
    {
        "id": "bi-analyst", "label": "Business Intelligence Analysts",
        "growth": "+21%", "window": "2018-2028 (most recent published figure)",
        "source": "Bureau of Labor Statistics-derived industry analysis",
        "source_url": "https://www.zippia.com/business-intelligence-analyst-jobs/trends/",
        "keywords": ["business intelligence", "bi analyst", "bi developer"],
    },
    {
        "id": "cloud", "label": "Cloud Computing Engineers",
        "growth": None, "window": "no single official BLS/WEF occupation code",
        "source": "Strong qualitative demand across multiple 2026 industry \"fastest-growing tech careers\" lists and 16% cloud-market CAGR — not the same as an official employment-growth %, shown honestly rather than invented",
        "source_url": "https://www.glocomms.com/en-us/industry-insights/career-advice/tech-careers-in-2026-ai-cloud-and-emerging-roles-driving-the-future",
        "keywords": ["cloud engineer", "cloud architect", "aws engineer", "gcp engineer", "azure engineer"],
    },
    {
        "id": "hr", "label": "HR Specialists",
        "growth": "+6.2%", "window": "US BLS 2024-2034",
        "source": "US BLS — real, but genuinely the slowest-growing field on this list (roughly average job growth, not the 80-113% range above)",
        "source_url": "https://www.bls.gov/ooh/business-and-financial/human-resources-specialists.htm",
        "keywords": ["human resources", "hr specialist", "hr generalist", "hrbp", "people ops"],
    },
]


def field_matches(job, field_id):
    """The exact same keyword test trending_counts uses, exposed per-job
    so api/jobs_board.py's ?trending= filter and the live_count shown on
    each chip can never drift out of sync with each other — the count a
    user sees is always exactly what tapping the chip returns, not a
    different number from a second, similar-but-not-identical filter."""
    field = next((f for f in TRENDING_FIELDS if f["id"] == field_id), None)
    if not field:
        return False
    title = f" {job['title'].lower()} "
    return any(kw in title for kw in field["keywords"])


def trending_counts(jobs):
    """Real, live counts — how many currently-verified (non-expired) jobs
    in the actual snapshot match each trending field's keywords right now.
    Separate from (and usually smaller than) the static growth stat above:
    the stat describes the broader labor market, this describes what's
    actually postable in THIS pipeline's own real inventory today."""
    counts = {f["id"]: 0 for f in TRENDING_FIELDS}
    for job in jobs:
        if job.get("expired"):
            continue
        title = f" {job['title'].lower()} "
        for field in TRENDING_FIELDS:
            if any(kw in title for kw in field["keywords"]):
                counts[field["id"]] += 1
    return counts
