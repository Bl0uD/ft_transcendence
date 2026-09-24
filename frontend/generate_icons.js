const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'frontend/src/assets');
const componentsFile = path.join(__dirname, 'frontend/src/components/HeaderIcons.tsx');

let output = `export function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 17 18" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M16 17L12.3834 13.1423M14.3332 8.11105C14.3332 12.0384 11.3485 15.2221 7.66661 15.2221C3.98474 15.2221 1 12.0384 1 8.11105C1 4.18372 3.98474 1 7.66661 1C11.3485 1 14.3332 4.18372 14.3332 8.11105Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function LightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function DarkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function BubbleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M25,10H7a3.0033,3.0033,0,0,0-3,3v6a2.0023,2.0023,0,0,0,2,2v7a2.0023,2.0023,0,0,0,2,2h4a2.0023,2.0023,0,0,0,2-2V16H12V28H8V19H6V13a1.0009,1.0009,0,0,1,1-1H25a1.0009,1.0009,0,0,1,1,1v6H24v9H20V16H18V28a2.0023,2.0023,0,0,0,2,2h4a2.0023,2.0023,0,0,0,2-2V21a2.0023,2.0023,0,0,0,2-2V13A3.0033,3.0033,0,0,0,25,10Z" transform="translate(-4 -10) scale(0.8)"/>
    </svg>
  );
}

\n\n`;

const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.svg'));

for (const file of files) {
  if (file === 'react.svg' || file === 'vite.svg') continue;
  if (file === 'bubble.svg') continue; 

  const name = file.replace('.svg', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Icon';
  
  let content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  let viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  let viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

  let innerMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  let inner = innerMatch ? innerMatch[1] : '';

  inner = inner.replace(/<metadata>[\s\S]*?<\/metadata>/ig, '');
  inner = inner.replace(/<defs>[\s\S]*?<\/defs>/ig, '');
  inner = inner.replace(/<\?xml.*?\?>/ig, '');
  inner = inner.replace(/<!--[\s\S]*?-->/ig, '');
  inner = inner.replace(/<desc>[\s\S]*?<\/desc>/ig, '');
  inner = inner.replace(/<style>[\s\S]*?<\/style>/ig, ''); 
  inner = inner.replace(/class="cls-\d+"/g, 'fill="none"'); 

  inner = inner.replace(/fill-rule/g, 'fillRule');
  inner = inner.replace(/clip-rule/g, 'clipRule');
  inner = inner.replace(/stroke-width/g, 'strokeWidth');
  inner = inner.replace(/stroke-linejoin/g, 'strokeLinejoin');
  inner = inner.replace(/stroke-linecap/g, 'strokeLinecap');
  inner = inner.replace(/stroke-miterlimit/g, 'strokeMiterlimit');
  inner = inner.replace(/class=/g, 'className=');
  inner = inner.replace(/enable-background/g, 'enableBackground');
  inner = inner.replace(/xml:space/g, 'xmlSpace');
  inner = inner.replace(/xmlns:xlink/g, 'xmlnsXlink');
  inner = inner.replace(/style="[^"]*"/g, '');

  output += `export function ${name}({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg 
      viewBox="${viewBox}" 
      fill="currentColor"
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      ${inner.trim()}
    </svg>
  );
}\n\n`;
}

fs.writeFileSync(componentsFile, output);
console.log('Icons restored successfully.');
