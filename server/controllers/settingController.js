const Setting = require('../models/Setting');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Helper: get or create settings
const getOrInitSettings = async () => {
    let settings = await Setting.findOne({});
    if (!settings) {
        settings = await Setting.create({
            restaurantName: 'My Restaurant',
            currency: 'USD',
            currencySymbol: '$',
            taxRate: 5,
            gstNumber: '',
        });
    }
    return settings;
};

// GET /api/settings
const getSettings = async (req, res) => {
    try {
        const settings = await getOrInitSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

// PUT /api/settings
const updateSettings = async (req, res) => {
    try {
        const { restaurantName, currency, currencySymbol, taxRate, gstNumber } = req.body;
        const settings = await getOrInitSettings();

        if (restaurantName !== undefined) settings.restaurantName = restaurantName;
        if (currency !== undefined) settings.currency = currency;
        if (currencySymbol !== undefined) settings.currencySymbol = currencySymbol;
        if (taxRate !== undefined) settings.taxRate = taxRate;
        if (gstNumber !== undefined) settings.gstNumber = gstNumber;

        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error updating settings' });
    }
};

// POST /api/settings/change-password
const changePassword = async (req, res) => {
    try {
        const { userId, role, newPassword } = req.body;

        let targetUser;

        if (role) {
            if (req.role !== 'admin') {
                return res.status(403).json({ message: 'Only Admin can change staff passwords' });
            }

            targetUser = await User.findOne({ role: role });
        } else {
            const idToUpdate = userId || req.userId;

            targetUser = await User.findById(idToUpdate);

            if (req.role !== 'admin' && req.userId.toString() !== idToUpdate.toString()) {
                return res.status(403).json({ message: 'Unauthorized' });
            }
        }

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        targetUser.password = newPassword;
        await targetUser.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Error updating password' });
    }
};

module.exports = { getSettings, updateSettings, changePassword };
