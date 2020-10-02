const {
  ProxyProvider,
  Account,
  GasLimit,
  TransactionPayload,
  Transaction,
  Address,
  Balance,
  ChainID,
  GasPrice,
} = require("@elrondnetwork/erdjs");
const config = require("./config");
const { sleep, strToHex, numToHex } = require("./utils");

let cache = [
  {
    pair: "BTC/USD",
    rate: 10510.16,
    updated: { base: 1601620927, quote: 0 },
    rawRate: { value: 10510160000000n, decimals: 9 },
  },
  {
    pair: "ETH/USD",
    rate: 344.25,
    updated: { base: 1601620927, quote: 0 },
    rawRate: { value: 344250000000n, decimals: 9 },
  },
  {
    pair: "DOT/USD",
    rate: 4.174,
    updated: { base: 1601620927, quote: 0 },
    rawRate: { value: 4174000000n, decimals: 9 },
  },
];

const getRawFromBand = async () => {
  const pairs = config.symbols.map((symbol) => `${symbol}/USD`);
  try {
    const x = await config.bandchain.getReferenceData(pairs);
    cache = [...x];
    return x;
  } catch (e) {
    console.log(e);
    console.log("Used cache instead");
    // return cache instead
    return cache;
  }
};

const getRelayData = async () => {
  const results = await getRawFromBand();
  const symbols = [...config.symbols];

  console.log("Raw price data: ");
  console.log(results);

  let relayData = "";
  for (let i = 0; i < symbols.length; i++) {
    const [base, _] = results[i].pair.split("/");
    if (base !== symbols[i]) {
      throw "Error: results are not correspond with the config";
    }

    const partial = `${strToHex(base)}@${numToHex(
      results[i].rawRate.value
    )}@${numToHex(results[i].updated.base)}@${numToHex(42)}`;

    relayData += i === 0 ? partial : `@${partial}`;
  }
  return "relay@" + relayData.toUpperCase();
};

const createTx = (account, data) =>
  new Transaction({
    nonce: account.nonce,
    receiver: new Address(config.target_contract),
    value: Balance.eGLD("0"),
    gasPrice: new GasPrice(1000000000),
    gasLimit: new GasLimit(20000000),
    data: new TransactionPayload(data),
    chainID: new ChainID(config.chain_id),
  });

const simulateRelayTx = async (relayData) => {
  console.log("🧪 Simulate Tx");

  let provider = new ProxyProvider(config.proxy_url);
  let signer = config.signer;
  account = new Account(signer.getAddress());
  await account.sync(provider);

  // simulate tx execution
  const txForSim = createTx(account, relayData);
  await signer.sign(txForSim);
  const { result: simResult } = await txForSim.simulate(provider);

  console.log(simResult);

  if (simResult.status !== "executed") {
    throw `Error: status should be executed but got ${
      simResult.status
    } with fail reason ${simResult.failReason || `""`}`;
  }
};

const relay = async (relayData) => {
  try {
    // simulate tx execution
    await simulateRelayTx(relayData);

    // send tx
    console.log("🚀 Sending Tx:");
    console.log(`From ${config.signer.getAddress()}`);

    let provider = new ProxyProvider(config.proxy_url);
    let signer = config.signer;
    account = new Account(signer.getAddress());
    await account.sync(provider);

    const tx = createTx(account, relayData);
    await signer.sign(tx);
    const txHash = await tx.send(provider);

    // waiting for node to receive tx
    const status = await (async () => {
      await sleep(1000);
      for (let i = 0; i < 10; i++) {
        try {
          const { status } = await provider.getTransactionStatus(txHash);
          return status;
        } catch (e) {
          console.log(txHash.hash, e);
        }
        await sleep(1000);
      }
      throw "Error: fail to wait for node to receive tx";
    })();

    if (status === "executed" || status === "received") {
      console.log(`✨ Tx ${txHash.hash} has been ${status}`);
      return;
    }

    throw `Error: Tx ${txHash.hash} is ${status}`;
  } catch (e) {
    console.log("🚨", e);
  }
};

(async () => {
  while (true) {
    // get relay data from band
    const relayData = await getRelayData();
    console.log("Encoded relay data: ");
    console.log(relayData);

    // send relay data to elrond
    await relay(relayData);
    await sleep(config.interval);
    console.log("=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=");
  }
})();
