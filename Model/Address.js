const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, unique: true }, // to link with user
  name: { type: String, required: true },
  city: { type: String },
  pincode: { type: String },
  fullAddress: { type: String },
  contactNumber: { type: String }
});

module.exports = mongoose.model("Address", addressSchema);
