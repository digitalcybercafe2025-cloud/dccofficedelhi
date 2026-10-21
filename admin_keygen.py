#!/usr/bin/env python3
"""
=============================================================================
 DIGITAL CYBER CAFE — OFFICIAL OFFLINE LICENSE KEY GENERATOR (ADMIN TOOL)
=============================================================================
 Role: Expert Security Architect
 Generates cryptographic, hardware-bound 16-character activation keys
 for customers based on their Machine ID and subscription plan duration.
=============================================================================
"""

import hmac
import hashlib
import sys
import os
from datetime import datetime, timedelta

# Secret Salt matching licenseManager.js
APP_SECRET = "dcc_master_secure_2026"
SECRET_MASTER_KEY = "dcc_master_secure_2026"

PLAN_DETAILS = {
    "1": {"code": "1M", "name": "1 Month", "days": 30},
    "3": {"code": "3M", "name": "3 Months", "days": 90},
    "6": {"code": "6M", "name": "6 Months", "days": 180},
    "12": {"code": "12M", "name": "12 Months (1 Year)", "days": 365},
    "LIFE": {"code": "LIFE", "name": "Lifetime Access", "days": 3650},
}


def generate_activation_key(machine_id: str, plan_code: str = "12M") -> str:
    """
    Generates a 16-character cryptographic activation key (e.g., A1B2-C3D4-E5F6-G7H8)
    bound to the specific Machine ID and plan duration using HMAC-SHA256.
    """
    clean_mid = machine_id.strip().lower()
    clean_plan = plan_code.strip().upper()

    message = f"{clean_mid}::{clean_plan}".encode("utf-8")
    key_bytes = APP_SECRET.encode("utf-8")

    digest = hmac.new(key_bytes, message, hashlib.sha256).hexdigest().upper()

    # Form 16-character key: 4 blocks of 4 hexadecimal characters
    formatted_key = f"{digest[0:4]}-{digest[4:8]}-{digest[8:12]}-{digest[12:16]}"
    return formatted_key
    clean_plan = plan_code.strip().upper()

    message = f"{clean_mid}::{clean_plan}".encode("utf-8")
    key_bytes = SECRET_MASTER_KEY.encode("utf-8")

    digest = hmac.new(key_bytes, message, hashlib.sha256).hexdigest().upper()

    # Form 16-character key: 4 blocks of 4 hexadecimal characters
    formatted_key = f"{digest[0:4]}-{digest[4:8]}-{digest[8:12]}-{digest[12:16]}"
    return formatted_key


def copy_to_clipboard(text: str) -> bool:
    """Attempts to copy text to system clipboard (cross-platform)."""
    try:
        if sys.platform == "win32":
            import subprocess
            subprocess.run("clip", input=text.encode("utf-16"), check=True)
            return True
    except Exception:
        pass
    return False


def main():
    print("\n" + "=" * 68)
    print("      DIGITAL CYBER CAFE — ADMIN OFFLINE KEY GENERATOR (v2.0.1)")
    print("=" * 68)
    print(" Cryptographically signs hardware-bound keys for WhatsApp licensing.")
    print("=" * 68 + "\n")

    # Support CLI arguments: python admin_keygen.py <MachineID> [1|3|6|12]
    machine_id = None
    plan_choice = None

    if len(sys.argv) > 1:
        machine_id = sys.argv[1].strip()
    if len(sys.argv) > 2:
        plan_choice = sys.argv[2].strip()

    # 1. Prompt for Machine ID if not provided in args
    while not machine_id:
        try:
            val = input("1. Enter Customer's Machine ID: ").strip()
            if val:
                machine_id = val
            else:
                print("   [!] Machine ID cannot be empty. Please copy it from customer's screen.")
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(0)

    # 2. Prompt for Plan Duration if not provided in args
    if not plan_choice:
        print("\n2. Select Plan Duration:")
        print("   [1] 1 Month   (30 Days)")
        print("   [2] 3 Months  (90 Days)")
        print("   [3] 6 Months  (180 Days)")
        print("   [4] 12 Months (365 Days) — Recommended")
        print("   [5] Lifetime Access")

        choice_map = {"1": "1", "2": "3", "3": "6", "4": "12", "5": "LIFE"}

        while not plan_choice:
            try:
                sel = input("\n   Enter choice [1-5] (default: 4): ").strip()
                if not sel:
                    sel = "4"
                if sel in choice_map:
                    plan_choice = choice_map[sel]
                elif sel in PLAN_DETAILS:
                    plan_choice = sel
                else:
                    print("   [!] Invalid selection. Please enter 1, 2, 3, 4, or 5.")
            except (KeyboardInterrupt, EOFError):
                print("\nAborted.")
                sys.exit(0)

    # Normalize plan code
    normalized_choice = str(plan_choice).upper()
    if normalized_choice in ["1M", "1"]:
        plan_key = "1"
    elif normalized_choice in ["3M", "3"]:
        plan_key = "3"
    elif normalized_choice in ["6M", "6"]:
        plan_key = "6"
    elif normalized_choice in ["12M", "12", "1Y"]:
        plan_key = "12"
    elif normalized_choice in ["LIFE", "LIFETIME", "5"]:
        plan_key = "LIFE"
    else:
        plan_key = "12"

    plan_info = PLAN_DETAILS[plan_key]
    plan_code = plan_info["code"]
    plan_name = plan_info["name"]
    duration_days = plan_info["days"]

    # Calculate Expiry Date
    now = datetime.now()
    expiry_date = now + timedelta(days=duration_days)
    expiry_str = expiry_date.strftime("%d/%m/%Y")

    # 3. Generate 16-character cryptographic activation key
    activation_key = generate_activation_key(machine_id, plan_code)
    prefixed_key = f"DCC-{plan_code}-{activation_key}"

    # Copy key to clipboard
    copied = copy_to_clipboard(activation_key)

    # 4. Display Results
    print("\n" + "=" * 68)
    print("                     ACTIVATION KEY READY")
    print("=" * 68)
    print(f" Customer Machine ID : {machine_id}")
    print(f" Subscription Plan   : {plan_name}")
    print(f" Validity Days       : {duration_days} Days")
    print(f" Estimated Expiry    : {expiry_str}")
    print("-" * 68)
    print(f" 16-CHAR ACTIVATION KEY :  \033[1;32m{activation_key}\033[0m")
    print(f" FULL BACKUP KEY        :  {prefixed_key}")
    print("=" * 68)

    if copied:
        print(" [OK] 16-character key copied to clipboard!")

    # Ready-to-send WhatsApp message template
    whatsapp_msg = (
        f"Hello! Here is your official activation key for Digital Cyber Cafe:\n\n"
        f"Activation Key: {activation_key}\n"
        f"Plan: {plan_name} ({duration_days} Days)\n"
        f"Registered Machine ID: {machine_id}\n\n"
        f"Enter this key in the software lock screen and click 'Verify & Unlock'. Thank you!"
    )

    print("\n" + "-" * 68)
    print(" WHATSAPP MESSAGE TEMPLATE (Copy & paste to send to customer):")
    print("-" * 68)
    print(whatsapp_msg)
    print("-" * 68 + "\n")


if __name__ == "__main__":
    main()
