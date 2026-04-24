# Renachem Pharmacy POS - System Handover Guide

This guide provides a step-by-step checklist for a professional handover of the Renachem Pharmacy POS to the business owner and their staff.

---

## Step 1: Final Data Cleanup (The "Fresh Start")
Before delivery, clear all development and testing logs to ensure the owner starts with a clean slate.

1.  Log in as **Admin**.
2.  Navigate to **Settings** > **Modular Reset**.
3.  Perform **Reset Purchases** (to clear test stock intakes).
4.  Perform **Reset Sales & Reports** (to clear test transactions and credits).
5.  **Verify**: Ensure all reports (Sales, Profit/Loss, Credit) now show "No records found."

## Step 2: Pharmacy Profile Configuration
Ensure the pharmacy's official details are correctly set so they appear accurately on receipts.

1.  In **Settings**, update the following:
    *   **Pharmacy Name**: (e.g., Renachem Pharmacy)
    *   **Address / Location**: (Full street address and city)
    *   **Contact Phone**: (Official business line)
    *   **M-Pesa Till/Paybill**: (The number customers will use for payments)
2.  Click **Update Profile** to save.

## Step 3: Administrative Account Handover
Transfer full control to the owner by creating their permanent credentials.

1.  Go to **Settings** > **Staff Directory**.
2.  Click **+ Create Staff Account**.
3.  Create an account for the owner with the **Admin** role.
4.  **Deactivate** any temporary developer or testing accounts (including the default `admin` if a new one is created, or simply reset the `admin` password to a secret one chosen by the owner).
5.  **Important**: Ensure the owner tests their login before you leave.

## Step 4: Inventory Verification
Ensure the initial stock levels are accurate for the first day of business.

1.  Navigate to **Inventory**.
2.  Perform a quick spot-check of 5-10 items to verify:
    *   Medicine Name is correct.
    *   Stock Level matches physical shelf count.
    *   **Selling Price** and **Buying Price** (Cost) are set for accurate profit reporting.

## Step 5: Peripheral Setup (Printing)
Verify that the hardware is communicating correctly with the software.

1.  Connect the **Thermal Receipt Printer**.
2.  Ensure it is set as the **Default Printer** in Windows.
3.  Perform a **Test Sale** (e.g., selling 1 Paracetamol).
4.  Select **Print Thermal** and verify the receipt content is legible and formatted correctly.
5.  Perform a **Modular Reset** one last time to clear this test sale.

## Step 6: Documentation & Staff Training
Hand over the "Knowledge Package" to the pharmacy team.

1.  Show the owner the `docs` folder containing:
    *   **User_Manual.md**: For day-to-day operations.
    *   **Troubleshooting_Guide.md**: For handling errors and backups.
2.  **Training Session**:
    *   Demonstrate a full sale flow (Search -> Cart -> Checkout).
    *   Show how to record new stock intakes.
    *   Explain the **Auto-Logout** (5-minute idle timer) to the staff.

## Step 7: Final Sign-off
*   [ ] Admin login verified.
*   [ ] Pharmacy details appearing on receipts.
*   [ ] Printer successfully printing.
*   [ ] Owner understands how to restore from a backup.
*   [ ] All test data wiped.
