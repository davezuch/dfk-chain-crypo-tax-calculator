/**
 * Script for fetching DFK Chain transactions and processing them according to
 * CryptoTaxCalculator's [CSV formatting].
 * 
 * The script can by ran by invoking `node index.js <args>` where the supported
 * arguments are:
 * 
 * @param wallets - comma-separated list of wallets to fetch transactions for.
 * @param categories - comma-separated list of categories (see Category below)
 * to filter transactions by.
 * 
 * [csv formatting]: (https://help.cryptotaxcalculator.io/en/articles/5777675-advanced-manual-custom-csv-import)
 */
import fetch from 'node-fetch';
import * as fs from 'fs';
import util from 'util';

type Address = {
  address: string,
  name: string | undefined,
}

type Args = {
  categories: string[],
  wallets: string[],
}

enum Category {
  Airdrop = 'airdrop',
  AddLiquidity = 'add-liquidity',
  BridgeIn = 'bridge-in',
  BridgeOut = 'bridge-out',
  Buy = 'buy',
  Receive = 'receive',
  ReceiveLPToken = 'receive-lp-token',
  RemoveLiquidity = 'remove-liquidity',
  ReturnLPToken = 'return-lp-token',
  Sell = 'sell',
  Send = 'send',
  StakingDeposit = 'staking-deposit',
  StakingReward = 'staking',
  StakingWithdrawal = 'staking-withdrawal',
}

const JEWEL = {
  address: '<native>',
  decimals: 18,
  name: 'Jewel',
  symbol: 'JEWEL',
};

type Method = {
  callType: string,
  methodHash: MethodHash,
  methodName: string,
}

enum MethodHash {
  AddLiquidityNative = '0xf305d719',
  Airdrop = '0x379607f5',
  BridgeIn = '0x20d7b327',
  BridgeOut = '0x839ed90a',
  BridegOutKlaytn = '0xf3f094a1',
  BridgeInNative = '0x1cf5f07f',
  DepositLP = '0xe2bbb158',
  RemoveLiquidityNative = '0x02751cec',
  StakeCrystal = '0xa59f3e0c',
  SwapERC20 = '0x38ed1739',
  SwapNativeForERC20 = '0x7ff36ab5',
  SwapNativeForKlaytn = '0xfb3bdb41',
  TransferERC20 = '0xa9059cbb',
  UnstakeCrystal = '0x67dfd4c9',
  WithdrawLP = '0x441a3e70',
}

type Token = {
  address: string,
  decimals: number,
  name: string,
  symbol: string,
}

type Transfer = {
  from: Address,
  gas: string,
  hash: string,
  method: Method,
  status: number,
  timestamp: Date,
  to: Address,
  token: Token,
  value: string,
}

type TransferERC20 = {
  blockTimestamp: number,
  erc20Token: Token,
  from: Address,
  to: Address,
  txHash: string,
  value: string,
}

type TransferInternal = {
  blockTimestamp: number,
  from: Address,
  gasUsed: string,
  to: Address,
  txHash: string,
  value: string,
}

type TransferNative = {
  blockTimestamp: number,
  from: Address,
  gasUsed: string,
  method: Method,
  to: Address,
  txHash: string,
  txStatus: string,
  value: string,
}

type ProcessedTransfer = {
  timestamp: Date,
  type: Category,
  baseCurrency: string,
  baseAmount: string,
  feeAmount?: string,
  from: string,
  to: string,
  hash: string,
}

const apiDFK = 'https://glacier-api.avax.network/v1/chains/53935';

main();

export default async function main(): Promise<void> {
  const args = processArgs(process.argv.slice(2));
  const txns = (await Promise.all(args.wallets.map(wallet => fetchTxns(wallet, args.wallets)))).flat();
  print('txn', txns);
  console.log(`Handled ${txns.length} transfers`);
  writeCSV(txns, args.categories);
}

function addDecimal(place: number, str: string): string {
  console.log(`Adding decimal ${place} to ${str}`);
  if (str === 'NaN') {
    console.trace();
    throw `addDecimal ${place} ${str}`;
  }
  if (str.split('.').length > 1 && str.split('e').length < 2) {
    console.trace();
    throw `addDecimal ${place} ${str}`;
  }
  if (str === '0') return '';
  const [left, right] = str.split('e+');
  const unscientific = right ? addDigits(left, parseFloat(right)) : left;
  const padded = unscientific.padStart(place, '0');
  const decimal = padded.slice(-place);
  const wholeDigits = padded.length - decimal.length;
  const whole = wholeDigits > 0 ? padded.substring(0, wholeDigits) : '0';
  return `${whole}.${decimal}`;
}

function addDigits(str: string, number: number): string {
  const [left, right_] = str.split('.');
  const right = right_ === undefined ? '' : right_;
  return left + right + [...Array(number - right.length).keys()].map(_ => '0').join('');
}

async function fetchAndHandleTxnsErc20(address: string): Promise<Transfer[]> {
  const erc20s = await fetchTxnsErc20(address);
  const transfers = await Promise.all(erc20s.map(async (erc20: TransferERC20) => {
    const native = await fetchTxnNative(erc20.txHash);
    return {
      from: erc20.from,
      gas: native.gasUsed,
      hash: erc20.txHash,
      method: native.method,
      status: parseInt(native.txStatus),
      timestamp: new Date(erc20.blockTimestamp * 1000),
      to: erc20.to,
      token: erc20.erc20Token,
      value: erc20.value,
    };
  }));
  return transfers;
}

async function fetchAndHandleTxnsInternal(address: string): Promise<Transfer[]> {
  const internals = await fetchTxnsInternal(address);
  const transfers = await Promise.all(internals.map(async (internal: TransferInternal) => {
    const native = await fetchTxnNative(internal.txHash);
    return {
      from: internal.from,
      gas: internal.gasUsed,
      hash: internal.txHash,
      method: native.method,
      status: parseInt(native.txStatus),
      timestamp: new Date(internal.blockTimestamp * 1000),
      to: internal.to,
      token: JEWEL,
      value: internal.value,
    };
  }));
  return transfers;
}

async function fetchAndHandleTxnsNative(address: string): Promise<Transfer[]> {
  const natives = await fetchTxnsNative(address);
  const transfers = natives.map((native: TransferNative) => {
    return {
      from: native.from,
      gas: native.gasUsed,
      hash: native.txHash,
      method: native.method,
      status: parseInt(native.txStatus),
      timestamp: new Date(native.blockTimestamp * 1000),
      to: native.to,
      token: JEWEL,
      value: native.value,
    };
  });
  return transfers;
}

async function fetchTxn(hash: string): Promise<{ nativeTransaction: TransferNative | any }> {
  const response = await fetch(`${apiDFK}/transactions/${hash}`);
  const json = await response.json();
  // print('Full txn', json.nativeTransaction);
  return json;
}

async function fetchTxnNative(hash: string): Promise<TransferNative> {
  const json = await fetchTxn(hash);
  // print('Native txn', json.nativeTransaction);
  return json.nativeTransaction as TransferNative;
}

async function fetchTxns(address: string, wallets: string[]): Promise<ProcessedTransfer[]> {
  const transfers: Transfer[] = (
    await Promise.all([
      fetchAndHandleTxnsErc20(address),
      fetchAndHandleTxnsInternal(address),
      fetchAndHandleTxnsNative(address),
    ]))
    .flat()
    .filter(txn => txn.value !== '0')
    ;
  const grouped = transfers
    .reduce(
      (result: Map<string, Transfer[]>, transfer: Transfer) => {
        const added = result.get(transfer.hash);
        return result.set(transfer.hash, (added || []).concat(transfer));
      },
      new Map(),
    )
    ;
  const processed = Array.from(grouped)
    .map(([hash, transfers]: [string, Transfer[]]) => {
      const method: Method | null = transfers
        .reduce(
          (method: Method | null, transfer: Transfer) => {
            if (method) {
              if (method.methodHash === transfer.method.methodHash) {
                return method;
              }
              print('unmatched group', transfers);
              throw `methods didn't match`;
            }
            return transfer.method;
          },
          null
        )
        ;
      switch (method?.methodHash) {
        case MethodHash.AddLiquidityNative: return handleAddLiquidity(transfers, wallets);
        case MethodHash.Airdrop: return handleAirdrop(transfers, wallets);
        case MethodHash.BridgeIn: return handleBridgeIn(transfers, wallets);
        case MethodHash.BridgeInNative: return handleBridgeIn(transfers, wallets);
        case MethodHash.BridgeOut: return handleBridgeOut(transfers, wallets);
        case MethodHash.BridegOutKlaytn: return handleBridgeOut(transfers, wallets);
        case MethodHash.DepositLP: return handleDepositLP(transfers, wallets);
        case MethodHash.RemoveLiquidityNative: return handleRemoveLiquidityNative(transfers, wallets);
        case MethodHash.StakeCrystal: return handleTrade(transfers, wallets);
        case MethodHash.SwapERC20: return handleTrade(transfers, wallets);
        case MethodHash.SwapNativeForERC20: return handleTrade(transfers, wallets);
        case MethodHash.SwapNativeForKlaytn: return handleTradeSumNative(transfers, wallets);
        case MethodHash.TransferERC20: return handleTransfer(transfers, wallets);
        case MethodHash.UnstakeCrystal: return handleTrade(transfers, wallets);
        case MethodHash.WithdrawLP: return handleWithdrawLP(transfers, wallets);
        default:
          print('grouped', transfers);
          throw `method "${method?.methodHash}" for ${hash} not handled`;
      }
    })
    ;
  return processed.flat();
}

async function fetchTxnsErc20(address: string): Promise<TransferERC20[]> {
  const response = await fetch(`${apiDFK}/addresses/${address}/transactions:listErc20?pageSize=100`);
  const json = await response.json();
  // print('ERC20 txns', json.transactions);
  return json.transactions;
}

async function fetchTxnsInternal(address: string): Promise<TransferInternal[]> {
  const response = await fetch(`${apiDFK}/addresses/${address}/transactions:listInternals?pageSize=100`);
  const json = await response.json();
  // print('Internals txns', json.transactions);
  return json.transactions;
}

async function fetchTxnsNative(address: string): Promise<TransferNative[]> {
  const response = await fetch(`${apiDFK}/addresses/${address}/transactions:listNative?pageSize=100`);
  const json = await response.json();
  // print('Native txns', json.transactions);
  return json.transactions;
}

function handleAddLiquidity(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  if (transfers.length === 3) {
    return transfers.reduce(
      (result: ProcessedTransfer[], transfer: Transfer) => {
        if (isOwnWallet(transfer.from, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.AddLiquidity,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        else if (isOwnWallet(transfer.to, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.ReceiveLPToken,
            baseCurrency: transfer.token.name, // LP token name is more useful
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        throw `Unexpected add-liquidity`;
      },
      []
    );
  }
  throw `Unexpected number of add-liquidity`;
}

function handleAirdrop(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  return transfers.reduce(
    (result: ProcessedTransfer[], transfer: Transfer, index: number) => {
      if (isOwnWallet(transfer.to, wallets)) {
        return result.concat([{
          timestamp: transfer.timestamp,
          type: Category.Airdrop,
          baseCurrency: transfer.token.symbol,
          baseAmount: addDecimal(transfer.token.decimals, transfer.value),
          feeAmount: index ? undefined : addDecimal(JEWEL.decimals, transfer.gas),
          from: transfer.from.address,
          to: transfer.to.address,
          hash: transfer.hash,
        }]);
      }
      throw `Unexpected airdrop`;
    },
    []
  );
}

function handleBridgeIn(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  if (transfers.length < 3) {
    return transfers.reduce(
      (result: ProcessedTransfer[], transfer: Transfer) => {
        if (isOwnWallet(transfer.to, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.BridgeIn,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        print('Bridge', transfers);
        throw `Unexpected bridge`;
      },
      []
    );
  }
  print('Bridges', transfers);
  throw `Unexpected number of bridges`;
}

function handleBridgeOut(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  if (transfers.length === 1) {
    return transfers.reduce(
      (result: ProcessedTransfer[], transfer: Transfer) => {
        if (isOwnWallet(transfer.from, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.BridgeOut,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        print('Bridge', transfers);
        throw `Unexpected bridge`;
      },
      []
    );
  }
  throw `Unexpected number of bridges`;
}

function handleDepositLP(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  if (transfers.length === 1) {
    return transfers.reduce(
      (result: ProcessedTransfer[], transfer: Transfer) => {
        if (isOwnWallet(transfer.from, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.StakingDeposit,
            baseCurrency: transfer.token.name, // LP token name is more useful
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        throw `Unexpected deposits`;
      },
      []
    );
  }
  throw `Unexpected number of deposits`;
}

function handleTrade(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  if (transfers.length === 2) {
    return transfers.reduce(
      (result: ProcessedTransfer[], transfer: Transfer, index: number) => {
        if (isOwnWallet(transfer.from, wallets) && !isOwnWallet(transfer.to, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.Sell,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            feeAmount: index ? undefined : addDecimal(JEWEL.decimals, transfer.gas),
            from: transfer.from.address,
            to: transfer.from.address,
            hash: transfer.hash,
          }]);
        }
        else if (isOwnWallet(transfer.to, wallets) && !isOwnWallet(transfer.from, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.Buy,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            from: transfer.from.address,
            to: transfer.from.address,
            hash: transfer.hash,
          }]);
        }
        throw `Unexpected trades`;
      },
      []
    );
  }
  throw `Unexpected number of trades`;
}

function handleRemoveLiquidityNative(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  // print('Remove Liquidity', transfers);
  if (transfers.length === 3) {
    return transfers.reduce(
      (result: ProcessedTransfer[], transfer: Transfer) => {
        if (isOwnWallet(transfer.from, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.ReturnLPToken,
            baseCurrency: transfer.token.name, // LP token name is more useful
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        else if (isOwnWallet(transfer.to, wallets)) {
          return result.concat([{
            timestamp: transfer.timestamp,
            type: Category.RemoveLiquidity,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        print('Remove liquidity transfers', transfers);
        throw `Unexpected remove liquidity`
      },
      []
    );
  }
  throw `Unexpected number of remove liquidity`;
}

function handleWithdrawLP(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  const handled = transfers.reduce(
    (result: Map<string, ProcessedTransfer[]>, transfer: Transfer) => {
      if (isOwnWallet(transfer.to, wallets)) {
        if (transfer.token.symbol === 'JEWEL-LP') {
          return result.set(transfer.token.address, [{
            timestamp: transfer.timestamp,
            type: Category.StakingWithdrawal,
            baseCurrency: transfer.token.name, // LP token name is more useful
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
            from: transfer.from.address,
            to: transfer.from.address,
            hash: transfer.hash,
          }]);
        }
        else if (!result.get(transfer.token.address)) {
          const sum = sumTokenTransfers(transfer.token, transfers, wallets);
          if (sum < 0) {
            print('Withdraw transfers', transfers);
            throw `Reward amount less than 0: ${sum}`;
          }
          return result.set(transfer.token.address, [{
            timestamp: transfer.timestamp,
            type: Category.StakingReward,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, `${sum}`),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
      }
      return result;
    },
    new Map()
  );
  return Array.from(handled.values()).flat();
}

function handleTradeSumNative(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  if (transfers.length === 3) {
    const handled = transfers.reduce(
      (result: Map<string, ProcessedTransfer[]>, transfer: Transfer) => {
        if (isOwnWallet(transfer.from, wallets)) {
          if (transfer.token.address === JEWEL.address) {
            if (!result.get(transfer.token.address)) {
              const sum = sumTokenTransfers(JEWEL, transfers, wallets);
              if (sum > 0) {
                print('Trades', transfers);
                throw `Expected outgoing JEWEL, but sum was: ${sum}`;
              }
              return result.set(transfer.token.address, [{
                timestamp: transfer.timestamp,
                type: Category.Sell,
                baseCurrency: transfer.token.symbol,
                baseAmount: addDecimal(transfer.token.decimals, `${Math.abs(sum)}`),
                feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
                from: transfer.from.address,
                to: transfer.to.address,
                hash: transfer.hash,
              }]);
            }
            return result;
          }
          throw `Unexpected outgoing swap`;
        }
        else if (isOwnWallet(transfer.to, wallets)) {
          result.set(transfer.token.address, [{
            timestamp: transfer.timestamp,
            type: Category.Buy,
            baseCurrency: transfer.token.symbol,
            baseAmount: addDecimal(transfer.token.decimals, transfer.value),
            from: transfer.from.address,
            to: transfer.to.address,
            hash: transfer.hash,
          }]);
        }
        return result;
      },
      new Map()
    );
    return Array.from(handled.values()).flat();
  }
  throw `Unexpected Trade with summed native`;
}

function handleTransfer(transfers: Transfer[], wallets: string[]): ProcessedTransfer[] {
  if (transfers.length === 1) {
    return transfers.reduce(
      (result: ProcessedTransfer[], transfer: Transfer) => {
        if (isOwnWallet(transfer.from, wallets) && isOwnWallet(transfer.to, wallets)) {
          return result
            .concat([{
              timestamp: transfer.timestamp,
              type: Category.Send,
              baseCurrency: transfer.token.symbol,
              baseAmount: addDecimal(transfer.token.decimals, transfer.value),
              feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
              from: transfer.from.address,
              to: transfer.to.address,
              hash: transfer.hash,
            }, {
              timestamp: transfer.timestamp,
              type: Category.Receive,
              baseCurrency: transfer.token.symbol,
              baseAmount: addDecimal(transfer.token.decimals, transfer.value),
              from: transfer.from.address,
              to: transfer.to.address,
              hash: transfer.hash,
            }])
            ;
        }
        throw `Unexpected transfers`;
      },
      []
    );
  }
  throw `Unexpected number of transfers`;
}

function isOwnWallet(address: Address, wallets: string[]): boolean {
  return wallets.map(str => str.toLowerCase()).includes(address.address.toLowerCase());
}

function sumTokenTransfers(token: Token, transfers: Transfer[], wallets: string[]): number {
  return transfers.reduce(
    (sum: number, transfer: Transfer): number => {
      if (token.address === transfer.token.address) {
        const incoming = isOwnWallet(transfer.to, wallets);
        const outgoing = isOwnWallet(transfer.from, wallets);
        if (incoming && outgoing) return sum;
        if (!incoming && !outgoing) return sum;
        const amount = parseFloat(transfer.value);
        const final = incoming ? sum + amount : sum - amount;
        return final;
      }
      return sum;
    },
    0
  );
}

function print(message: string, object: any, depth: number = 2): void {
  console.log(`${message}: `);
  console.log(util.inspect(object, {
    depth,
    colors: true,
    showHidden: false,
  }));
}

function processArgs(args: string[]): Args {
  return args.reduce(
    (result: Args, input: string) => {
      const [key, value] = input.split('=');
      switch (key) {
        case 'wallets':
          const wallets = value.split(',');
          return {
            ...result,
            wallets,
          };
        case 'categories':
          const categories = value.split(',');
          return {
            ...result,
            categories,
          };
        default:
          throw `Unexpected arg: ${input}`
      }
    }, {
    categories: [],
    wallets: [],
  },
  );
}

function writeCSV(txns: ProcessedTransfer[], categories: string[]): void {
  const filename = `csv/${new Date().toISOString()}.csv`;
  const headers = [
    'Timestamp (UTC)',
    'Type',
    'Base Currency',
    'Base Amount',
    'Quote Currency',
    'Quote Amount',
    'Fee Currency (Optional)',
    'Fee Amount (Optional)',
    'From (Optional)',
    'To (Optional)',
    'Blockchain (Optional)',
    'ID (Optional)',
    'Description (Optional)',
  ].join(',');
  fs.writeFileSync(
    filename,
    [headers].concat(
      txns
        .filter(txn => categories.length ? categories.includes(txn.type) : true)
        .map(txn => [
          txn.timestamp.toISOString().substring(0, 19).replace('T', ' '),
          txn.type,
          txn.baseCurrency,
          txn.baseAmount,
          '', // quote currency
          '', // quote amount
          txn.feeAmount ? JEWEL.symbol : '',
          txn.feeAmount ? txn.feeAmount : '',
          txn.from,
          txn.to,
          'DFK Chain',
          txn.hash,
          '',
        ].join(','))
    ).join('\n')
  );
  console.log(`Wrote ${filename}`);
}