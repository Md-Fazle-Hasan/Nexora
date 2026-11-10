LIMITS = {
    "BASIC": {"products": 50, "messages_per_min": 5},
    "PLUS": {"products": 150, "messages_per_min": 20},
    "PRO": {"products": 300, "messages_per_min": 50},
}


def plan_limits(tenant):
    return LIMITS.get(getattr(tenant, "plan", "BASIC"), LIMITS["BASIC"])


def product_limit(tenant):
    return plan_limits(tenant)["products"]


def messages_per_min(tenant):
    return plan_limits(tenant)["messages_per_min"]
