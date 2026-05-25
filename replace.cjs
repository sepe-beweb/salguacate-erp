const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(srcDir);
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // Skip config.ts itself
    if (file.endsWith('config.ts')) return;
    
    if (content.includes('http://localhost:3001')) {
        console.log(`Updating ${file}`);
        let relativePath = path.relative(path.dirname(file), path.join(srcDir, 'config'));
        relativePath = relativePath.replace(/\\/g, '/');
        if (!relativePath.startsWith('.')) {
            relativePath = './' + relativePath;
        }
        
        let hasImport = content.includes('import { API_URL }');
        if (!hasImport) {
            // Find a good place to put the import, like after the last import or at top
            const lines = content.split('\n');
            let lastImportIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('import ')) {
                    lastImportIndex = i;
                }
            }
            if (lastImportIndex !== -1) {
                lines.splice(lastImportIndex + 1, 0, `import { API_URL } from '${relativePath}';`);
                content = lines.join('\n');
            } else {
                content = `import { API_URL } from '${relativePath}';\n` + content;
            }
        }
        
        content = content.replace(/'http:\/\/localhost:3001(\/api[^']*)'/g, '`${API_URL}$1`');
        content = content.replace(/`http:\/\/localhost:3001(\/api[^`]*)`/g, '`${API_URL}$1`');
        content = content.replace(/'http:\/\/localhost:3001'/g, 'API_URL');
        
        fs.writeFileSync(file, content);
    }
});
