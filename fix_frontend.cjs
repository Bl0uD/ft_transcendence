const fs = require('fs');
const file = 'src/components/GlobalChatWidget.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update state definition
content = content.replace(
  /const \[typingUsers, setTypingUsers\] = useState<number\[\]>\(\[\]\);/,
  'const [typingUsers, setTypingUsers] = useState<{id: number, name: string}[]>([]);'
);

// Update event listeners
content = content.replace(
  /const handleUserTyping = \(data: \{ userId: number, channelId: number \}\) => \{[\s\S]*?const handleUserStoppedTyping = \(data: \{ userId: number, channelId: number \}\) => \{/,
  `const handleUserTyping = (data: { userId: number, channelId: number, username?: string }) => {
      if (data.userId === user?.id) return;
      if (data.channelId === activeRoom) {
        setTypingUsers((prev) => prev.some(u => u.id === data.userId) ? prev : [...prev, {id: data.userId, name: data.username || 'Un ami'}]);
      }
    };
    const handleUserStoppedTyping = (data: { userId: number, channelId: number }) => {`
);

content = content.replace(
  /setTypingUsers\(\(prev\) => prev\.filter\(id => id !== data\.userId\)\);/,
  'setTypingUsers((prev) => prev.filter(u => u.id !== data.userId));'
);

// Remove the old absolute indicator
content = content.replace(/\{\/\* INDICATEUR DE FRAPPE \*\/\}\s*\{typingUsers && typingUsers\.length > 0 && \([\s\S]*?\}\)\}\s*/, '');

// Put it at the bottom of the message container
const newIndicator = `
                  {typingUsers.length > 0 && (
                    <div className="flex w-full justify-start mt-1">
                      <div className="flex gap-2 max-w-[90%] sm:max-w-[85%] flex-row">
                        <div className="flex-shrink-0 flex flex-col justify-end pb-1">
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                            <RobotIcon className="w-3.5 h-3.5 text-text-muted" />
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] sm:text-xs text-text-muted font-medium mb-1 pl-1 truncate">
                            {typingUsers.map(u => u.name).join(', ')}
                          </span>
                          <div className="bg-surface border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl rounded-bl-none min-w-0 shadow-sm relative text-text-main text-xs sm:text-sm">
                            <div className="flex gap-1 items-center h-4">
                              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse"></span>
                              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse delay-75"></span>
                              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse delay-150"></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>`;
                
// Find where the map ends. It usually ends with `                  })}` followed by `                </div>`
content = content.replace(/                  \}\)\}\n                <\/div>/, '                  })}\n' + newIndicator);

// Emit typing with username
content = content.replace(
  /socket\.emit\('typing', \{ channelId: activeRoom \}\);/g,
  "socket.emit('typing', { channelId: activeRoom, username: getDisplayName(user) });"
);

fs.writeFileSync(file, content);
