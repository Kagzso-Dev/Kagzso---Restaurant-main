const Setting = require('../models/Setting');
const User = require('../models/User');

// GET /api/settings
const getSettings = async (req, res) => {
    try {
        res.json(await Setting.get());
    } catch (error) {
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

// PUT /api/settings
const updateSettings = async (req, res) => {
    try {
        const settings = await Setting.update(req.body);
        req.app.get('socketio').to('restaurant_main').emit('settings-updated', settings);
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
            targetUser = await User.findByRole(role);
        } else {
            const idToUpdate = userId || req.userId;
            targetUser = await User.findById(idToUpdate);
            if (req.role !== 'admin' && String(req.userId) !== String(idToUpdate)) {
                return res.status(403).json({ message: 'Unauthorized' });
            }
        }

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        await User.updatePassword(targetUser._id, newPassword);
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Error updating password' });
    }
};

module.exports = { getSettings, updateSettings, changePassword };
