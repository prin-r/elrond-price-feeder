function numToHex(x) {
  let y = Number(x).toString(16);
  if (y.length % 2 === 0) {
    return y;
  }
  return "0" + y;
}

function strToHex(str) {
  var result = "";
  for (var i = 0; i < str.length; i++) {
    result += str.charCodeAt(i).toString(16);
  }
  return result;
}

const sleep = async (t) =>
  new Promise((r) => {
    setTimeout(r, t);
  });

module.exports = { numToHex, strToHex, sleep };
