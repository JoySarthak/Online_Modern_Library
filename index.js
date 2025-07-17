// The code has been refactored and split into app.js and server.js for better structure.
// Please use server.js as the entry point.
const app = require('./app');

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
}); 