import re

PASSWORD_RULE = (
    "Password must be 8-16 characters and include a lowercase letter, "
    "an uppercase letter and a number."
)


def password_error(password):
    password = str(password or "")
    if not 8 <= len(password) <= 16:
        return PASSWORD_RULE
    if not re.search(r"[a-z]", password) or not re.search(r"[A-Z]", password):
        return PASSWORD_RULE
    if not re.search(r"\d", password):
        return PASSWORD_RULE
    return None
