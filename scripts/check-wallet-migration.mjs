  ["top-up UI requires external transaction reference", topupPage.includes('id="topup-reference"') && topupPage.includes("minLength={3}") && topupPage.includes("required dir="ltr"")],\nWallet migration invariants: ${checks.length - failures}/${checks.length} passed.`);
if (failures > 0) process.exitCode = 1;
