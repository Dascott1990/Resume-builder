"""
categories.py — the fixed set of industry categories the dashboard filters
by, and the keyword rules that sort a raw job title into one of them.

Title-keyword matching, not the source's own category field, on purpose:
Remotive/Arbeitnow/Greenhouse/Ashby each use their own different category
vocabulary (or none at all) — normalizing all four onto one fixed list is
what makes "every category gets jobs every run" a checkable guarantee
(see pipeline.py's coverage sweep) instead of four incompatible taxonomies
bolted together.
"""

CATEGORIES = [
    "Engineering", "Design", "Product", "Data & Analytics", "Sales",
    "Marketing", "Customer Support", "Operations", "Finance", "People & HR",
]

# Checked in order — first match wins, so a more specific term (e.g.
# "customer success") should sit before a term that would otherwise also
# match a broader bucket. Lowercased comparison throughout.
_RULES = [
    ("Customer Support", ["customer support", "customer success", "support engineer", "technical support", "help desk"]),
    ("Data & Analytics", ["data scientist", "data engineer", "data analyst", "analytics", "machine learning", "ml engineer", "ai engineer", "research scientist"]),
    ("Engineering", ["engineer", "developer", "swe", "software", "backend", "frontend", "full stack", "devops", "infrastructure", "security engineer", "qa", "sre"]),
    ("Design", ["designer", "design", "ux", "ui researcher", "product design"]),
    ("Product", ["product manager", "product owner", "product lead"]),
    ("Sales", ["sales", "account executive", "account manager", "business development", "sdr", "bdr", "partnerships"]),
    ("Marketing", ["marketing", "growth", "content writer", "seo", "brand", "communications", "pr manager"]),
    ("Finance", ["finance", "accountant", "accounting", "controller", "payroll", "fp&a", "treasury"]),
    ("People & HR", ["recruiter", "recruiting", "talent", "people ops", "human resources", " hr ", "hrbp"]),
    ("Operations", ["operations", "office manager", "program manager", "logistics", "supply chain", "facilities"]),
]

# Remotive's own ?category= filter values, used only for the coverage
# fallback retry (see pipeline.py) — a targeted second pull for whichever
# of OUR categories came back empty this run, not used for normal
# categorization (title-keyword rules above are still what actually sorts
# every job, including these fallback results).
REMOTIVE_CATEGORY_FALLBACK = {
    "Engineering": "software-dev",
    "Design": "design",
    "Product": "product",
    "Data & Analytics": "data",
    "Sales": "sales-business",
    "Marketing": "marketing",
    "Customer Support": "customer-support",
    "Operations": "all-others",
    "Finance": "finance-legal",
    "People & HR": "hr",
}


def categorize(title):
    t = f" {title.lower()} "
    for category, keywords in _RULES:
        if any(kw in t for kw in keywords):
            return category
    return "Other"
