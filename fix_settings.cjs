const fs = require('fs');
const file = 'frontend/src/pages/PublicProfile.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix nickname
content = content.replace(/if \(settingNickname\) formData\.append\('nickname', settingNickname\);/g, "formData.append('nickname', settingNickname);");

// Fix themes
content = content.replace(/\{ id: 'theme2', a: '#FFF275', b: '#3A0CA3', name: 'Butter Yellow' \},\n\s*\{ id: 'theme3', a: '#B6FF2E', b: '#23262F', name: 'Lime Spark' \},\n\s*\{ id: 'theme4', a: '#FF4696', b: '#1E1033', name: 'Dragonfruit' \},\n\s*/g, '');
content = content.replace(/,\n\s*\{ id: 'theme6', a: '#FFD6A5', b: '#6A00F4', name: 'Ultra Violet' \}/g, '');

fs.writeFileSync(file, content);
