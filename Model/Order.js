const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address",
    required: true
  },
  status: {
    type: String,
    enum: ["Confirmed", "Shipped", "Delivered"],
    default: "Confirmed"
  },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: { type: Number, default: 1, min: 1 }
    }
  ]
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
