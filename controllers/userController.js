const User = require('../models/User');
const logger = require('../utils/logger');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role;
    const search = req.query.search;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-passwordHash') // Exclude password hash
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalUsers = await User.countDocuments(filter);

    logger.info(`Admin fetched users - Page: ${page}, Limit: ${limit}, Role: ${role || 'all'}, Search: ${search || 'none'}`);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: totalUsers
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Error fetching users', error: error.message });
  }
};

// Update user role (admin only)
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be user or admin' });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info(`User role updated: ${user._id} to ${role} by admin ${req.user._id}`);

    res.json({ success: true, message: 'User role updated successfully', data: user });
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ success: false, message: 'Error updating user role', error: error.message });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete admin users' });
    }

    await User.findByIdAndDelete(id);

    logger.info(`User deleted: ${id} by admin ${req.user._id}`);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
  }
};

// Get user stats (admin only)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    res.json({
      success: true,
      data: {
        totalUsers,
        adminUsers,
        regularUsers: totalUsers - adminUsers,
        activeUsers,
        inactiveUsers
      }
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching user stats', error: error.message });
  }
};
