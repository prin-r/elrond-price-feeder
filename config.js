const { SimpleSigner } = require("@elrondnetwork/erdjs");
const BandChain = require("@bandprotocol/bandchain.js");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const loadKey = () => {
  let rawdata = fs.readFileSync(process.env.PATH_TO_KEY_FILE);
  return JSON.parse(rawdata);
};

const createSigner = () => {
  let signer = SimpleSigner.fromWalletKey(
    loadKey(),
    process.env.PASSWORD_OF_KEY_FILE
  );
  return signer;
};

const config = () => {
  return {
    proxy_url: process.env.PROXY_URL,
    target_contract: process.env.TARGET_CONTRACT,
    chain_id: process.env.CHAID_ID,
    signer: createSigner(),
    bandchain: new BandChain(process.env.BAND_URL),
    symbols: process.env.SYMBOLS.split(","),
    interval: Number(process.env.INTERVAL),
  };
};

module.exports = config();
