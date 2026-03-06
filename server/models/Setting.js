const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    restaurantName: { type: String, default: 'My Restaurant' },
    currency: { type: String, default: 'USD' },
    currencySymbol: { type: String, default: '$' },
    taxRate: { type: Number, default: 5 },
    gstNumber: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);

