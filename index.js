"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const fs = __importStar(require("fs"));
const util_1 = __importDefault(require("util"));
var Category;
(function (Category) {
    Category["Airdrop"] = "airdrop";
    Category["AddLiquidity"] = "add-liquidity";
    Category["BridgeIn"] = "bridge-in";
    Category["BridgeOut"] = "bridge-out";
    Category["Buy"] = "buy";
    Category["Receive"] = "receive";
    Category["ReceiveLPToken"] = "receive-lp-token";
    Category["RemoveLiquidity"] = "remove-liquidity";
    Category["ReturnLPToken"] = "return-lp-token";
    Category["Sell"] = "sell";
    Category["Send"] = "send";
    Category["StakingDeposit"] = "staking-deposit";
    Category["StakingReward"] = "staking";
})(Category || (Category = {}));
const JEWEL = {
    address: '<native>',
    decimals: 18,
    name: 'Jewel',
    symbol: 'JEWEL',
};
var MethodHash;
(function (MethodHash) {
    MethodHash["AddLiquidityNative"] = "0xf305d719";
    MethodHash["Airdrop"] = "0x379607f5";
    MethodHash["BridgeIn"] = "0x20d7b327";
    MethodHash["BridgeOut"] = "0x839ed90a";
    MethodHash["BridegOutKlaytn"] = "0xf3f094a1";
    MethodHash["BridgeInNative"] = "0x1cf5f07f";
    MethodHash["DepositLP"] = "0xe2bbb158";
    MethodHash["RemoveLiquidityNative"] = "0x02751cec";
    MethodHash["StakeCrystal"] = "0xa59f3e0c";
    MethodHash["SwapERC20"] = "0x38ed1739";
    MethodHash["SwapERC20ForNative"] = "";
    MethodHash["SwapNativeForERC20"] = "0x7ff36ab5";
    MethodHash["SwapNativeForKlaytn"] = "0xfb3bdb41";
    MethodHash["TransferERC20"] = "0xa9059cbb";
    MethodHash["UnstakeCrystal"] = "0x67dfd4c9";
    MethodHash["WithdrawLP"] = "0x441a3e70";
})(MethodHash || (MethodHash = {}));
const apiDFK = 'https://glacier-api.avax.network/v1/chains/53935';
main();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = processArgs(process.argv.slice(2));
        const txns = (yield Promise.all(args.wallets.map(wallet => fetchTxns(wallet, args.wallets)))).flat();
        print('txn', txns);
        console.log(`Handled ${txns.length} transfers`);
        writeCSV(txns, args.categories);
    });
}
exports.default = main;
function addDecimal(place, str) {
    console.log(`Adding decimal ${place} to ${str}`);
    if (str === 'NaN') {
        console.trace();
        throw `addDecimal ${place} ${str}`;
    }
    if (str.split('.').length > 1 && str.split('e').length < 2) {
        console.trace();
        throw `addDecimal ${place} ${str}`;
    }
    if (str === '0')
        return '';
    const [left, right] = str.split('e+');
    const unscientific = right ? addDigits(left, parseFloat(right)) : left;
    const padded = unscientific.padStart(place, '0');
    const decimal = padded.slice(-place);
    const wholeDigits = padded.length - decimal.length;
    const whole = wholeDigits > 0 ? padded.substring(0, wholeDigits) : '0';
    return `${whole}.${decimal}`;
}
function addDigits(str, number) {
    const [left, right_] = str.split('.');
    const right = right_ === undefined ? '' : right_;
    return left + right + [...Array(number - right.length).keys()].map(_ => '0').join('');
}
function fetchAndHandleTxnsErc20(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const erc20s = yield fetchTxnsErc20(address);
        const transfers = yield Promise.all(erc20s.map((erc20) => __awaiter(this, void 0, void 0, function* () {
            const native = yield fetchTxnNative(erc20.txHash);
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
        })));
        return transfers;
    });
}
function fetchAndHandleTxnsInternal(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const internals = yield fetchTxnsInternal(address);
        const transfers = yield Promise.all(internals.map((internal) => __awaiter(this, void 0, void 0, function* () {
            const native = yield fetchTxnNative(internal.txHash);
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
        })));
        return transfers;
    });
}
function fetchAndHandleTxnsNative(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const natives = yield fetchTxnsNative(address);
        const transfers = natives.map((native) => {
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
    });
}
function fetchTxn(hash) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield (0, node_fetch_1.default)(`${apiDFK}/transactions/${hash}`);
        const json = yield response.json();
        // print('Full txn', json.nativeTransaction);
        return json;
    });
}
function fetchTxnNative(hash) {
    return __awaiter(this, void 0, void 0, function* () {
        const json = yield fetchTxn(hash);
        // print('Native txn', json.nativeTransaction);
        return json.nativeTransaction;
    });
}
function fetchTxns(address, wallets) {
    return __awaiter(this, void 0, void 0, function* () {
        const transfers = (yield Promise.all([
            fetchAndHandleTxnsErc20(address),
            fetchAndHandleTxnsInternal(address),
            fetchAndHandleTxnsNative(address),
        ]))
            .flat()
            .filter(txn => txn.value !== '0');
        const grouped = transfers
            .reduce((result, transfer) => {
            const added = result.get(transfer.hash);
            return result.set(transfer.hash, (added || []).concat(transfer));
        }, new Map());
        const processed = Array.from(grouped)
            .map(([hash, transfers]) => {
            const method = transfers
                .reduce((method, transfer) => {
                if (method) {
                    if (method.methodHash === transfer.method.methodHash) {
                        return method;
                    }
                    print('unmatched group', transfers);
                    throw `methods didn't match`;
                }
                return transfer.method;
            }, null);
            switch (method === null || method === void 0 ? void 0 : method.methodHash) {
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
                case MethodHash.SwapERC20ForNative: return handleTradeTokenForNative(transfers, wallets);
                case MethodHash.SwapNativeForERC20: return handleTrade(transfers, wallets);
                case MethodHash.SwapNativeForKlaytn: return handleTradeSumNative(transfers, wallets);
                case MethodHash.TransferERC20: return handleTransfer(transfers, wallets);
                case MethodHash.UnstakeCrystal: return handleTrade(transfers, wallets);
                case MethodHash.WithdrawLP: return handleWithdrawLP(transfers, wallets);
                default:
                    print('grouped', transfers);
                    throw `method "${method === null || method === void 0 ? void 0 : method.methodHash}" for ${hash} not handled`;
            }
        });
        return processed.flat();
    });
}
function fetchTxnsErc20(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield (0, node_fetch_1.default)(`${apiDFK}/addresses/${address}/transactions:listErc20?pageSize=100`);
        const json = yield response.json();
        // print('ERC20 txns', json.transactions);
        return json.transactions;
    });
}
function fetchTxnsInternal(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield (0, node_fetch_1.default)(`${apiDFK}/addresses/${address}/transactions:listInternals?pageSize=100`);
        const json = yield response.json();
        // print('Internals txns', json.transactions);
        return json.transactions;
    });
}
function fetchTxnsNative(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield (0, node_fetch_1.default)(`${apiDFK}/addresses/${address}/transactions:listNative?pageSize=100`);
        const json = yield response.json();
        // print('Native txns', json.transactions);
        return json.transactions;
    });
}
function handleAddLiquidity(transfers, wallets) {
    if (transfers.length === 3) {
        return transfers.reduce((result, transfer) => {
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
                        baseCurrency: transfer.token.name,
                        baseAmount: addDecimal(transfer.token.decimals, transfer.value),
                        feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
                        from: transfer.from.address,
                        to: transfer.to.address,
                        hash: transfer.hash,
                    }]);
            }
            throw `Unexpected add-liquidity`;
        }, []);
    }
    throw `Unexpected number of add-liquidity`;
}
function handleAirdrop(transfers, wallets) {
    return transfers.reduce((result, transfer, index) => {
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
    }, []);
}
function handleBridgeIn(transfers, wallets) {
    if (transfers.length < 3) {
        return transfers.reduce((result, transfer) => {
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
        }, []);
    }
    print('Bridges', transfers);
    throw `Unexpected number of bridges`;
}
function handleBridgeOut(transfers, wallets) {
    if (transfers.length === 1) {
        return transfers.reduce((result, transfer) => {
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
        }, []);
    }
    throw `Unexpected number of bridges`;
}
function handleDepositLP(transfers, wallets) {
    if (transfers.length === 1) {
        return transfers.reduce((result, transfer) => {
            if (isOwnWallet(transfer.from, wallets)) {
                return result.concat([{
                        timestamp: transfer.timestamp,
                        type: Category.StakingDeposit,
                        baseCurrency: transfer.token.name,
                        baseAmount: addDecimal(transfer.token.decimals, transfer.value),
                        feeAmount: addDecimal(JEWEL.decimals, transfer.gas),
                        from: transfer.from.address,
                        to: transfer.to.address,
                        hash: transfer.hash,
                    }]);
            }
            throw `Unexpected deposits`;
        }, []);
    }
    throw `Unexpected number of deposits`;
}
function handleTrade(transfers, wallets) {
    if (transfers.length === 2) {
        return transfers.reduce((result, transfer, index) => {
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
        }, []);
    }
    throw `Unexpected number of trades`;
}
function handleRemoveLiquidityNative(transfers, wallets) {
    // print('Remove Liquidity', transfers);
    if (transfers.length === 3) {
        return transfers.reduce((result, transfer) => {
            if (isOwnWallet(transfer.from, wallets)) {
                return result.concat([{
                        timestamp: transfer.timestamp,
                        type: Category.ReturnLPToken,
                        baseCurrency: transfer.token.name,
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
            throw `Unexpected remove liquidity`;
        }, []);
    }
    throw `Unexpected number of remove liquidity`;
}
function handleWithdrawLP(transfers, wallets) {
    const handled = transfers.reduce((result, transfer) => {
        if (isOwnWallet(transfer.to, wallets)) {
            if (transfer.token.symbol === 'JEWEL-LP') {
                return result.set(transfer.token.address, [{
                        timestamp: transfer.timestamp,
                        type: Category.RemoveLiquidity,
                        baseCurrency: transfer.token.name,
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
    }, new Map);
    return Array.from(handled.values()).flat();
}
function handleTradeTokenForNative(transfers, wallets) {
    print('Trade Native', transfers);
    throw `Unexpected number of trades`;
}
function handleTradeSumNative(transfers, wallets) {
    if (transfers.length === 3) {
        const handled = transfers.reduce((result, transfer) => {
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
        }, new Map());
        return Array.from(handled.values()).flat();
    }
    throw `Unexpected Trade with summed native`;
}
function handleTransfer(transfers, wallets) {
    if (transfers.length === 1) {
        return transfers.reduce((result, transfer) => {
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
                    }]);
            }
            throw `Unexpected transfers`;
        }, []);
    }
    throw `Unexpected number of transfers`;
}
function isOwnWallet(address, wallets) {
    return wallets.map(str => str.toLowerCase()).includes(address.address.toLowerCase());
}
function sumTokenTransfers(token, transfers, wallets) {
    return transfers.reduce((sum, transfer) => {
        if (token.address === transfer.token.address) {
            const incoming = isOwnWallet(transfer.to, wallets);
            const outgoing = isOwnWallet(transfer.from, wallets);
            if (incoming && outgoing)
                return sum;
            if (!incoming && !outgoing)
                return sum;
            const amount = parseFloat(transfer.value);
            const final = incoming ? sum + amount : sum - amount;
            return final;
        }
        return sum;
    }, 0);
}
function print(message, object, depth) {
    console.log(`${message}: `);
    console.log(util_1.default.inspect(object, {
        depth,
        colors: true,
        showHidden: false,
    }));
}
function processArgs(args) {
    return args.reduce((result, input) => {
        const [key, value] = input.split('=');
        switch (key) {
            case 'wallets':
                const wallets = value.split(',');
                return Object.assign(Object.assign({}, result), { wallets });
            case 'categories':
                const categories = value.split(',');
                return Object.assign(Object.assign({}, result), { categories });
            default:
                throw `Unexpected arg: ${input}`;
        }
    }, {
        categories: [],
        wallets: [],
    });
}
function writeCSV(txns, categories) {
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
    fs.writeFileSync(filename, [headers].concat(txns
        .filter(txn => categories.length ? categories.includes(txn.type) : true)
        .map(txn => [
        txn.timestamp.toISOString().substring(0, 19).replace('T', ' '),
        txn.type,
        txn.baseCurrency,
        txn.baseAmount,
        '',
        '',
        txn.feeAmount ? JEWEL.symbol : '',
        txn.feeAmount ? txn.feeAmount : '',
        txn.from,
        txn.to,
        'DFK Chain',
        txn.hash,
        '',
    ].join(','))).join('\n'));
    console.log(`Wrote ${filename}`);
}
