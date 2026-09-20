const fs = require('node:fs');
const path = require('node:path');

function readVolumePath(env) {
  const mount = env.RAILWAY_VOLUME_MOUNT_PATH;
  if (typeof mount !== 'string' || !path.posix.isAbsolute(mount) || mount.endsWith('/') || path.posix.normalize(mount) !== mount || mount.includes('\\') || /[\x00-\x1f]/.test(mount)) {
    throw new Error('Railway documents require an explicit normalized volume mount path.');
  }
  return mount;
}

function assertVolumeMounted(mount, { platform = process.platform, filesystem = fs } = {}) {
  if (platform !== 'linux') throw new Error('Railway volume storage requires Linux.');
  readVolumePath({ RAILWAY_VOLUME_MOUNT_PATH: mount });
  const decode = value => value.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
  const mounted = filesystem.readFileSync('/proc/self/mountinfo', 'utf8').split('\n')
    .some(line => decode(line.split(' ')[4] || '') === mount);
  if (!mounted || filesystem.realpathSync(mount) !== mount || !filesystem.lstatSync(mount).isDirectory()) {
    throw new Error('The private document volume is not mounted at the configured path.');
  }
}

module.exports = { readVolumePath, assertVolumeMounted };
