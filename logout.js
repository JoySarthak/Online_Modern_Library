// authController.js
const logoutUser = async (req, res) => {
    try {
        // Clear the authentication token (example using cookies)
        res.clearCookie('authToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        // Or if using sessions:
        // req.session.destroy(err => {
        //     if (err) throw err;
        // });
        
        // Send success response
        res.status(200).json({ message: 'Logout successful' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Error during logout' });
    }
};

export default { logoutUser };