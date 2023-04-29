const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PayPalSchema = mongoose.Schema(
  {
    user: {
      type: Array,
      default: [],
    },
    product: {
      type: Array,
      default: [],
    },
    data: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const PayPal = mongoose.model("PayPal", PayPalSchema);

module.exports = { PayPal };
