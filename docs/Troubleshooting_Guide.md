# Renachem Pharmacy POS - Troubleshooting & Maintenance Guide

This document provides solutions for common issues and technical errors that may occur during system operation.

---

## 1. General System Issues

### **App Won't Start / Stuck on Splash Screen**
*   **Cause**: Another instance of the app might be running in the background, or the database file is currently locked by another process.
*   **Solution**: 
    1.  Press `Ctrl + Shift + Esc` (Task Manager).
    2.  End any tasks named `Renachem POS` or `Electron`.
    3.  Restart the computer if the issue persists.

### **"Session Expired" Logout**
*   **Cause**: The system has a built-in security idle timer. If no activity is detected for 5 minutes, you are automatically logged out.
*   **Solution**: Simply log back in with your credentials. This is a security feature, not an error.

---

## 2. Module-Specific Troubleshooting

### **POS Billing**
#### **Receipt Not Printing**
*   **Cause**: Printer disconnected, out of paper, or the wrong printer driver is selected.
*   **Solution**: 
    1.  Check the physical connection (USB/Bluetooth).
    2.  Ensure your default printer in Windows is set to your Thermal Printer.
    3.  Try switching between "Thermal" and "A4" formats in the print prompt.

#### **M-Pesa Transaction Errors**
*   **Cause**: Invalid or duplicate M-Pesa code entered.
*   **Solution**: Verify the code from the customer's phone and ensure it hasn't already been used for another transaction.

### **Inventory & Stock**
#### **Stock Levels Not Updating After Intake**
*   **Cause**: The "Stock Receipt" was not saved, or the medicine name was misspelled during manual entry.
*   **Solution**: Always use the search/selection tool when recording stock intakes to ensure you are updating the correct record.

### **Reports (Business Intelligence)**
#### **Profit/Loss Shows "NaN" or Incorrect Figures**
*   **Cause**: Some medicines may be missing their "Cost Price" (Buying Price).
*   **Solution**: Navigate to the **Inventory** tab, edit the affected medicines, and ensure the "Buying Price" is correctly set. The system will then be able to calculate your margins accurately.

#### **Missing Sales Records**
*   **Cause**: A "Modular Reset" was recently performed by an Admin.
*   **Solution**: Check the **Audit Log** in Settings. If a reset was triggered, the data is permanently wiped as per system design for handover.

---

## 3. Administrative & Security Issues

### **Cannot Create New Staff Account**
*   **Cause**: The username already exists, or the password does not meet the 8-character minimum requirement.
*   **Solution**: Choose a unique username and ensure the password is at least 8 characters long.

### **"Access Denied" Message**
*   **Cause**: Your user account does not have the required role (e.g., a Cashier trying to access Profit Reports).
*   **Solution**: Contact your System Administrator to verify your assigned role and permissions.

---

## 4. Technical Recovery

### **Database Integrity Error**
*   **Cause**: Unexpected power failure during a database write operation.
*   **Solution**: 
    1.  The system will attempt to auto-recover from the last daily backup.
    2.  If the app fails to start, navigate to `C:\Users\Nixon\AppData\Roaming\renachem-pos\backups` and restore the most recent `.renabackup` file.

### **Reporting a New Bug**
If you encounter a recurring error:
1.  Take a screenshot of the error message.
2.  Note what action you were performing when it happened.
3.  Check the **Error Log** located in the `logs` folder within the app data directory.
