// What does wmic actually use as separator?
const sample = "\r\r\n\r\r\nCommandLine=node\r\r\nKernelModeTime=0\r\r\nProcessId=1\r\r\nUserModeTime=0\r\r\nWorkingSetSize=0\r\r\n\r\r\n\r\r\nCommandLine=node2\r\r\nKernelModeTime=0\r\r\nProcessId=2\r\r\nUserModeTime=0\r\r\nWorkingSetSize=0\r\r\n\r\r\n";
const blocks1 = sample.split(/\r?\n\r?\n/);
const blocks2 = sample.split(/\r+\n\r+\n/);
const blocks3 = sample.split(/\r\n/);
console.log('split by /\\r?\\n\\r?\\n/:', blocks1.length, 'blocks');
console.log('split by /\\r+\\n\\r+\\n/:', blocks2.length, 'blocks');
console.log('split by /\\r\\n/:', blocks3.length, 'blocks');
console.log('blocks1 first non-empty:', JSON.stringify(blocks1.find(b => b.includes('CommandLine'))));
