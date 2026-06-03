import { createApp } from './app.js';
import { config } from './config/env.js';

const { app } = createApp();

app.listen(config.PORT, () => {
  console.log(`🚀 Mentamind API running on port ${config.PORT}`);
  console.log(`📋 Environment: ${config.NODE_ENV}`);
  console.log(
    `🔗 Health check: http://localhost:${config.PORT}/api/health`,
  );
});
