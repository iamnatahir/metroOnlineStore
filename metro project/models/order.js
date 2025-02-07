const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deliveryInfo: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: String, required: true },
    },
    cartItems: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            title: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true },
        },
    ],
    paymentMethod: { type: String, enum: ['Cash on Delivery'], default: 'Cash on Delivery' },
    status: { type: String, enum: ['Pending', 'Processing', 'Delivered'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);