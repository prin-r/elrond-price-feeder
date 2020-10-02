const axios = require("axios");

const alert = async (title, details, high = true) => {
  const rounting_key = high
    ? process.env.HIGH_URGENCY_ROUNTING_KEY
    : process.env.LOW_URGENCY_ROUNTING_KEY;
  return axios.post(
    "https://events.pagerduty.com/v2/enqueue",
    {
      payload: {
        summary: title,
        custom_details: details,
        severity: "critical",
        source: "Elrond-testnet-price-feed",
      },
      event_action: "trigger",
      routing_key: rounting_key,
    },
    {
      headers: {
        Authorization: "Token token=" + process.env.API_TOKEN,
        From: "bun@bandprotocol.com",
        "Content-Type": "application/json",
        Accept: "application/vnd.pagerduty+json;version=2",
      },
    }
  );
};

export default alert;
