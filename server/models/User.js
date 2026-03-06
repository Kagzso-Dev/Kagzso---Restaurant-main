const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin', 'waiter', 'kitchen', 'cashier'],
        required: true
    },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Index for name
userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);

