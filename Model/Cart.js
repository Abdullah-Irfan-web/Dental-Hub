const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userEmail: { type: String, required: true }, // or userId if you have User schema
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: { type: Number, default: 1, min: 1 }
    }
  ]
}, { timestamps: true });

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;