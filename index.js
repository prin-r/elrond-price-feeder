const {
  Address,
  ProxyProvider,
  NetworkConfig,
  BackendSigner,
  SimpleSigner,
  GasLimit,
  SmartContract,
  ContractFunction,
  Argument,
} = require("@elrondnetwork/erdjs");

const axios = require("axios");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const E9 = "1000000000";
const symbols = process.env.SYMBOLS.split(",");
const provider = new ProxyProvider(process.env.PROXY_URL);

const sleep = async (ms) => new Promise((r) => setTimeout(r, ms));

const countdown = async () => {
  let count = process.env.INTERVAL_SEC;
  while (count > 0) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write("countdown: " + count);
    await sleep(1000);
    count--;
  }
};

const createSigner = () => {
  const privk = process.env.PRIVATE_KEY;
  if (privk) {
    const signer = new SimpleSigner(privk.slice(0, 64));
    return signer;
  } else {
    let rawdata = fs.readFileSync(process.env.PATH_TO_KEY_FILE);
    const key = JSON.parse(rawdata);
    const signer = BackendSigner.fromWalletKey(
      key,
      process.env.PASSWORD_OF_KEY_FILE
    );
    return signer;
  }
};

const queryState = async () => {
  const sc = new SmartContract({
    address: new Address(process.env.STD_REF_CONTRACT),
  });

  const { returnData } = await sc.runQuery(provider, {
    func: new ContractFunction("getReferenceDataBulk"),
    args: symbols.map((s) => [Argument.utf8(s), Argument.utf8("USD")]).flat(),
  });

  let res = [];
  for (let i = 0; i < returnData.length; i += 3) {
    res = [
      ...res,
      {
        symbol: symbols[i / 3],
        px: Number(returnData[i].asBigInt / BigInt(E9)),
        resolve_time: returnData[i + 1].asNumber,
      },
    ];
  }

  return res;
};

const relay = async (priceData) => {
  let signer = createSigner();
  let relayer = await provider.getAccount(signer.getAddress());

  const sc = new SmartContract({
    address: new Address(process.env.STD_REF_CONTRACT),
  });

  const tx = await sc.call({
    func: new ContractFunction("relay"),
    args: priceData
      .map((e) => [
        Argument.utf8(e[0]),
        Argument.number(e[1]),
        Argument.number(e[2]),
        Argument.number(e[3]),
      ])
      .flat(),
    gasLimit: new GasLimit(process.env.GAS_LIMIT),
  });

  tx.setNonce(relayer.nonce);
  await signer.sign(tx);

  const txHash = await tx.send(provider);

  return txHash;
};

const getPricesFromBand = async () => {
  const rawResults = await axios
    .post(process.env.BAND_URL, { symbols, min_count: 3, ask_count: 4 })
    .then((r) => r.data["result"]);

  console.log(rawResults.map((e) => JSON.stringify(e)));

  let relayData = [];

  for ({ symbol, multiplier, px, request_id, resolve_time } of rawResults) {
    if (multiplier !== E9) {
      throw "multiplier is not equal 1_000_000_000";
    }

    relayData = [...relayData, [symbol, px, resolve_time, request_id]];
  }

  return relayData;
};

(async () => {
  console.log("Start...");
  await NetworkConfig.getDefault().sync(provider);
  console.log("Connected with the network");
  while (true) {
    try {
      console.log("Getting prices from BAND ...");
      const prices = await getPricesFromBand();

      console.log("Sending relay to ELROND ...");
      const txHash = await relay(prices);
      console.log(txHash);

      await countdown();

      console.log("Query reference data bulk from state of the contract ...");
      const bulk = await queryState();
      console.log(bulk.map((e) => JSON.stringify(e)));
    } catch (e) {
      console.log(e);
      await countdown();
    }

    console.log(
      "\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-="
    );
  }
})();
