import app from './src/app';
import config from './src/config/config';

// Start the server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.server.nodeEnv} mode`);
});

export default app;
