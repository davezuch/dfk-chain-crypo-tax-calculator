# DFK Chain CryptoTaxCalculator script

Script for fetching DFK Chain transactions and processing them according to
CryptoTaxCalculator's [CSV formatting].
 
The script can by ran by invoking `node index.js <args>` where the supported
arguments are:
 
- `wallets`: comma-separated list of wallets to fetch transactions for.
- `categories`: comma-separated list of categories (see `Category` type in
`index.ts`) to filter transactions by.

E.g. usage:

```console
$ node index.js wallets=0x0...000,0x1...111
```

## Known issues

- Not all transaction types are handled, only the subset that I've encountered
for my own use. It should be pretty simple to extend the script to handle
additional types, see the `fetchTxns` function in `index.ts`.
- The output CSV is formatted to CryptoTaxCalculator's [specs][csv formatting].
It should be easy to tweak the output to match some other spec by updating the
`writeCSV` function in `index.ts`, and perhaps the `ProcessedTransfer` type in
the same module.
- CryptoTaxCalculator only groups multi-sided transactions (e.g. `Buy`/`Sell`,
`AddLiquidity`/`ReceiveLPToken`) when the to/from addresses are complimentary,
but that's not always the case in the generated data. For now, you'll need to
manually override some of the addresses for them to be grouped.

[csv formatting]: (https://help.cryptotaxcalculator.io/en/articles/5777675-advanced-manual-custom-csv-import)
