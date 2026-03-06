const MenuItem = require('../models/MenuItem');

// @desc    Get all menu items for this branch
// @route   GET /api/menu
// @access  Private
const getMenuItems = async (req, res) => {
    try {
        const items = await MenuItem.find({
            availability: true,
        }).populate('category');
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create menu item
// @route   POST /api/menu
// @access  Private (Admin)
const createMenuItem = async (req, res) => {
    const { name, description, price, category, image, isVeg } = req.body;

    try {
        const item = await MenuItem.create({
            name,
            description,
            price,
            category,
            image,
            isVeg,
        });
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private (Admin)
const updateMenuItem = async (req, res) => {
    try {
        const item = await MenuItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const { name, description, price, category, image, availability, isVeg } = req.body;

        item.name = name !== undefined ? name : item.name;
        item.description = description !== undefined ? description : item.description;
        item.price = price !== undefined ? price : item.price;
        item.category = category !== undefined ? category : item.category;
        item.image = image !== undefined ? image : item.image;
        item.isVeg = isVeg !== undefined ? isVeg : item.isVeg;
        if (availability !== undefined) item.availability = availability;

        const updatedItem = await item.save();
        res.json(updatedItem);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private (Admin)
const deleteMenuItem = async (req, res) => {
    try {
        const item = await MenuItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        await item.deleteOne();
        res.json({ message: 'Item removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem };
