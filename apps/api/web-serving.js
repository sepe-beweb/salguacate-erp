const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

function overlaps(a, b) {
  const inside = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
  return inside(a, b) || inside(b, a);
}

function registerWeb(app, directory, privateDirectories = []) {
  const root = path.resolve(directory);
  if (fs.realpathSync(root) !== root || privateDirectories.filter(Boolean).some(value => overlaps(root, path.resolve(value)))) {
    throw new Error('The web build must be separate from application storage and symbolic links.');
  }
  const inspect = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) throw new Error('The web build contains an unsafe entry.');
      if (entry.isDirectory()) inspect(path.join(directory, entry.name));
    }
  };
  inspect(root);
  if (!fs.statSync(path.join(root, 'index.html')).isFile()) throw new Error('Build the web application before starting the server.');
  app.use((req, res, next) => {
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
    if (!['GET', 'HEAD'].includes(req.method) || pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.')) || /^\/(api|uploads)(\/|$)/i.test(pathname)) return res.sendStatus(404);
    next();
  });
  app.use(express.static(root, { dotfiles: 'deny', index: false, redirect: false, cacheControl: false }));
  app.use((req, res, next) => {
    if (path.posix.extname(req.path) || !req.accepts('html')) return res.sendStatus(404);
    res.sendFile(path.join(root, 'index.html'), { cacheControl: false }, error => { if (error) next(error); });
  });
}

module.exports = { registerWeb };
