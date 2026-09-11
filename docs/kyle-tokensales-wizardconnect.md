# WizardConnect Setup for TokenSales Admin Withdrawals

This guide walks through connecting OPTN Wallet to TokenSales for admin
withdrawals using WizardConnect.

## Prerequisites

- OPTN Wallet with the admin wallet seed imported
- TokenSales admin dashboard access with a `wiz://` pairing URI

## Step-by-Step Flow

### 1. Import the Admin Wallet

If you haven't already, import the admin seed phrase into OPTN Wallet:

1. Open OPTN Wallet
2. Tap **Create or Import Wallet**
3. Select **Import Existing Wallet**
4. Enter the admin mnemonic seed phrase
5. Complete the import flow

### 2. Pair with TokenSales

From the Home screen:

1. Tap the **Scan QR** button (or **Connect** on desktop)
2. The Connect popup appears with a text field and camera button
3. **Paste** the `wiz://` URI from the TokenSales admin dashboard
   - On mobile: long-press the field → Paste
   - On desktop: Ctrl+V / Cmd+V or right-click → Paste
4. Tap **Connect**
5. A toast confirms **"WizardConnect pairing started. Approve requests from Home."**
6. The popup closes and the pairing connects in the background

### 3. Approve the Initial Pairing (if prompted)

If the WizardConnect panel shows a pairing approval modal:

1. Review the dApp name and connection URI
2. Tap **Approve** to confirm the connection

The pairing is now active. You can verify the connection in:
**Settings → WizardConnect** (listed under "Active WizardConnect Sessions").

### 4. Process a Withdraw Transaction

When you initiate a withdrawal in the TokenSales admin dashboard:

1. TokenSales sends a `sign_transaction_request` to OPTN Wallet
2. The **WizardConnect Sign Request** modal appears on the Home screen
3. Review the transaction details:
   - **DApp**: Shows the connected dApp name (e.g., TokenSales)
   - **Prompt**: The dApp's description of the action (if provided)
   - **Inputs**: UTXOs being spent, with TXID, index, and BCH amount
   - **Outputs**: Destination addresses and amounts
   - **Token details**: Category, fungible amounts (for CashToken transactions)
   - **Total Input / Total Output / Estimated Fee**: Summary totals
   - **Broadcast**: Whether the transaction will be broadcast after signing
4. Tap **Sign** to approve, or **Cancel** to reject

On success, a toast confirms **"WizardConnect transaction approved and sent."**

## Managing Connections

### View Active Sessions

1. Go to **Settings → WizardConnect**
2. Active sessions appear with dApp name, status, and connection details

### Disconnect a Session

1. Go to **Settings → WizardConnect**
2. Find the session you want to disconnect
3. Tap **Disconnect**

## Troubleshooting

### "No active wallet" error

Make sure you have an active wallet selected. Watch-only wallets cannot sign
transactions and are not compatible with WizardConnect.

### Pairing fails or times out

1. Verify the `wiz://` URI is complete and hasn't expired
2. Check your network connection
3. Try generating a new pairing URI from TokenSales

### Sign request doesn't appear

1. Ensure the WizardConnect session is still active (check Settings → WizardConnect)
2. The dApp may need to resend the request
3. Check that the Home screen is visible—sign requests appear as modal overlays

### Transaction rejected unexpectedly

Check the toast message for details. Common causes:
- Network issues during signing
- The dApp cancelled the request before you responded
- Session expired or was disconnected by the dApp
