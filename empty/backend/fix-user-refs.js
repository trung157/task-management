const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/controllers/taskController.modern.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of req.user! with (req as any).user!
content = content.replace(/req\.user!/g, '(req as any).user!');

fs.writeFileSync(filePath, content);
console.log('✅ Fixed all req.user! references in taskController.modern.ts');
