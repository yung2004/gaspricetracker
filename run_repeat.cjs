const { exec } = require('child_process');

const INTERVAL = 1 * 60 * 60 * 1000;

function runScript() {
  console.log(`Running npm run scrape at ${new Date().toLocaleTimeString()}...`);
  
  exec('npm run scrape', (err, stdout, stderr) => {
    if (err) console.error('Error:', err);
    if (stdout) console.log('Output:', stdout);
  });
}

// Run immediately, then every 1 hours
runScript();
setInterval(runScript, INTERVAL);
