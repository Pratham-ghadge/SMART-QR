const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: {
    type: Date,
    default: null
  },
  cart: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      productName: String,
      price: Number,
      imageUrl: String,
      quantity: {
        type: Number,
        default: 1
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  totalAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'not_required'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: null
  },
  transactions: [
    {
      transactionId: String,
      razorpayOrderId: String,
      razorpayPaymentId: String,
      amount: Number,
      method: String,
      signature: String,
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  exitQR: {
    type: String,
    default: null
  },
  activityLogs: [
    {
      action: {
        type: String,
        enum: ['ADD', 'REMOVE', 'INCREASE', 'DECREASE'],
        required: true
      },
      productId: mongoose.Schema.Types.ObjectId,
      productName: String,
      quantity: Number,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ Add indexes for faster queries
orderSchema.index({ storeId: 1 }); // Index for monitoring customer by store
orderSchema.index({ customerId: 1 }); // Index for customer order history
orderSchema.index({ storeId: 1, paymentStatus: 1 }); // Compound index for store and payment status
orderSchema.index({ entryTime: -1 }); // Index for sorting by entry time
orderSchema.index({ createdAt: -1 }); // Index for creation time

module.exports = mongoose.model('Order', orderSchema);
