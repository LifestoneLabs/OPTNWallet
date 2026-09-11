# WizardConnect Setup for TokenSales Admin Withdrawals

This guide walks through connecting OPTN Wallet to TokenSales for admin
withdrawals using WizardConnect.

## Scope

Only `SellToken.withdraw()` needs to work via WizardConnect. After the NFT
lands in your wallet, you can **manually send** it to the destination address
(e.g., `rdth286…`) using OPTN's standard Send flow.

## Important: Branch Requirement

The production Android APK does not yet recognize `wiz://` URIs. You must run
the `feat/wizardconnect-migrate` branch (or PR #1) to use WizardConnect.

**Browser/desktop dev server is the migrate path for now.**

---

## Quick Start (Recommended: Vite Dev Server)

No Android sideload required. Run the wallet in your desktop browser:

```bash
git clone https://github.com/LifestoneLabs/OPTNWallet.git
cd OPTNWallet
# Required for dry-run: PR #1 head (WizardConnect 0.2.x lockfile + sourceOutputs revive).
# Bare feat/wizardconnect-migrate still locks 0.1.x — do not use that alone.
git fetch origin pull/1/head:pr-1-wizardconnect-ux
git checkout pr-1-wizardconnect-ux
# Alternate: merge https://github.com/LifestoneLabs/OPTNWallet/pull/1 into feat/wizardconnect-migrate first

npm install
npm run dev
```

Open the Vite URL (e.g., `http://localhost:5173`) in a desktop browser
(Chrome, Firefox, Edge).

---

## Step-by-Step Flow

### 1. Import the Admin Wallet

1. Open the Vite dev URL in your browser
2. Click **Create or Import Wallet**
3. Select **Import Existing Wallet**
4. Enter the admin mnemonic seed phrase
5. Complete the import flow

### 2. Pair with TokenSales

From the Home screen:

1. Click the **Scan QR** button (labeled "Connect" in the Quick Actions area)
2. The Connect popup appears with a text field
3. **Paste** the `wiz://` URI from the TokenSales admin dashboard
   - Use Ctrl+V / Cmd+V or right-click → Paste
4. Click **Connect**
5. A toast confirms **"WizardConnect pairing started. Approve requests from Home."**

The pairing connects in the background. Verify in **Settings → WizardConnect**.

### 3. Process a Withdraw Transaction

When you trigger `SellToken.withdraw()` in the TokenSales admin dashboard:

1. TokenSales sends a `sign_transaction_request` to OPTN Wallet
2. The **WizardConnect Sign Request** modal appears
3. Review the transaction details:
   - **DApp**: TokenSales (or the connected dApp name)
   - **Inputs**: UTXOs being spent, with TXID, index, and BCH amount
   - **Outputs**: Destination addresses and amounts
   - **Token details**: Category and amounts (for CashToken transactions)
   - **Estimated Fee**: Network fee
   - **Broadcast**: Whether the tx will be broadcast after signing
4. Click **Sign** to approve, or **Cancel** to reject

On success: **"WizardConnect transaction approved and sent."**

The NFT is now in your admin wallet.

### 4. Manually Send the NFT

After the withdraw succeeds, use OPTN's standard **Send** flow to transfer
the NFT to the final destination (e.g., `rdth286…`). This is a normal
wallet-to-address send, not a WizardConnect operation.

---

## Alternate: Native Desktop Shell (Optional)

If you want the native Tauri desktop app instead of the browser:

```bash
npm run tauri:dev
```

This requires Rust and platform-specific dependencies. For the migrate use
case, the Vite dev server in a browser is simpler.

---

## Managing Connections

### View Active Sessions

**Settings → WizardConnect** shows active sessions with dApp name and status.

### Disconnect a Session

1. Go to **Settings → WizardConnect**
2. Find the session
3. Click **Disconnect**

---

## Troubleshooting

### "No active wallet" error

Select an active wallet. Watch-only wallets cannot sign and are not
compatible with WizardConnect.

### Pairing fails or times out

1. Verify the `wiz://` URI is complete and hasn't expired
2. Check your network connection
3. Generate a new pairing URI from TokenSales

### Sign request doesn't appear

1. Ensure the WizardConnect session is still active (Settings → WizardConnect)
2. The dApp may need to resend the request
3. Keep the Home screen visible—sign requests appear as modal overlays

### Transaction rejected unexpectedly

Check the toast message. Common causes:
- Network issues during signing
- The dApp cancelled the request before you responded
- Session expired or was disconnected by the dApp
