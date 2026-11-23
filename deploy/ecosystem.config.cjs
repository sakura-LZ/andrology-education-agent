// PM2 进程配置（宝塔 PM2 管理器可直接导入，或用命令行 pm2 start）
// 部署目录：/www/wwwroot/education.bsnk.cloud
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'andrology-edu',
      script: './server/server.mjs',
      cwd: path.join(__dirname, '..'), // 项目根目录（deploy 的上一级）
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3360,
        HOST: '127.0.0.1'
      },
      time: true
      // 不指定 out_file/error_file：让 PM2 使用默认日志目录（~/.pm2/logs/），避免在项目目录建 logs 目录的权限问题
    }
  ]
};
